const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { getMySQLPool, getRedisClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// 获取购物车列表
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    // 从Redis获取购物车数据
    const cartKey = `cart:${userId}`;
    const cartItems = await redisClient.hGetAll(cartKey);

    if (Object.keys(cartItems).length === 0) {
      return res.json({
        code: 200,
        data: {
          items: [],
          totalCount: 0,
          totalAmount: 0
        }
      });
    }

    // 获取商品详情
    const productIds = Object.keys(cartItems);
    const [products] = await pool.execute(
      'SELECT id, name, price, original_price, stock, images, unit FROM products WHERE id IN (?) AND status = 1',
      [productIds]
    );

    // 构建购物车项目
    const cartData = [];
    let totalAmount = 0;
    let totalCount = 0;

    for (const product of products) {
      const quantity = parseInt(cartItems[product.id]);
      const item = {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        original_price: parseFloat(product.original_price),
        stock: product.stock,
        quantity: quantity,
        unit: product.unit,
        subtotal: parseFloat(product.price) * quantity,
        images: JSON.parse(product.images || '[]')
      };

      cartData.push(item);
      totalAmount += item.subtotal;
      totalCount += quantity;
    }

    // 按添加时间排序（这里简化处理，实际应该记录添加时间）
    cartData.sort((a, b) => a.id - b.id);

    res.json({
      code: 200,
      data: {
        items: cartData,
        totalCount,
        totalAmount: Math.round(totalAmount * 100) / 100
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取购物车失败',
      code: 'GET_CART_FAILED'
    });
  }
});

// 添加商品到购物车
router.post('/add', [
  authenticateToken,
  body('product_id').isInt({ min: 1 }).withMessage('商品ID必须是正整数'),
  body('quantity').isInt({ min: 1, max: 99 }).withMessage('商品数量必须在1-99之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { product_id, quantity } = req.body;
    const userId = req.user.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    // 检查商品是否存在且有库存
    const [products] = await pool.execute(
      'SELECT id, name, price, stock, status FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        error: '商品不存在',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    const product = products[0];
    if (product.status !== 1) {
      return res.status(400).json({
        error: '商品已下架',
        code: 'PRODUCT_OFFLINE'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        error: '商品库存不足',
        code: 'INSUFFICIENT_STOCK'
      });
    }

    // 获取当前购物车中的数量
    const cartKey = `cart:${userId}`;
    const currentQuantity = await redisClient.hGet(cartKey, product_id) || 0;
    const newQuantity = parseInt(currentQuantity) + quantity;

    // 检查总数量是否超过库存
    if (newQuantity > product.stock) {
      return res.status(400).json({
        error: '购物车商品数量超过库存',
        code: 'CART_QUANTITY_EXCEEDS_STOCK'
      });
    }

    // 更新购物车
    await redisClient.hSet(cartKey, product_id, newQuantity.toString());
    
    // 设置购物车过期时间（7天）
    await redisClient.expire(cartKey, 7 * 24 * 3600);

    // 记录购物车操作日志
    logger.logBusiness('购物车操作', {
      userId,
      productId: product_id,
      action: 'add',
      quantity,
      newTotalQuantity: newQuantity
    });

    res.json({
      code: 200,
      message: '添加成功',
      data: {
        product_id,
        quantity: newQuantity
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '添加商品失败',
      code: 'ADD_TO_CART_FAILED'
    });
  }
});

// 更新购物车商品数量
router.put('/update', [
  authenticateToken,
  body('product_id').isInt({ min: 1 }).withMessage('商品ID必须是正整数'),
  body('quantity').isInt({ min: 0, max: 99 }).withMessage('商品数量必须在0-99之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { product_id, quantity } = req.body;
    const userId = req.user.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    if (quantity === 0) {
      // 数量为0时删除商品
      return await removeFromCart(req, res);
    }

    // 检查商品库存
    const [products] = await pool.execute(
      'SELECT stock FROM products WHERE id = ? AND status = 1',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        error: '商品不存在或已下架',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    if (products[0].stock < quantity) {
      return res.status(400).json({
        error: '商品库存不足',
        code: 'INSUFFICIENT_STOCK'
      });
    }

    // 更新购物车
    const cartKey = `cart:${userId}`;
    await redisClient.hSet(cartKey, product_id, quantity.toString());
    await redisClient.expire(cartKey, 7 * 24 * 3600);

    logger.logBusiness('购物车操作', {
      userId,
      productId: product_id,
      action: 'update',
      quantity
    });

    res.json({
      code: 200,
      message: '更新成功',
      data: {
        product_id,
        quantity
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '更新购物车失败',
      code: 'UPDATE_CART_FAILED'
    });
  }
});

// 从购物车删除商品
router.delete('/remove/:product_id', [
  authenticateToken,
  param('product_id').isInt({ min: 1 }).withMessage('商品ID必须是正整数')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const product_id = parseInt(req.params.product_id);
    const userId = req.user.id;
    const redisClient = getRedisClient();

    const cartKey = `cart:${userId}`;
    const removed = await redisClient.hDel(cartKey, product_id.toString());

    if (removed === 0) {
      return res.status(404).json({
        error: '商品不在购物车中',
        code: 'ITEM_NOT_IN_CART'
      });
    }

    logger.logBusiness('购物车操作', {
      userId,
      productId: product_id,
      action: 'remove'
    });

    res.json({
      code: 200,
      message: '删除成功',
      data: { product_id }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '删除商品失败',
      code: 'REMOVE_FROM_CART_FAILED'
    });
  }
});

// 清空购物车
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const redisClient = getRedisClient();

    const cartKey = `cart:${userId}`;
    await redisClient.del(cartKey);

    logger.logBusiness('购物车操作', {
      userId,
      action: 'clear'
    });

    res.json({
      code: 200,
      message: '清空成功'
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '清空购物车失败',
      code: 'CLEAR_CART_FAILED'
    });
  }
});

