// routes/upload.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');

// 配置multer
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * 上传图片
 * POST /api/upload/image
 */
router.post('/image', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // TODO: 实现图片上传到阿里云OSS
    res.json({
      code: 200,
      message: '图片上传成功',
      data: {
        url: 'https://example.com/mock-image.jpg'
      }
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: '图片上传失败'
    });
  }
});

module.exports = router;