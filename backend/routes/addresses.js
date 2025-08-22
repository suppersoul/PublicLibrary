// routes/addresses.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { validationResult, body, param } = require('express-validator');
const database = require('../config/database');
const logger = require('../utils/logger');

/**
 * 获取用户地址列表
 * GET /api/addresses
 */
router.get('/', 
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const connection = await database.getConnection();

      const [addresses] = await connection.execute(
        `SELECT * FROM addresses 
         WHERE user_id = ? AND deleted_at IS NULL 
         ORDER BY is_default DESC, created_at DESC`,
        [userId]
      );

      connection.release();

      res.json({
        code: 200,
        message: '获取地址列表成功',
        data: addresses
      });

    } catch (error) {
      logger.error('获取地址列表失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: '获取地址列表失败'
      });
    }
  }
);

/**
 * 获取地址详情
 * GET /api/addresses/:id
 */
router.get('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('地址ID无效')
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

      const addressId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      const [addressRows] = await connection.execute(
        'SELECT * FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [addressId, userId]
      );

      connection.release();

      if (addressRows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '地址不存在'
        });
      }

      res.json({
        code: 200,
        message: '获取地址详情成功',
        data: addressRows[0]
      });

    } catch (error) {
      logger.error('获取地址详情失败', { error: error.message, addressId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '获取地址详情失败'
      });
    }
  }
);

/**
 * 添加新地址
 * POST /api/addresses
 */
router.post('/',
  authenticateToken,
  [
    body('receiver_name').notEmpty().withMessage('收货人姓名不能为空'),
    body('receiver_phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
    body('province').notEmpty().withMessage('省份不能为空'),
    body('city').notEmpty().withMessage('城市不能为空'),
    body('district').notEmpty().withMessage('区县不能为空'),
    body('detail').notEmpty().withMessage('详细地址不能为空'),
    body('is_default').optional().isBoolean().withMessage('默认地址标识无效')
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
        receiver_name,
        receiver_phone,
        province,
        city,
        district,
        detail,
        is_default = false
      } = req.body;
      
      const userId = req.user.id;
      const connection = await database.getConnection();

      try {
        await connection.beginTransaction();

        // 如果设置为默认地址，先取消其他默认地址
        if (is_default) {
          await connection.execute(
            'UPDATE addresses SET is_default = false WHERE user_id = ? AND is_default = true',
            [userId]
          );
        }

        // 插入新地址
        const [result] = await connection.execute(
          `INSERT INTO addresses (
            user_id, receiver_name, receiver_phone, province, city, district, detail,
            is_default, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [userId, receiver_name, receiver_phone, province, city, district, detail, is_default]
        );

        const addressId = result.insertId;

        await connection.commit();

        logger.info('地址添加成功', {
          userId,
          addressId,
          receiver_name
        });

        res.json({
          code: 200,
          message: '地址添加成功',
          data: { id: addressId }
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('添加地址失败', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        code: 500,
        message: error.message || '添加地址失败'
      });
    }
  }
);

/**
 * 更新地址
 * PUT /api/addresses/:id
 */
router.put('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('地址ID无效'),
    body('receiver_name').optional().notEmpty().withMessage('收货人姓名不能为空'),
    body('receiver_phone').optional().matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
    body('province').optional().notEmpty().withMessage('省份不能为空'),
    body('city').optional().notEmpty().withMessage('城市不能为空'),
    body('district').optional().notEmpty().withMessage('区县不能为空'),
    body('detail').optional().notEmpty().withMessage('详细地址不能为空'),
    body('is_default').optional().isBoolean().withMessage('默认地址标识无效')
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

      const addressId = req.params.id;
      const userId = req.user.id;
      const updateData = req.body;

      const connection = await database.getConnection();

      try {
        await connection.beginTransaction();

        // 检查地址是否存在
        const [addressRows] = await connection.execute(
          'SELECT * FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [addressId, userId]
        );

        if (addressRows.length === 0) {
          throw new Error('地址不存在');
        }

        // 如果设置为默认地址，先取消其他默认地址
        if (updateData.is_default) {
          await connection.execute(
            'UPDATE addresses SET is_default = false WHERE user_id = ? AND is_default = true AND id != ?',
            [userId, addressId]
          );
        }

        // 构建更新SQL
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
          if (updateData[key] !== undefined) {
            updateFields.push(`${key} = ?`);
            updateValues.push(updateData[key]);
          }
        });

        if (updateFields.length === 0) {
          throw new Error('没有需要更新的字段');
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(addressId, userId);

        const updateSql = `UPDATE addresses SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;
        
        await connection.execute(updateSql, updateValues);

        await connection.commit();

        logger.info('地址更新成功', {
          userId,
          addressId
        });

        res.json({
          code: 200,
          message: '地址更新成功'
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('更新地址失败', { error: error.message, addressId: req.params.id });
      res.status(500).json({
        code: 500,
        message: error.message || '更新地址失败'
      });
    }
  }
);

/**
 * 删除地址
 * DELETE /api/addresses/:id
 */
router.delete('/:id',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('地址ID无效')
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

      const addressId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      // 检查地址是否存在
      const [addressRows] = await connection.execute(
        'SELECT * FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
        [addressId, userId]
      );

      if (addressRows.length === 0) {
        connection.release();
        return res.status(404).json({
          code: 404,
          message: '地址不存在'
        });
      }

      const address = addressRows[0];

      // 软删除地址
      await connection.execute(
        'UPDATE addresses SET deleted_at = NOW() WHERE id = ?',
        [addressId]
      );

      // 如果删除的是默认地址，设置其他地址为默认
      if (address.is_default) {
        const [otherAddresses] = await connection.execute(
          'SELECT id FROM addresses WHERE user_id = ? AND deleted_at IS NULL AND id != ? LIMIT 1',
          [userId, addressId]
        );

        if (otherAddresses.length > 0) {
          await connection.execute(
            'UPDATE addresses SET is_default = true WHERE id = ?',
            [otherAddresses[0].id]
          );
        }
      }

      connection.release();

      logger.info('地址删除成功', {
        userId,
        addressId
      });

      res.json({
        code: 200,
        message: '地址删除成功'
      });

    } catch (error) {
      logger.error('删除地址失败', { error: error.message, addressId: req.params.id });
      res.status(500).json({
        code: 500,
        message: '删除地址失败'
      });
    }
  }
);

/**
 * 设置默认地址
 * PUT /api/addresses/:id/default
 */
router.put('/:id/default',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('地址ID无效')
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

      const addressId = req.params.id;
      const userId = req.user.id;

      const connection = await database.getConnection();

      try {
        await connection.beginTransaction();

        // 检查地址是否存在
        const [addressRows] = await connection.execute(
          'SELECT * FROM addresses WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
          [addressId, userId]
        );

        if (addressRows.length === 0) {
          throw new Error('地址不存在');
        }

        // 取消其他默认地址
        await connection.execute(
          'UPDATE addresses SET is_default = false WHERE user_id = ? AND is_default = true',
          [userId]
        );

        // 设置当前地址为默认
        await connection.execute(
          'UPDATE addresses SET is_default = true WHERE id = ?',
          [addressId]
        );

        await connection.commit();

        logger.info('设置默认地址成功', {
          userId,
          addressId
        });

        res.json({
          code: 200,
          message: '设置默认地址成功'
        });

      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

    } catch (error) {
      logger.error('设置默认地址失败', { error: error.message, addressId: req.params.id });
      res.status(500).json({
        code: 500,
        message: error.message || '设置默认地址失败'
      });
    }
  }
);

module.exports = router;