// 获取购物车商品数量
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const redisClient = getRedisClient();

    const cartKey = `cart:${userId}`;
    const cartItems = await redisClient.hGetAll(cartKey);

    let totalCount = 0;
    for (const quantity of Object.values(cartItems)) {
      totalCount += parseInt(quantity);
    }

    res.json({
      code: 200,
      data: { count: totalCount }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取购物车数量失败',
      code: 'GET_CART_COUNT_FAILED'
    });
  }
});

// 检查购物车商品状态
router.post('/check', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    const cartKey = `cart:${userId}`;
    const cartItems = await redisClient.hGetAll(cartKey);

    if (Object.keys(cartItems).length === 0) {
      return res.json({
        code: 200,
        data: {
          validItems: [],
          invalidItems: [],
          totalAmount: 0
        }
      });
    }

    // 检查商品状态和库存
    const productIds = Object.keys(cartItems);
    const [products] = await pool.execute(
      'SELECT id, name, price, stock, status FROM products WHERE id IN (?)',
      [productIds]
    );

    const validItems = [];
    const invalidItems = [];
    let totalAmount = 0;

    for (const product of products) {
      const quantity = parseInt(cartItems[product.id]);
      const item = {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        quantity,
        subtotal: parseFloat(product.price) * quantity
      };

      if (product.status === 1 && product.stock >= quantity) {
        validItems.push(item);
        totalAmount += item.subtotal;
      } else {
        item.reason = product.status !== 1 ? '商品已下架' : '库存不足';
        invalidItems.push(item);
      }
    }

    res.json({
      code: 200,
      data: {
        validItems,
        invalidItems,
        totalAmount: Math.round(totalAmount * 100) / 100
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '检查购物车失败',
      code: 'CHECK_CART_FAILED'
    });
  }
});

// 辅助函数：从购物车删除商品
async function removeFromCart(req, res) {
  try {
    const { product_id } = req.body;
    const userId = req.user.id;
    const redisClient = getRedisClient();

    const cartKey = `cart:${userId}`;
    const removed = await redisClient.hDel(cartKey, product_id.toString());

    if (removed === 0) {
      return res.status(404).json({
        error: '商品不在购物车中',
        code: 'ITEM_NOT_IN_CART'
      });
    }

    logger.logBusiness('购物车操作', {
      userId,
      productId: product_id,
      action: 'remove'
    });

    res.json({
      code: 200,
      message: '删除成功',
      data: { product_id }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '删除商品失败',
      code: 'REMOVE_FROM_CART_FAILED'
    });
  }
}

module.exports = router;