// routes/orders.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validationResult, body, param, query } = require('express-validator');
const database = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const moment = require('moment');

/**
 * 创建订单
 * POST /api/orders
 */
router.post('/', 
  authenticateToken,
  [
    body('items').isArray({ min: 1 }).withMessage('订单商品不能为空'),
    body('items.*.product_id').isInt({ min: 1 }).withMessage('商品ID无效'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('商品数量无效'),
    body('items.*.price').isFloat({ min: 0 }).withMessage('商品价格无效'),
    body('address_id').isInt({ min: 1 }).withMessage('收货地址ID无效'),
    body('delivery_fee').optional().isFloat({ min: 0 }).withMessage('配送费无效'),
    body('coupon_id').optional().isInt({ min: 1 }).withMessage('优惠券ID无效'),
    body('remark').optional().isString().isLength({ max: 200 }).withMessage('备注长度不能超过200字符')
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

      const { items, address_id, delivery_fee = 0, coupon_id, remark = '' } = req.body;
      const userId = req.user.id;
      
      const connection = await database.getConnection();
      
      try {
        await connection.beginTransaction();

        // 1. 验证收货地址
        const [addressRows] = await connection.execute(
          'SELECT * FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [address_id, userId]
        );

        if (addressRows.length === 0) {
          throw new Error('收货地址不存在');
        }

        const address = addressRows[0];

        // 2. 验证商品和库存
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
          const [productRows] = await connection.execute(
            'SELECT id, name, price, stock, status FROM products WHERE id = ? AND status = "active"',
            [item.product_id]
          );

          if (productRows.length === 0) {
            throw new Error(`商品 ${item.product_id} 不存在或已下架`);
          }

          const product = productRows[0];

          // 检查库存
          if (product.stock < item.quantity) {
            throw new Error(`商品 ${product.name} 库存不足`);
          }

          // 验证价格（防止前端篡改）
          if (Math.abs(parseFloat(item.price) - parseFloat(product.price)) > 0.01) {
            throw new Error(`商品 ${product.name} 价格已变更，请重新加入购物车`);
          }

          const itemTotal = parseFloat(item.price) * item.quantity;
          totalAmount += itemTotal;

          orderItems.push({
            product_id: item.product_id,
            product_name: product.name,
            product_image: item.product_image || '',
            sku_id: item.sku_id || null,
            spec_name: item.spec_name || '',
            price: item.price,
            quantity: item.quantity,
            total_amount: itemTotal
          });
        }

        // 3. 处理优惠券
        let discountAmount = 0;
        if (coupon_id) {
          const [couponRows] = await connection.execute(
            `SELECT c.*, uc.id as user_coupon_id 
             FROM coupons c 
             JOIN user_coupons uc ON c.id = uc.coupon_id 
             WHERE c.id = ? AND uc.user_id = ? AND uc.status = 'unused' 
             AND c.start_time <= NOW() AND c.end_time >= NOW() 
             AND c.min_amount <= ?`,
            [coupon_id, userId, totalAmount]
          );

          if (couponRows.length > 0) {
            const coupon = couponRows[0];
            if (coupon.type === 'fixed') {
              discountAmount = Math.min(coupon.amount, totalAmount);
            } else if (coupon.type === 'percent') {
              discountAmount = Math.min(totalAmount * coupon.amount / 100, coupon.max_amount || totalAmount);
            }

            // 标记优惠券为已使用
            await connection.execute(
              'UPDATE user_coupons SET status = "used", used_at = NOW() WHERE id = ?',
              [coupon.user_coupon_id]
            );
          }
        }

        const finalAmount = Math.max(0, totalAmount + delivery_fee - discountAmount);

        // 4. 生成订单号
        const orderNo = generateOrderNo();

        // 5. 创建订单
        const [orderResult] = await connection.execute(
          `INSERT INTO orders (
            order_no, user_id, total_amount, discount_amount, delivery_fee, final_amount,
            address_id, receiver_name, receiver_phone, receiver_address,
            coupon_id, remark, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
          [
            orderNo, userId, totalAmount, discountAmount, delivery_fee, finalAmount,
            address_id, address.receiver_name, address.receiver_phone, 
            `${address.province} ${address.city} ${address.district} ${address.detail}`,
            coupon_id, remark
          ]
        );

        const orderId = orderResult.insertId;

        // 6. 创建订单商品
        for (const item of orderItems) {
          await connection.execute(
            `INSERT INTO order_items (
              order_id, product_id, product_name, product_image, sku_id, spec_name,
              price, quantity, total_amount, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              orderId, item.product_id, item.product_name, item.product_image,
              item.sku_id, item.spec_name, item.price, item.quantity, item.total_amount
            ]
          );

          // 7. 减少库存
          await connection.execute(
            'UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?',
            [item.quantity, item.quantity, item.product_id]
          );
        }

        // 8. 清空购物车中的对应商品
        const productIds = items.map(item => item.product_id);
        if (productIds.length > 0) {
          const placeholders = productIds.map(() => '?').join(',');
          await connection.execute(
            `DELETE FROM cart WHERE user_id = ? AND product_id IN (${placeholders})`,
            [userId, ...productIds]
          );
        }

        await connection.commit();

        logger.info('订单创建成功', {
          userId,
          orderId,
          orderNo,
          finalAmount
        });

        res.json({
          code: 200,
          message: '订单创建成功',
          data: {
            order_id: orderId,
            order_no: orderNo,
            final_amount: finalAmount
          }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('创建订单失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '创建订单失败'
      });
    }
  }
);

