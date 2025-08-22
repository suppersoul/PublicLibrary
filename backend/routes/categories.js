// routes/categories.js
const express = require('express');
const router = express.Router();

/**
 * 获取分类列表
 * GET /api/categories/list
 */
router.get('/list', async (req, res) => {
  try {
    // TODO: 实现分类列表获取
    res.json({
      code: 200,
      message: '获取分类列表成功',
      data: []
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '获取分类列表失败'
    });
  }
});

module.exports = router;