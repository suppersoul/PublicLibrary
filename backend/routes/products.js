const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { getMySQLPool, getRedisClient } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// 获取商品列表
router.get('/', [
  optionalAuth,
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('size').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('category_id').optional().isInt({ min: 1 }).withMessage('分类ID必须是正整数'),
  query('keyword').optional().isLength({ max: 100 }).withMessage('关键词长度不能超过100'),
  query('min_price').optional().isFloat({ min: 0 }).withMessage('最低价格必须是非负数'),
  query('max_price').optional().isFloat({ min: 0 }).withMessage('最高价格必须是非负数'),
  query('sort').optional().isIn(['price_asc', 'price_desc', 'sales_desc', 'created_desc']).withMessage('排序方式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const {
      page = 1,
      size = 20,
      category_id,
      keyword,
      min_price,
      max_price,
      sort = 'created_desc'
    } = req.query;

    const pool = getMySQLPool();
    const redisClient = getRedisClient();
    const userId = req.user?.id;

    // 构建查询条件
    let whereClause = 'WHERE p.status = 1';
    let params = [];

    if (category_id) {
      whereClause += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (keyword) {
      whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword);
    }

    if (min_price !== undefined) {
      whereClause += ' AND p.price >= ?';
      params.push(parseFloat(min_price));
    }

    if (max_price !== undefined) {
      whereClause += ' AND p.price <= ?';
      params.push(parseFloat(max_price));
    }

    // 构建排序
    let orderClause = 'ORDER BY ';
    switch (sort) {
      case 'price_asc':
        orderClause += 'p.price ASC';
        break;
      case 'price_desc':
        orderClause += 'p.price DESC';
        break;
      case 'sales_desc':
        orderClause += 'p.sales_count DESC';
        break;
      default:
        orderClause += 'p.created_at DESC';
    }

    // 计算偏移量
    const offset = (page - 1) * size;

    // 查询商品总数
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 查询商品列表
    const [products] = await pool.execute(
      `SELECT 
        p.id, p.name, p.description, p.price, p.original_price,
        p.stock, p.sales_count, p.images, p.tags, p.weight, p.unit,
        p.created_at, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?`,
      [...params, parseInt(size), offset]
    );

    // 处理商品数据
    const processedProducts = products.map(product => {
      // 解析图片和标签
      try {
        product.images = JSON.parse(product.images || '[]');
        product.tags = JSON.parse(product.tags || '[]');
      } catch (e) {
        product.images = [];
        product.tags = [];
      }

      // 检查用户是否收藏
      if (userId) {
        // TODO: 实现收藏检查逻辑
        product.is_favorite = false;
      }

      return product;
    });

    // 缓存热门商品到Redis
    if (page === 1 && !category_id && !keyword) {
      await redisClient.setEx('hot_products', 3600, JSON.stringify(processedProducts.slice(0, 10)));
    }

    // 记录搜索日志
    if (keyword) {
      logger.logBusiness('商品搜索', {
        userId: userId || 'anonymous',
        keyword,
        results: products.length,
        filters: { category_id, min_price, max_price, sort }
      });
    }

    res.json({
      code: 200,
      data: {
        list: processedProducts,
        pagination: {
          page: parseInt(page),
          size: parseInt(size),
          total,
          pages: Math.ceil(total / size)
        }
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取商品列表失败',
      code: 'GET_PRODUCTS_FAILED'
    });
  }
});

// 获取商品详情
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('商品ID必须是正整数'),
  optionalAuth
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const productId = parseInt(req.params.id);
    const userId = req.user?.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    // 尝试从缓存获取商品详情
    const cachedProduct = await redisClient.get(`product:${productId}`);
    let product;

    if (cachedProduct) {
      product = JSON.parse(cachedProduct);
    } else {
      // 从数据库查询
      const [products] = await pool.execute(
        `SELECT 
          p.*, c.name as category_name, c.description as category_description
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.status = 1`,
        [productId]
      );

      if (products.length === 0) {
        return res.status(404).json({
          error: '商品不存在',
          code: 'PRODUCT_NOT_FOUND'
        });
      }

      product = products[0];

      // 解析JSON字段
      try {
        product.images = JSON.parse(product.images || '[]');
        product.tags = JSON.parse(product.tags || '[]');
        product.specifications = JSON.parse(product.specifications || '{}');
      } catch (e) {
        product.images = [];
        product.tags = [];
        product.specifications = {};
      }

      // 缓存商品详情，1小时过期
      await redisClient.setEx(`product:${productId}`, 3600, JSON.stringify(product));
    }

    // 增加浏览量
    await redisClient.incr(`product_views:${productId}`);
    
    // 记录用户浏览历史
    if (userId) {
      await redisClient.zAdd(`user_history:${userId}`, {
        score: Date.now(),
        value: productId.toString()
      });
      // 只保留最近50个浏览记录
      await redisClient.zRemRangeByRank(`user_history:${userId}`, 0, -51);
    }

    // 获取相关商品推荐
    const relatedProducts = await getRelatedProducts(productId, product.category_id, pool);

    // 检查用户是否收藏
    if (userId) {
      // TODO: 实现收藏检查逻辑
      product.is_favorite = false;
    }

    // 记录商品查看日志
    logger.logBusiness('商品查看', {
      userId: userId || 'anonymous',
      productId,
      productName: product.name
    });

    res.json({
      code: 200,
      data: {
        product,
        relatedProducts
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取商品详情失败',
      code: 'GET_PRODUCT_DETAIL_FAILED'
    });
  }
});

