// routes/reviews.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validationResult, body, param, query } = require('express-validator');
const database = require('../config/database');
const logger = require('../utils/logger');

/**
 * 创建商品评价
 * POST /api/reviews
 */
router.post('/',
  authenticateToken,
  [
    body('order_id').isInt({ min: 1 }).withMessage('订单ID无效'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('评分必须在1-5之间'),
    body('content').isLength({ min: 1, max: 500 }).withMessage('评价内容长度必须在1-500字符之间'),
    body('tags').optional().isArray().withMessage('标签必须是数组'),
    body('images').optional().isArray().withMessage('图片必须是数组'),
    body('is_anonymous').optional().isBoolean().withMessage('匿名标识必须是布尔值')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 400,
          message: '参数验证失败',
          errors: errors.array()
        });
      }

      const { 
        order_id, 
        rating, 
        content, 
        tags = [], 
        images = [], 
        is_anonymous = false 
      } = req.body;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        // 检查订单是否存在且属于当前用户
        const [orderRows] = await connection.execute(
          'SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = "delivered"',
          [order_id, userId]
        );

        if (orderRows.length === 0) {
          throw new Error('订单不存在或状态不正确');
        }

        const order = orderRows[0];

        // 检查是否已经评价过
        const [existingReviewRows] = await connection.execute(
          'SELECT id FROM reviews WHERE order_id = ?',
          [order_id]
        );

        if (existingReviewRows.length > 0) {
          throw new Error('该订单已经评价过了');
        }

        // 创建评价
        const [result] = await connection.execute(
          `INSERT INTO reviews (
            user_id, order_id, rating, content, tags, images, 
            is_anonymous, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            userId, 
            order_id, 
            rating, 
            content, 
            JSON.stringify(tags), 
            JSON.stringify(images), 
            is_anonymous
          ]
        );

        const reviewId = result.insertId;

        // 更新订单状态为已评价
        await connection.execute(
          'UPDATE orders SET status = "completed", updated_at = NOW() WHERE id = ?',
          [order_id]
        );

        // 更新商品评分
        await this.updateProductRating(connection, order_id);

        await connection.commit();

        logger.info('创建评价成功', {
          userId,
          orderId: order_id,
          reviewId,
          rating
        });

        res.json({
          code: 200,
          message: '评价提交成功',
          data: { id: reviewId }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('创建评价失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '评价提交失败'
      });
    }
  }
);

/**
 * 获取商品评价列表
 * GET /api/reviews
 */
router.get('/',
  [
    query('product_id').optional().isInt({ min: 1 }).withMessage('商品ID无效'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码无效'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量无效'),
    query('rating').optional().isInt({ min: 1, max: 5 }).withMessage('评分无效')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 400,
          message: '参数验证失败',
          errors: errors.array()
        });
      }

      const { product_id, page = 1, limit = 20, rating } = req.query;
      const offset = (page - 1) * limit;

      const connection = await database.getConnection();

      try {
        let whereClause = 'WHERE r.deleted_at IS NULL';
        let params = [];

        if (product_id) {
          whereClause += ' AND oi.product_id = ?';
          params.push(product_id);
        }

        if (rating) {
          whereClause += ' AND r.rating = ?';
          params.push(rating);
        }

        // 获取评价列表
        const [reviews] = await connection.execute(
          `SELECT 
            r.id, r.rating, r.content, r.tags, r.images, 
            r.is_anonymous, r.created_at,
            u.nickname, u.avatar,
            oi.product_id, oi.product_name, oi.spec_name
           FROM reviews r
           LEFT JOIN users u ON r.user_id = u.id
           LEFT JOIN order_items oi ON r.order_id = oi.order_id
           ${whereClause}
           ORDER BY r.created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, parseInt(limit), offset]
        );

        // 获取总数
        const [countResult] = await connection.execute(
          `SELECT COUNT(*) as total 
           FROM reviews r
           LEFT JOIN order_items oi ON r.order_id = oi.order_id
           ${whereClause}`,
          params
        );

        const total = countResult[0].total;

        // 处理评价数据
        const processedReviews = reviews.map(review => {
          // 处理匿名用户
          if (review.is_anonymous) {
            review.nickname = '匿名用户';
            review.avatar = '/images/default-avatar.png';
          }

          // 解析标签和图片
          if (review.tags) {
            review.tags = JSON.parse(review.tags);
          }
          if (review.images) {
            review.images = JSON.parse(review.images);
          }

          // 格式化时间
          if (review.created_at) {
            review.created_at = new Date(review.created_at).toLocaleDateString('zh-CN');
          }

          return review;
        });

        res.json({
          code: 200,
          message: '获取评价列表成功',
          data: processedReviews,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            pages: Math.ceil(total / limit)
          }
        });

      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('获取评价列表失败', { error: error.message });
      res.status(500).json({
        code: 500,
        message: '获取评价列表失败'
      });
    }
  }
);

