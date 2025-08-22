// routes/users.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

/**
 * 获取用户信息
 * GET /api/users/profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // TODO: 实现用户信息获取
    res.json({
      code: 200,
      message: '获取用户信息成功',
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取用户信息失败'
    });
  }
});

/**
 * 更新用户信息
 * PUT /api/users/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    // TODO: 实现用户信息更新
    res.json({
      code: 200,
      message: '更新用户信息成功'
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '更新用户信息失败'
    });
  }
});

module.exports = router;