// 获取商品分类
router.get('/categories/list', async (req, res) => {
  try {
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    // 尝试从缓存获取分类
    const cachedCategories = await redisClient.get('product_categories');
    let categories;

    if (cachedCategories) {
      categories = JSON.parse(cachedCategories);
    } else {
      // 从数据库查询
      const [result] = await pool.execute(
        'SELECT id, name, description, icon, sort_order, parent_id FROM categories WHERE status = 1 ORDER BY sort_order ASC, id ASC'
      );

      // 构建分类树结构
      categories = buildCategoryTree(result);

      // 缓存分类数据，24小时过期
      await redisClient.setEx('product_categories', 86400, JSON.stringify(categories));
    }

    res.json({
      code: 200,
      data: categories
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取商品分类失败',
      code: 'GET_CATEGORIES_FAILED'
    });
  }
});

// 获取热门商品
router.get('/hot/list', async (req, res) => {
  try {
    const redisClient = getRedisClient();
    
    // 尝试从缓存获取热门商品
    const cachedHotProducts = await redisClient.get('hot_products');
    
    if (cachedHotProducts) {
      return res.json({
        code: 200,
        data: JSON.parse(cachedHotProducts)
      });
    }

    // 从数据库查询热门商品
    const pool = getMySQLPool();
    const [products] = await pool.execute(
      `SELECT id, name, price, original_price, images, sales_count
       FROM products 
       WHERE status = 1 
       ORDER BY sales_count DESC, views_count DESC 
       LIMIT 10`
    );

    // 处理商品数据
    const processedProducts = products.map(product => {
      try {
        product.images = JSON.parse(product.images || '[]');
      } catch (e) {
        product.images = [];
      }
      return product;
    });

    // 缓存热门商品，1小时过期
    await redisClient.setEx('hot_products', 3600, JSON.stringify(processedProducts));

    res.json({
      code: 200,
      data: processedProducts
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取热门商品失败',
      code: 'GET_HOT_PRODUCTS_FAILED'
    });
  }
});

// 获取推荐商品
router.get('/recommend/list', [
  optionalAuth
], async (req, res) => {
  try {
    const userId = req.user?.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    let recommendedProducts = [];

    if (userId) {
      // 基于用户浏览历史的推荐
      const userHistory = await redisClient.zRange(`user_history:${userId}`, 0, -1);
      
      if (userHistory.length > 0) {
        // 获取用户最近浏览的商品分类
        const recentProductIds = userHistory.slice(-5);
        const [recentProducts] = await pool.execute(
          'SELECT category_id FROM products WHERE id IN (?)',
          [recentProductIds]
        );

        if (recentProducts.length > 0) {
          const categoryIds = [...new Set(recentProducts.map(p => p.category_id))];
          
          // 推荐同类别的其他商品
          const [products] = await pool.execute(
            `SELECT id, name, price, original_price, images, sales_count
             FROM products 
             WHERE status = 1 AND category_id IN (?) AND id NOT IN (?)
             ORDER BY sales_count DESC 
             LIMIT 10`,
            [categoryIds, recentProductIds]
          );

          recommendedProducts = products;
        }
      }
    }

    // 如果用户没有浏览历史或推荐数量不足，补充热门商品
    if (recommendedProducts.length < 10) {
      const [hotProducts] = await pool.execute(
        `SELECT id, name, price, original_price, images, sales_count
         FROM products 
         WHERE status = 1 
         ORDER BY sales_count DESC 
         LIMIT ?`,
        [10 - recommendedProducts.length]
      );

      recommendedProducts = [...recommendedProducts, ...hotProducts];
    }

    // 处理商品数据
    const processedProducts = recommendedProducts.map(product => {
      try {
        product.images = JSON.parse(product.images || '[]');
      } catch (e) {
        product.images = [];
      }
      return product;
    });

    res.json({
      code: 200,
      data: processedProducts
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取推荐商品失败',
      code: 'GET_RECOMMEND_PRODUCTS_FAILED'
    });
  }
});

// 辅助函数：构建分类树
function buildCategoryTree(categories, parentId = null) {
  const tree = [];
  
  for (const category of categories) {
    if (category.parent_id === parentId) {
      const children = buildCategoryTree(categories, category.id);
      if (children.length > 0) {
        category.children = children;
      }
      tree.push(category);
    }
  }
  
  return tree;
}

// 辅助函数：获取相关商品
async function getRelatedProducts(productId, categoryId, pool) {
  try {
    const [products] = await pool.execute(
      `SELECT id, name, price, original_price, images, sales_count
       FROM products 
       WHERE status = 1 AND category_id = ? AND id != ?
       ORDER BY sales_count DESC 
       LIMIT 6`,
      [categoryId, productId]
    );

    return products.map(product => {
      try {
        product.images = JSON.parse(product.images || '[]');
      } catch (e) {
        product.images = [];
      }
      return product;
    });
  } catch (error) {
    logger.logError(error);
    return [];
  }
}

module.exports = router;