/**
 * 获取评价详情
 * GET /api/reviews/:id
 */
router.get('/:id',
  [
    param('id').isInt({ min: 1 }).withMessage('评价ID无效')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 400,
          message: '参数验证失败',
          errors: errors.array()
        });
      }

      const reviewId = req.params.id;

      const connection = await database.getConnection();

      try {
        // 获取评价详情
        const [reviewRows] = await connection.execute(
          `SELECT 
            r.id, r.rating, r.content, r.tags, r.images, 
            r.is_anonymous, r.created_at, r.updated_at,
            u.nickname, u.avatar,
            oi.product_id, oi.product_name, oi.spec_name,
            o.order_no
           FROM reviews r
           LEFT JOIN users u ON r.user_id = u.id
           LEFT JOIN order_items oi ON r.order_id = oi.order_id
           LEFT JOIN orders o ON r.order_id = o.id
           WHERE r.id = ? AND r.deleted_at IS NULL`,
          [reviewId]
        );

        if (reviewRows.length === 0) {
          return res.status(404).json({
            code: 404,
            message: '评价不存在'
          });
        }

        const review = reviewRows[0];

        // 处理匿名用户
        if (review.is_anonymous) {
          review.nickname = '匿名用户';
          review.avatar = '/images/default-avatar.png';
        }

        // 解析标签和图片
        if (review.tags) {
          review.tags = JSON.parse(review.tags);
        }
        if (review.images) {
          review.images = JSON.parse(review.images);
        }

        // 格式化时间
        if (review.created_at) {
          review.created_at = new Date(review.created_at).toLocaleDateString('zh-CN');
        }
        if (review.updated_at) {
          review.updated_at = new Date(review.updated_at).toLocaleDateString('zh-CN');
        }

        res.json({
          code: 200,
          message: '获取评价详情成功',
          data: review
        });

      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('获取评价详情失败', { error: error.message, reviewId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '获取评价详情失败'
      });
    }
  }
);

/**
 * 删除评价
 * DELETE /api/reviews/:id
 */
router.delete('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('评价ID无效')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          code: 400,
          message: '参数验证失败',
          errors: errors.array()
        });
      }

      const reviewId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        // 检查评价是否存在且属于当前用户
        const [reviewRows] = await connection.execute(
          'SELECT * FROM reviews WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [reviewId, userId]
        );

        if (reviewRows.length === 0) {
          return res.status(404).json({
            code: 404,
            message: '评价不存在或无权限删除'
          });
        }

        // 软删除评价
        await connection.execute(
          'UPDATE reviews SET deleted_at = NOW() WHERE id = ?',
          [reviewId]
        );

        await connection.commit();

        logger.info('删除评价成功', {
          userId,
          reviewId
        });

        res.json({
          code: 200,
          message: '删除评价成功'
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('删除评价失败', { error: error.message, reviewId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '删除评价失败'
      });
    }
  }
);

/**
 * 更新商品评分
 */
async function updateProductRating(connection, orderId) {
  try {
    // 获取订单中所有商品的评分
    const [reviews] = await connection.execute(
      `SELECT oi.product_id, AVG(r.rating) as avg_rating, COUNT(r.id) as review_count
       FROM reviews r
       LEFT JOIN order_items oi ON r.order_id = oi.order_id
       WHERE r.deleted_at IS NULL
       GROUP BY oi.product_id`
    );

    // 更新商品评分
    for (const review of reviews) {
      await connection.execute(
        'UPDATE products SET rating = ?, review_count = ? WHERE id = ?',
        [review.avg_rating, review.review_count, review.product_id]
      );
    }
  } catch (error) {
    logger.error('更新商品评分失败', { error: error.message, orderId });
  }
}

module.exports = router;