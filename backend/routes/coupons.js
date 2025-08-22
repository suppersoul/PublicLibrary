// routes/coupons.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validationResult, query, param } = require('express-validator');
const database = require('../config/database');
const logger = require('../utils/logger');

/**
 * 获取用户优惠券列表
 * GET /api/coupons
 */
router.get('/', 
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码无效'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量无效'),
    query('status').optional().isIn(['all', 'available', 'used', 'expired']).withMessage('状态无效')
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

      const userId = req.user.id;
      const { page = 1, limit = 20, status = 'all' } = req.query;
      
      const offset = (page - 1) * limit;
      
      const connection = await database.getConnection();

      try {
        let whereClause = 'WHERE uc.user_id = ?';
        let params = [userId];

        // 根据状态筛选
        if (status === 'available') {
          whereClause += ' AND uc.status = "available" AND c.expire_date > NOW()';
        } else if (status === 'used') {
          whereClause += ' AND uc.status = "used"';
        } else if (status === 'expired') {
          whereClause += ' AND (uc.status = "expired" OR c.expire_date <= NOW())';
        }

        // 获取优惠券列表
        const [coupons] = await connection.execute(
          `SELECT 
            uc.id, uc.status, uc.used_at, uc.created_at,
            c.name, c.description, c.type, c.discount_amount, c.discount_rate,
            c.min_amount, c.max_discount, c.expire_date, c.usage_instructions,
            c.category_id, c.product_ids
           FROM user_coupons uc
           LEFT JOIN coupons c ON uc.coupon_id = c.id
           ${whereClause}
           ORDER BY uc.created_at DESC
           LIMIT ? OFFSET ?`,
          [...params, parseInt(limit), offset]
        );

        // 获取总数
        const [countResult] = await connection.execute(
          `SELECT COUNT(*) as total 
           FROM user_coupons uc
           LEFT JOIN coupons c ON uc.coupon_id = c.id
           ${whereClause}`,
          params
        );

        const total = countResult[0].total;

        // 处理优惠券数据
        const processedCoupons = coupons.map(coupon => {
          // 检查是否过期
          if (coupon.status === 'available' && new Date(coupon.expire_date) <= new Date()) {
            coupon.status = 'expired';
          }

          // 格式化日期
          if (coupon.expire_date) {
            coupon.expire_date = new Date(coupon.expire_date).toLocaleDateString('zh-CN');
          }
          if (coupon.used_at) {
            coupon.used_at = new Date(coupon.used_at).toLocaleDateString('zh-CN');
          }
          if (coupon.created_at) {
            coupon.created_at = new Date(coupon.created_at).toLocaleDateString('zh-CN');
          }

          return coupon;
        });

        res.json({
          code: 200,
          message: '获取优惠券列表成功',
          data: processedCoupons,
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
      logger.error('获取优惠券列表失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: '获取优惠券列表失败'
      });
    }
  }
);

/**
 * 获取优惠券详情
 * GET /api/coupons/:id
 */
router.get('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('优惠券ID无效')
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

      const couponId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        // 获取优惠券详情
        const [couponRows] = await connection.execute(
          `SELECT 
            uc.id, uc.status, uc.used_at, uc.created_at,
            c.name, c.description, c.type, c.discount_amount, c.discount_rate,
            c.min_amount, c.max_discount, c.expire_date, c.usage_instructions,
            c.category_id, c.product_ids
           FROM user_coupons uc
           LEFT JOIN coupons c ON uc.coupon_id = c.id
           WHERE uc.id = ? AND uc.user_id = ?`,
          [couponId, userId]
        );

        if (couponRows.length === 0) {
          return res.status(404).json({
            code: 404,
            message: '优惠券不存在'
          });
        }

        const coupon = couponRows[0];

        // 检查是否过期
        if (coupon.status === 'available' && new Date(coupon.expire_date) <= new Date()) {
          coupon.status = 'expired';
        }

        // 格式化日期
        if (coupon.expire_date) {
          coupon.expire_date = new Date(coupon.expire_date).toLocaleDateString('zh-CN');
        }
        if (coupon.used_at) {
          coupon.used_at = new Date(coupon.used_at).toLocaleDateString('zh-CN');
        }
        if (coupon.created_at) {
          coupon.created_at = new Date(coupon.created_at).toLocaleDateString('zh-CN');
        }

        res.json({
          code: 200,
          message: '获取优惠券详情成功',
          data: coupon
        });

      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('获取优惠券详情失败', { error: error.message, couponId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '获取优惠券详情失败'
      });
    }
  }
);

/**
 * 领取优惠券
 * POST /api/coupons/receive
 */