/**
 * 获取订单列表
 * GET /api/orders
 */
router.get('/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码无效'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('每页数量无效'),
    query('status').optional().isIn(['pending', 'paid', 'shipped', 'delivered', 'completed', 'cancelled']).withMessage('订单状态无效')
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

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;
      const userId = req.user.id;
      
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE o.user_id = ? AND o.deleted_at IS NULL';
      let params = [userId];
      
      if (status) {
        whereClause += ' AND o.status = ?';
        params.push(status);
      }

      const connection = await database.getConnection();

      // 获取订单列表
      const [orders] = await connection.execute(
        `SELECT 
          o.id, o.order_no, o.status, o.total_amount, o.discount_amount, 
          o.delivery_fee, o.final_amount, o.receiver_name, o.receiver_phone,
          o.receiver_address, o.remark, o.paid_at, o.shipped_at, 
          o.delivered_at, o.created_at,
          COUNT(oi.id) as item_count
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         ${whereClause}
         GROUP BY o.id
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      // 获取总数
      const [countResult] = await connection.execute(
        `SELECT COUNT(DISTINCT o.id) as total FROM orders o ${whereClause}`,
        params
      );

      const total = countResult[0].total;

      // 获取订单商品
      for (const order of orders) {
        const [items] = await connection.execute(
          `SELECT product_id, product_name, product_image, sku_id, spec_name,
                  price, quantity, total_amount
           FROM order_items 
           WHERE order_id = ?`,
          [order.id]
        );
        order.items = items;
      }

      connection.release();

      res.json({
        code: 200,
        message: '获取订单列表成功',
        data: orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('获取订单列表失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: '获取订单列表失败'
      });
    }
  }
);

/**
 * 获取订单详情
 * GET /api/orders/:id
 */
router.get('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('订单ID无效')
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

      const orderId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      // 获取订单基本信息
      const [orderRows] = await connection.execute(
        `SELECT * FROM orders 
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        [orderId, userId]
      );

      if (orderRows.length === 0) {
        connection.release();
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      const order = orderRows[0];

      // 获取订单商品
      const [items] = await connection.execute(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [orderId]
      );

      order.items = items;

      // 获取物流信息（如果有）
      const [logistics] = await connection.execute(
        `SELECT * FROM order_logistics WHERE order_id = ? ORDER BY created_at DESC`,
        [orderId]
      );

      order.logistics = logistics;

      connection.release();

      res.json({
        code: 200,
        message: '获取订单详情成功',
        data: order
      });

    } catch (error) {
      logger.error('获取订单详情失败', { error: error.message, orderId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '获取订单详情失败'
      });
    }
  }
);

