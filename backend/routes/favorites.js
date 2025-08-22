// routes/favorites.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validationResult, body, param } = require('express-validator');
const database = require('../config/database');
const logger = require('../utils/logger');

/**
 * 获取用户收藏列表
 * GET /api/favorites
 */
router.get('/', 
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      
      const offset = (page - 1) * limit;
      
      const connection = await database.getConnection();

      // 获取收藏列表
      const [favorites] = await connection.execute(
        `SELECT 
          f.id, f.product_id, f.sku_id, f.created_at,
          p.name as product_name, p.image as product_image, p.description,
          s.name as spec_name, s.price, s.original_price, s.stock,
          CASE WHEN s.stock > 0 THEN true ELSE false END as in_stock
         FROM favorites f
         LEFT JOIN products p ON f.product_id = p.id
         LEFT JOIN product_skus s ON f.sku_id = s.id
         WHERE f.user_id = ? AND f.deleted_at IS NULL
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), offset]
      );

      // 获取总数
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM favorites WHERE user_id = ? AND deleted_at IS NULL',
        [userId]
      );

      const total = countResult[0].total;

      connection.release();

      res.json({
        code: 200,
        message: '获取收藏列表成功',
        data: favorites,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error('获取收藏列表失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: '获取收藏列表失败'
      });
    }
  }
);

/**
 * 添加收藏
 * POST /api/favorites
 */
router.post('/',
  authenticateToken,
  [
    body('product_id').isInt({ min: 1 }).withMessage('商品ID无效'),
    body('sku_id').isInt({ min: 1 }).withMessage('SKU ID无效')
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

      const { product_id, sku_id } = req.body;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        // 检查商品是否存在
        const [productRows] = await connection.execute(
          'SELECT id FROM products WHERE id = ? AND status = "active"',
          [product_id]
        );

        if (productRows.length === 0) {
          throw new Error('商品不存在或已下架');
        }

        // 检查SKU是否存在
        const [skuRows] = await connection.execute(
          'SELECT id FROM product_skus WHERE id = ? AND product_id = ?',
          [sku_id, product_id]
        );

        if (skuRows.length === 0) {
          throw new Error('商品规格不存在');
        }

        // 检查是否已经收藏
        const [existingRows] = await connection.execute(
          'SELECT id FROM favorites WHERE user_id = ? AND product_id = ? AND sku_id = ? AND deleted_at IS NULL',
          [userId, product_id, sku_id]
        );

        if (existingRows.length > 0) {
          throw new Error('该商品已在收藏列表中');
        }

        // 添加收藏
        const [result] = await connection.execute(
          'INSERT INTO favorites (user_id, product_id, sku_id, created_at) VALUES (?, ?, ?, NOW())',
          [userId, product_id, sku_id]
        );

        const favoriteId = result.insertId;

        await connection.commit();

        logger.info('添加收藏成功', {
          userId,
          productId: product_id,
          skuId: sku_id,
          favoriteId
        });

        res.json({
          code: 200,
          message: '添加收藏成功',
          data: { id: favoriteId }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('添加收藏失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '添加收藏失败'
      });
    }
  }
);

/**
 * 取消收藏
 * DELETE /api/favorites/:id
 */
router.delete('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('收藏ID无效')
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

      const favoriteId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      // 检查收藏是否存在
      const [favoriteRows] = await connection.execute(
        'SELECT * FROM favorites WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [favoriteId, userId]
      );

      if (favoriteRows.length === 0) {
        connection.release();
        return res.status(404).json({
          code: 404,
          message: '收藏不存在'
        });
      }

      // 软删除收藏
      await connection.execute(
        'UPDATE favorites SET deleted_at = NOW() WHERE id = ?',
        [favoriteId]
      );

      connection.release();

      logger.info('取消收藏成功', {
        userId,
        favoriteId
      });

      res.json({
        code: 200,
        message: '取消收藏成功'
      });

    } catch (error) {
      logger.error('取消收藏失败', { error: error.message, favoriteId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '取消收藏失败'
      });
    }
  }
);

/**
 * 批量删除收藏
 * POST /api/favorites/batch-delete
 */
router.post('/batch-delete',
  authenticateToken,
  [
    body('favorite_ids').isArray({ min: 1 }).withMessage('收藏ID列表不能为空')
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

      const { favorite_ids } = req.body;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        // 验证所有收藏都属于当前用户
        const [favoriteRows] = await connection.execute(
          'SELECT id FROM favorites WHERE id IN (?) AND user_id = ? AND deleted_at IS NULL',
          [favorite_ids, userId]
        );

        if (favoriteRows.length !== favorite_ids.length) {
          throw new Error('部分收藏不存在或无权限删除');
        }

        // 批量软删除收藏
        await connection.execute(
          'UPDATE favorites SET deleted_at = NOW() WHERE id IN (?)',
          [favorite_ids]
        );

        await connection.commit();

        logger.info('批量删除收藏成功', {
          userId,
          favoriteIds: favorite_ids,
          count: favorite_ids.length
        });

        res.json({
          code: 200,
          message: '批量删除收藏成功',
          data: { deleted_count: favorite_ids.length }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('批量删除收藏失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '批量删除收藏失败'
      });
    }
  }
);

/**
 * 检查商品是否已收藏
 * GET /api/favorites/check/:product_id
 */
router.get('/check/:product_id',
  authenticateToken,
  [
    param('product_id').isInt({ min: 1 }).withMessage('商品ID无效')
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

      const productId = req.params.product_id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      const [favoriteRows] = await connection.execute(
        'SELECT id FROM favorites WHERE user_id = ? AND product_id = ? AND deleted_at IS NULL',
        [userId, productId]
      );

      connection.release();

      const isFavorited = favoriteRows.length > 0;

      res.json({
        code: 200,
        message: '检查收藏状态成功',
        data: { is_favorited: isFavorited }
      });

    } catch (error) {
      logger.error('检查收藏状态失败', { error: error.message, productId: req.params.product_id });
      res.status(500).json({
        code: 500,
        message: '检查收藏状态失败'
      });
    }
  }
);

module.exports = router;