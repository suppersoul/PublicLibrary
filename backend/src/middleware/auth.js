const jwt = require('jsonwebtoken');
const { redisUtils } = require('../config/redis');

/**
 * JWT身份验证中间件
 */
const auth = async (req, res, next) => {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        code: 401,
        message: '未提供访问令牌',
        data: null
      });
    }

    const token = authHeader.substring(7); // 去掉 "Bearer " 前缀

    // 验证token是否在黑名单中
    const isBlacklisted = await redisUtils.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        code: 401,
        message: '访问令牌已失效',
        data: null
      });
    }

    // 验证JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 检查token是否过期
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        code: 401,
        message: '访问令牌已过期',
        data: null
      });
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: decoded.id,
      openid: decoded.openid,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        code: 401,
        message: '无效的访问令牌',
        data: null
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        message: '访问令牌已过期',
        data: null
      });
    } else {
      console.error('Token验证错误:', error);
      return res.status(500).json({
        code: 500,
        message: '服务器内部错误',
        data: null
      });
    }
  }
};

/**
 * 可选身份验证中间件（不强制要求登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      id: decoded.id,
      openid: decoded.openid,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    // 验证失败时不阻止请求，只是不设置用户信息
    req.user = null;
    next();
  }
};

/**
 * 角色权限验证中间件
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: '请先登录',
        data: null
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足',
        data: null
      });
    }

    next();
  };
};

/**
 * 管理员权限验证中间件
 */
const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * 超级管理员权限验证中间件
 */
const requireSuperAdmin = requireRole(['super_admin']);

/**
 * 生成JWT token
 */
const generateToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

/**
 * 将token加入黑名单
 */
const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisUtils.set(`blacklist:${token}`, true, ttl);
      }
    }
    return true;
  } catch (error) {
    console.error('加入黑名单失败:', error);
    return false;
  }
};

module.exports = {
  auth,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  generateToken,
  blacklistToken
};