const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, generateToken } = require('../middleware/auth');
const { redisUtils } = require('../config/redis');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const router = express.Router();

/**
 * 微信小程序登录
 * POST /api/auth/login
 */
router.post('/login', [
  body('code').notEmpty().withMessage('微信授权码不能为空'),
  body('userInfo').optional().isObject().withMessage('用户信息格式错误')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { code, userInfo } = req.body;

    // 调用微信API获取openid和session_key
    const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (wxResponse.data.errcode) {
      return res.status(400).json({
        code: 400,
        message: `微信登录失败: ${wxResponse.data.errmsg}`,
        data: null
      });
    }

    const { openid, unionid, session_key } = wxResponse.data;

    // 查找或创建用户
    let user = await req.app.locals.db.models.User.findOne({
      where: { openid }
    });

    if (!user) {
      // 创建新用户
      user = await req.app.locals.db.models.User.create({
        openid,
        unionid,
        nickname: userInfo?.nickName || '微信用户',
        avatar: userInfo?.avatarUrl || '',
        gender: userInfo?.gender || 0
      });
    } else {
      // 更新用户信息
      if (userInfo) {
        await user.update({
          nickname: userInfo.nickName || user.nickname,
          avatar: userInfo.avatarUrl || user.avatar,
          gender: userInfo.gender || user.gender
        });
      }
    }

    // 生成JWT token
    const token = generateToken({
      id: user.id,
      openid: user.openid,
      role: 'user'
    });

    // 将session_key存储到Redis（用于后续业务逻辑）
    await redisUtils.set(`session:${openid}`, session_key, 7200); // 2小时过期

    // 返回用户信息和token
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
          points: user.points,
          level: user.level
        }
      }
    });

  } catch (error) {
    console.error('微信登录错误:', error);
    res.status(500).json({
      code: 500,
      message: '登录失败，请稍后重试',
      data: null
    });
  }
});

/**
 * 刷新token
 * POST /api/auth/refresh
 */
router.post('/refresh', auth, async (req, res) => {
  try {
    // 生成新的token
    const newToken = generateToken({
      id: req.user.id,
      openid: req.user.openid,
      role: req.user.role
    });

    res.json({
      code: 200,
      message: 'Token刷新成功',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Token刷新错误:', error);
    res.status(500).json({
      code: 500,
      message: 'Token刷新失败',
      data: null
    });
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', auth, async (req, res) => {
  try {
    // 将当前token加入黑名单
    const token = req.headers.authorization.substring(7);
    await req.app.locals.auth.blacklistToken(token);

    // 清除Redis中的session
    await redisUtils.del(`session:${req.user.openid}`);

    res.json({
      code: 200,
      message: '登出成功',
      data: null
    });

  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({
      code: 500,
      message: '登出失败',
      data: null
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await req.app.locals.db.models.User.findByPk(req.user.id, {
      attributes: ['id', 'nickname', 'avatar', 'phone', 'gender', 'birthday', 'points', 'level', 'created_at']
    });

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在',
        data: null
      });
    }

    res.json({
      code: 200,
      message: '获取用户信息成功',
      data: user
    });

  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户信息失败',
      data: null
    });
  }
});

/**
 * 更新用户信息
 * PUT /api/auth/profile
 */
router.put('/profile', [
  auth,
  body('nickname').optional().isLength({ min: 1, max: 50 }).withMessage('昵称长度应在1-50个字符之间'),
  body('phone').optional().matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('gender').optional().isIn([0, 1, 2]).withMessage('性别值不正确'),
  body('birthday').optional().isISO8601().withMessage('生日格式不正确')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { nickname, phone, gender, birthday } = req.body;
    const updateData = {};

    if (nickname !== undefined) updateData.nickname = nickname;
    if (phone !== undefined) updateData.phone = phone;
    if (gender !== undefined) updateData.gender = gender;
    if (birthday !== undefined) updateData.birthday = birthday;

    // 更新用户信息
    const user = await req.app.locals.db.models.User.findByPk(req.user.id);
    await user.update(updateData);

    res.json({
      code: 200,
      message: '用户信息更新成功',
      data: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        gender: user.gender,
        birthday: user.birthday,
        points: user.points,
        level: user.level
      }
    });

  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      code: 500,
      message: '更新用户信息失败',
      data: null
    });
  }
});

/**
 * 绑定手机号
 * POST /api/auth/bind-phone
 */
router.post('/bind-phone', [
  auth,
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确'),
  body('code').isLength({ min: 4, max: 6 }).withMessage('验证码格式不正确')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { phone, code } = req.body;

    // 验证验证码（这里应该调用短信验证服务）
    const storedCode = await redisUtils.get(`sms:${phone}`);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({
        code: 400,
        message: '验证码错误或已过期',
        data: null
      });
    }

    // 检查手机号是否已被其他用户绑定
    const existingUser = await req.app.locals.db.models.User.findOne({
      where: { phone, id: { [req.app.locals.db.Sequelize.Op.ne]: req.user.id } }
    });

    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '该手机号已被其他用户绑定',
        data: null
      });
    }

    // 绑定手机号
    const user = await req.app.locals.db.models.User.findByPk(req.user.id);
    await user.update({ phone });

    // 清除验证码
    await redisUtils.del(`sms:${phone}`);

    res.json({
      code: 200,
      message: '手机号绑定成功',
      data: {
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('绑定手机号错误:', error);
    res.status(500).json({
      code: 500,
      message: '绑定手机号失败',
      data: null
    });
  }
});

/**
 * 发送短信验证码
 * POST /api/auth/send-sms
 */
router.post('/send-sms', [
  body('phone').matches(/^1[3-9]\d{9}$/).withMessage('手机号格式不正确')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        message: '参数验证失败',
        data: errors.array()
      });
    }

    const { phone } = req.body;

    // 检查发送频率限制
    const sendCount = await redisUtils.get(`sms_limit:${phone}`) || 0;
    if (sendCount >= 5) {
      return res.status(429).json({
        code: 429,
        message: '发送次数过多，请稍后再试',
        data: null
      });
    }

    // 生成6位随机验证码
    const code = Math.random().toString().slice(2, 8);
    
    // 存储验证码到Redis，5分钟过期
    await redisUtils.set(`sms:${phone}`, code, 300);
    
    // 增加发送次数计数，1小时过期
    await redisUtils.set(`sms_limit:${phone}`, sendCount + 1, 3600);

    // 这里应该调用短信服务发送验证码
    // 开发环境直接返回验证码
    if (process.env.NODE_ENV === 'development') {
      console.log(`开发环境验证码: ${phone} -> ${code}`);
    }

    res.json({
      code: 200,
      message: '验证码发送成功',
      data: {
        phone,
        expireIn: 300 // 5分钟过期
      }
    });

  } catch (error) {
    console.error('发送短信验证码错误:', error);
    res.status(500).json({
      code: 500,
      message: '发送验证码失败',
      data: null
    });
  }
});

module.exports = router;