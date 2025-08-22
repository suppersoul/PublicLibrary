// routes/coupons.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/**
 * 获取用户优惠券列表
 * GET /api/coupons
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // TODO: 实现用户优惠券列表获取
    res.json({
      code: 200,
      message: '获取优惠券列表成功',
      data: []
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取优惠券列表失败'
    });
  }
});

/**
 * 领取优惠券
 * POST /api/coupons/:id/claim
 */
router.post('/:id/claim', authenticateToken, async (req, res) => {
  try {
    // TODO: 实现优惠券领取
    res.json({
      code: 200,
      message: '优惠券领取成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '优惠券领取失败'
    });
  }
});

module.exports = router;