router.post('/receive',
  authenticateToken,
  async (req, res) => {
    try {
      const { coupon_id } = req.body;
      const userId = req.user.id;

      if (!coupon_id) {
        return res.status(400).json({
          code: 400,
          message: '优惠券ID不能为空'
        });
      }

      const connection = await database.getConnection();

      try {
        // 检查优惠券是否存在且有效
        const [couponRows] = await connection.execute(
          'SELECT * FROM coupons WHERE id = ? AND status = "active" AND expire_date > NOW()',
          [coupon_id]
        );

        if (couponRows.length === 0) {
          throw new Error('优惠券不存在或已过期');
        }

        const coupon = couponRows[0];

        // 检查是否已经领取过
        const [existingRows] = await connection.execute(
          'SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
          [userId, coupon_id]
        );

        if (existingRows.length > 0) {
          throw new Error('您已经领取过此优惠券');
        }

        // 检查优惠券数量限制
        if (coupon.quantity_limit > 0) {
          const [receivedCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM user_coupons WHERE coupon_id = ?',
            [coupon_id]
          );

          if (receivedCount[0].count >= coupon.quantity_limit) {
            throw new Error('优惠券已被领完');
        }
        }

        // 领取优惠券
        const [result] = await connection.execute(
          'INSERT INTO user_coupons (user_id, coupon_id, status, created_at) VALUES (?, ?, "available", NOW())',
          [userId, coupon_id]
        );

        const userCouponId = result.insertId;

        await connection.commit();

        logger.info('领取优惠券成功', {
          userId,
          couponId: coupon_id,
          userCouponId
        });

        res.json({
          code: 200,
          message: '领取优惠券成功',
          data: { id: userCouponId }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('领取优惠券失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '领取优惠券失败'
      });
    }
  }
);

/**
 * 获取可用优惠券（用于订单确认页面）
 * GET /api/coupons/available
 */
router.get('/available',
  authenticateToken,
  [
    query('amount').isFloat({ min: 0 }).withMessage('订单金额无效'),
    query('category_id').optional().isInt({ min: 1 }).withMessage('分类ID无效'),
    query('product_ids').optional().isArray().withMessage('商品ID列表无效')
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

      const userId = req.user.id;
      const { amount, category_id, product_ids } = req.query;
      const orderAmount = parseFloat(amount);

      const connection = await database.getConnection();

      try {
        // 获取用户可用的优惠券
        const [coupons] = await connection.execute(
          `SELECT 
            uc.id, uc.status, uc.created_at,
            c.name, c.description, c.type, c.discount_amount, c.discount_rate,
            c.min_amount, c.max_discount, c.expire_date, c.usage_instructions,
            c.category_id, c.product_ids
           FROM user_coupons uc
           LEFT JOIN coupons c ON uc.coupon_id = c.id
           WHERE uc.user_id = ? 
           AND uc.status = "available" 
           AND c.expire_date > NOW()
           AND c.min_amount <= ?
           ORDER BY c.discount_amount DESC, c.created_at DESC`,
          [userId, orderAmount]
        );

        // 筛选符合条件的优惠券
        const availableCoupons = coupons.filter(coupon => {
          // 检查分类限制
          if (coupon.category_id && category_id && coupon.category_id != category_id) {
            return false;
          }

          // 检查商品限制
          if (coupon.product_ids && product_ids) {
            const allowedProductIds = JSON.parse(coupon.product_ids);
            const hasMatchingProduct = product_ids.some(id => allowedProductIds.includes(parseInt(id)));
            if (!hasMatchingProduct) {
              return false;
            }
          }

          return true;
        });

        // 计算优惠金额
        const processedCoupons = availableCoupons.map(coupon => {
          let discountAmount = 0;
          
          if (coupon.type === 'discount') {
            // 满减券
            discountAmount = coupon.discount_amount;
          } else if (coupon.type === 'rate') {
            // 折扣券
            discountAmount = orderAmount * (1 - coupon.discount_rate / 100);
            if (coupon.max_discount > 0) {
              discountAmount = Math.min(discountAmount, coupon.max_discount);
            }
          }

          return {
            ...coupon,
            discount_amount: discountAmount,
            expire_date: new Date(coupon.expire_date).toLocaleDateString('zh-CN'),
            created_at: new Date(coupon.created_at).toLocaleDateString('zh-CN')
          };
        });

        res.json({
          code: 200,
          message: '获取可用优惠券成功',
          data: processedCoupons
        });

      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('获取可用优惠券失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: '获取可用优惠券失败'
      });
    }
  }
);

module.exports = router;