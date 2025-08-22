// routes/payment.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validationResult, body } = require('express-validator');
const database = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * 创建微信支付订单
 * POST /api/payment/create
 */
router.post('/create', 
  authenticateToken,
  [
    body('order_id').isInt({ min: 1 }).withMessage('订单ID无效'),
    body('amount').isFloat({ min: 0.01 }).withMessage('支付金额无效'),
    body('method').isIn(['wechat', 'alipay']).withMessage('支付方式无效')
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

      const { order_id, amount, method } = req.body;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        // 验证订单
        const [orderRows] = await connection.execute(
          'SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = ?',
          [order_id, userId, 'pending']
        );

        if (orderRows.length === 0) {
          throw new Error('订单不存在或状态不正确');
        }

        const order = orderRows[0];

        // 验证金额
        if (parseFloat(order.final_amount) !== parseFloat(amount)) {
          throw new Error('支付金额不匹配');
        }

        // 创建支付记录
        const [paymentResult] = await connection.execute(
          `INSERT INTO payments (
            order_id, user_id, amount, method, status, created_at
          ) VALUES (?, ?, ?, ?, ?, NOW())`,
          [order_id, userId, amount, method, 'pending']
        );

        const paymentId = paymentResult.insertId;

        // 生成支付参数（这里模拟微信支付参数）
        const paymentParams = generateWechatPayParams(order, paymentId);

        await connection.commit();

        logger.info('支付订单创建成功', {
          userId,
          orderId: order_id,
          paymentId,
          method
        });

        res.json({
          code: 200,
          message: '支付订单创建成功',
          data: paymentParams
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('创建支付订单失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '创建支付订单失败'
      });
    }
  }
);

/**
 * 余额支付
 * POST /api/payment/balance
 */
router.post('/balance',
  authenticateToken,
  [
    body('order_id').isInt({ min: 1 }).withMessage('订单ID无效'),
    body('amount').isFloat({ min: 0.01 }).withMessage('支付金额无效')
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

      const { order_id, amount } = req.body;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        await connection.beginTransaction();

        // 验证订单
        const [orderRows] = await connection.execute(
          'SELECT * FROM orders WHERE id = ? AND user_id = ? AND status = ?',
          [order_id, userId, 'pending']
        );

        if (orderRows.length === 0) {
          throw new Error('订单不存在或状态不正确');
        }

        const order = orderRows[0];

        // 验证金额
        if (parseFloat(order.final_amount) !== parseFloat(amount)) {
          throw new Error('支付金额不匹配');
        }

        // 检查用户余额
        const [userRows] = await connection.execute(
          'SELECT balance FROM users WHERE id = ?',
          [userRows.length === 0] {
          throw new Error('用户不存在');
        }

        const userBalance = parseFloat(userRows[0].balance || 0);
        if (userBalance < parseFloat(amount)) {
          throw new Error('余额不足');
        }

        // 扣除余额
        await connection.execute(
          'UPDATE users SET balance = balance - ? WHERE id = ?',
          [amount, userId]
        );

        // 创建支付记录
        await connection.execute(
          `INSERT INTO payments (
            order_id, user_id, amount, method, status, created_at
          ) VALUES (?, ?, ?, ?, ?, method, 'success')`,
          [order_id, userId, amount, 'balance', 'success']
        );

        // 更新订单状态
        await connection.execute(
          'UPDATE orders SET status = ? WHERE id = ?',
          ['paid', order_id]
        );

        await connection.commit();

        logger.info('余额支付成功', {
          userId,
          orderId: order_id,
          amount
        });

        res.json({
          code: 200,
          message: '支付成功',
          data: { payment_id: paymentId }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('余额支付失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '余额支付失败'
      });
    }
  }
);

/**
 * 支付回调处理
 * POST /api/payment/notify
 */
router.post('/notify', async (req, res) => {
  try {
    const { payment_id, status, transaction_id } = req.body;

    if (!payment_id || !status) {
      return res.status(400).json({
        code: 400,
        message: '回调参数不完整'
      });
    }

    const connection = await database.getConnection();

    try {
      await connection.beginTransaction();

      // 更新支付状态
      await connection.execute(
        'UPDATE payments SET status = ?, transaction_id = ?, updated_at = NOW() WHERE id = ?',
        [status, transaction_id, payment_id]
      );

      // 获取支付信息
      const [paymentRows] = await connection.execute(
        'SELECT * FROM payments WHERE id = ?',
        [payment_id]
      );

      if (paymentRows.length === 0) {
        throw new Error('支付记录不存在');
      }

      const payment = paymentRows[0];

      // 如果支付成功，更新订单状态
      if (status === 'success') {
        await connection.execute(
          'UPDATE orders SET status = ? WHERE id = ?',
          ['paid', payment.order_id]
        );
      }

      await connection.commit();

      logger.info('支付回调处理成功', {
        paymentId: payment_id,
        status,
        transactionId: transaction_id
      });

      res.json({
        code: 200,
        message: '支付回调处理成功'
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('支付回调处理失败', { error: error.message });
    res.status(500).json({
      code: 500,
      message: '支付回调处理失败'
    });
  }
});

/**
 * 生成微信支付参数
 */
function generateWechatPayParams(order, paymentId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const package = `prepay_id=${paymentId}`;
  
  // 这里应该调用微信支付API获取真实的支付参数
  // 目前返回模拟数据
  return {
    timeStamp: timestamp.toString(),
    nonceStr: nonceStr,
    package: package,
    signType: 'MD5',
    paySign: crypto.createHash('md5').update(`${timestamp}${nonceStr}${package}`).digest('hex')
  };
}

module.exports = router;