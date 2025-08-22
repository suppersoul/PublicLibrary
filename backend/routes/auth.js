const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { getMySQLPool, getRedisClient } = require('../config/database');
const { generateToken, authenticateToken, blacklistToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// 微信小程序登录
router.post('/wechat-login', [
  body('code').notEmpty().withMessage('微信授权码不能为空'),
  body('userInfo').isObject().withMessage('用户信息格式错误')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { code, userInfo } = req.body;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    // 通过code获取微信openid和session_key
    const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (wxResponse.data.errcode) {
      logger.logError(new Error(`微信登录失败: ${wxResponse.data.errmsg}`), req);
      return res.status(400).json({
        error: '微信登录失败',
        code: 'WECHAT_LOGIN_FAILED'
      });
    }

    const { openid, session_key, unionid } = wxResponse.data;

    // 查找或创建用户
    let [users] = await pool.execute(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );

    let user;
    if (users.length === 0) {
      // 新用户，创建账户
      const [result] = await pool.execute(
        'INSERT INTO users (openid, unionid, nickname, avatar, gender, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [openid, unionid || null, userInfo.nickName, userInfo.avatarUrl, userInfo.gender || 0]
      );

      user = {
        id: result.insertId,
        openid,
        unionid,
        nickname: userInfo.nickName,
        avatar: userInfo.avatarUrl,
        gender: userInfo.gender || 0,
        role: 'user',
        level: 1,
        points: 0
      };

      logger.logBusiness('新用户注册', {
        userId: user.id,
        openid,
        source: 'wechat_miniprogram'
      });
    } else {
      // 老用户，更新信息
      user = users[0];
      
      // 更新用户信息
      await pool.execute(
        'UPDATE users SET nickname = ?, avatar = ?, gender = ?, updated_at = NOW() WHERE id = ?',
        [userInfo.nickName, userInfo.avatarUrl, userInfo.gender || 0, user.id]
      );

      user.nickname = userInfo.nickName;
      user.avatar = userInfo.avatarUrl;
      user.gender = userInfo.gender || 0;
    }

    // 生成JWT令牌
    const token = generateToken({
      id: user.id,
      openid: user.openid,
      role: user.role,
      level: user.level
    });

    // 将session_key存储到Redis（用于后续业务）
    await redisClient.setEx(`session:${openid}`, 7200, session_key); // 2小时过期

    // 记录登录日志
    logger.logBusiness('用户登录', {
      userId: user.id,
      openid,
      method: 'wechat',
      success: true
    });

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        userInfo: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          gender: user.gender,
          role: user.role,
          level: user.level,
          points: user.points
        }
      }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '登录失败',
      code: 'LOGIN_FAILED'
    });
  }
});

// 手机号绑定
router.post('/bind-phone', [
  authenticateToken,
  body('phone').isMobilePhone('zh-CN').withMessage('手机号格式错误'),
  body('code').isLength({ min: 4, max: 6 }).withMessage('验证码格式错误')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { phone, code } = req.body;
    const userId = req.user.id;
    const pool = getMySQLPool();
    const redisClient = getRedisClient();

    // 验证验证码
    const storedCode = await redisClient.get(`sms:${phone}`);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({
        error: '验证码错误或已过期',
        code: 'INVALID_SMS_CODE'
      });
    }

    // 检查手机号是否已被其他用户绑定
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE phone = ? AND id != ?',
      [phone, userId]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        error: '该手机号已被其他用户绑定',
        code: 'PHONE_ALREADY_BOUND'
      });
    }

    // 绑定手机号
    await pool.execute(
      'UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?',
      [phone, userId]
    );

    // 删除验证码
    await redisClient.del(`sms:${phone}`);

    logger.logBusiness('手机号绑定', {
      userId,
      phone,
      success: true
    });

    res.json({
      code: 200,
      message: '手机号绑定成功',
      data: { phone }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '绑定失败',
      code: 'BIND_FAILED'
    });
  }
});

// 发送短信验证码
router.post('/send-sms', [
  body('phone').isMobilePhone('zh-CN').withMessage('手机号格式错误')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      });
    }

    const { phone } = req.body;
    const redisClient = getRedisClient();

    // 检查发送频率限制
    const sendCount = await redisClient.get(`sms_limit:${phone}`);
    if (sendCount && parseInt(sendCount) >= 5) {
      return res.status(429).json({
        error: '发送过于频繁，请稍后再试',
        code: 'SMS_RATE_LIMIT'
      });
    }

    // 生成6位随机验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 存储验证码到Redis，5分钟过期
    await redisClient.setEx(`sms:${phone}`, 300, code);
    
    // 增加发送次数计数，1小时过期
    await redisClient.incr(`sms_limit:${phone}`);
    await redisClient.expire(`sms_limit:${phone}`, 3600);

    // TODO: 调用短信服务发送验证码
    // 这里模拟发送成功
    logger.logBusiness('短信验证码发送', {
      phone,
      code,
      success: true
    });

    res.json({
      code: 200,
      message: '验证码发送成功',
      data: { phone }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '发送失败',
      code: 'SMS_SEND_FAILED'
    });
  }
});

// 用户登出
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers['authorization'].split(' ')[1];
    
    // 将令牌加入黑名单
    await blacklistToken(token);

    res.json({
      code: 200,
      message: '登出成功'
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '登出失败',
      code: 'LOGOUT_FAILED'
    });
  }
});

// 刷新令牌
router.post('/refresh-token', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // 生成新的令牌
    const newToken = generateToken({
      id: user.id,
      openid: user.openid,
      role: user.role,
      level: user.level
    });

    // 将旧令牌加入黑名单
    const oldToken = req.headers['authorization'].split(' ')[1];
    await blacklistToken(oldToken);

    logger.logBusiness('令牌刷新', {
      userId: user.id,
      success: true
    });

    res.json({
      code: 200,
      message: '令牌刷新成功',
      data: { token: newToken }
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '令牌刷新失败',
      code: 'TOKEN_REFRESH_FAILED'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const pool = getMySQLPool();

    const [users] = await pool.execute(
      'SELECT id, nickname, avatar, phone, gender, birthday, points, level, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = users[0];

    res.json({
      code: 200,
      data: user
    });

  } catch (error) {
    logger.logError(error, req);
    res.status(500).json({
      error: '获取用户信息失败',
      code: 'GET_USER_INFO_FAILED'
    });
  }
});

module.exports = router;