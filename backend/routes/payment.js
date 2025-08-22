// routes/payment.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/**
 * 创建支付订单
 * POST /api/payment/create
 */
router.post('/create', authenticateToken, async (req, res) => {
  try {
    // TODO: 实现微信支付订单创建
    res.json({
      code: 200,
      message: '支付订单创建成功',
      data: {
        prepay_id: 'mock_prepay_id',
        package: 'prepay_id=mock_prepay_id'
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '支付订单创建失败'
    });
  }
});

/**
 * 支付回调
 * POST /api/payment/notify
 */
router.post('/notify', async (req, res) => {
  try {
    // TODO: 实现支付回调处理
    res.send('SUCCESS');
  } catch (error) {
    res.send('FAIL');
  }
});

module.exports = router;