/**
 * 取消订单
 * PUT /api/orders/:id/cancel
 */
router.put('/:id/cancel',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('订单ID无效'),
    body('reason').optional().isString().isLength({ max: 200 }).withMessage('取消原因长度不能超过200字符')
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

      const orderId = req.params.id;
      const userId = req.user.id;
      const reason = req.body.reason || '用户取消';

      const connection = await database.getConnection();

      try {
        await connection.beginTransaction();

        // 检查订单状态
        const [orderRows] = await connection.execute(
          'SELECT * FROM orders WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [orderId, userId]
        );

        if (orderRows.length === 0) {
          throw new Error('订单不存在');
        }

        const order = orderRows[0];

        if (!['pending', 'paid'].includes(order.status)) {
          throw new Error('订单状态不允许取消');
        }

        // 更新订单状态
        await connection.execute(
          'UPDATE orders SET status = "cancelled", cancel_reason = ?, cancelled_at = NOW() WHERE id = ?',
          [reason, orderId]
        );

        // 恢复库存
        const [orderItems] = await connection.execute(
          'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
          [orderId]
        );

        for (const item of orderItems) {
          await connection.execute(
            'UPDATE products SET stock = stock + ?, sales = sales - ? WHERE id = ?',
            [item.quantity, item.quantity, item.product_id]
          );
        }

        // 如果已支付，退回优惠券
        if (order.status === 'paid' && order.coupon_id) {
          await connection.execute(
            'UPDATE user_coupons SET status = "unused", used_at = NULL WHERE coupon_id = ? AND user_id = ?',
            [order.coupon_id, userId]
          );
        }

        await connection.commit();

        logger.info('订单取消成功', {
          userId,
          orderId,
          reason
        });

        res.json({
          code: 200,
          message: '订单取消成功'
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('取消订单失败', { error: error.message, orderId: req.params.id });
      res.status(500).json({
        code: 500,
        message: error.message || '取消订单失败'
      });
    }
  }
);

/**
 * 确认收货
 * PUT /api/orders/:id/confirm
 */
router.put('/:id/confirm',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('订单ID无效')
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

      const orderId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      // 检查订单状态
      const [orderRows] = await connection.execute(
        'SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = "shipped" AND deleted_at IS NULL',
        [orderId, userId]
      );

      if (orderRows.length === 0) {
        connection.release();
        return res.status(400).json({
          code: 400,
          message: '订单状态不允许确认收货'
        });
      }

      // 更新订单状态
      await connection.execute(
        'UPDATE orders SET status = "delivered", delivered_at = NOW() WHERE id = ?',
        [orderId]
      );

      connection.release();

      logger.info('确认收货成功', {
        userId,
        orderId
      });

      res.json({
        code: 200,
        message: '确认收货成功'
      });

    } catch (error) {
      logger.error('确认收货失败', { error: error.message, orderId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '确认收货失败'
      });
    }
  }
);

/**
 * 删除订单
 * DELETE /api/orders/:id
 */
router.delete('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('订单ID无效')
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

      const orderId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      // 检查订单状态
      const [orderRows] = await connection.execute(
        'SELECT status FROM orders WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [orderId, userId]
      );

      if (orderRows.length === 0) {
        connection.release();
        return res.status(404).json({
          code: 404,
          message: '订单不存在'
        });
      }

      const order = orderRows[0];

      if (!['cancelled', 'completed', 'delivered'].includes(order.status)) {
        connection.release();
        return res.status(400).json({
          code: 400,
          message: '订单状态不允许删除'
        });
      }

      // 软删除订单
      await connection.execute(
        'UPDATE orders SET deleted_at = NOW() WHERE id = ?',
        [orderId]
      );

      connection.release();

      logger.info('删除订单成功', {
        userId,
        orderId
      });

      res.json({
        code: 200,
        message: '删除订单成功'
      });

    } catch (error) {
      logger.error('删除订单失败', { error: error.message, orderId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '删除订单失败'
      });
    }
  }
);

/**
 * 生成订单号
 */
function generateOrderNo() {
  const now = moment();
  const timestamp = now.format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${timestamp}${random}`;
}

module.exports = router;