const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/database');
const logger = require('../utils/logger');

// JWT验证中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: '访问令牌缺失',
        code: 'TOKEN_MISSING'
      });
    }

    // 验证JWT令牌
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 检查令牌是否在黑名单中（已登出）
    const redisClient = getRedisClient();
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    
    if (isBlacklisted) {
      return res.status(401).json({
        error: '令牌已失效',
        code: 'TOKEN_INVALID'
      });
    }

    // 将用户信息添加到请求对象
    req.user = decoded;
    
    // 记录认证日志
    logger.logBusiness('用户认证', {
      userId: decoded.id,
      action: 'token_verification',
      success: true
    });

    next();
  } catch (error) {
    logger.logError(error, req);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: '访问令牌已过期',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: '无效的访问令牌',
        code: 'TOKEN_INVALID'
      });
    }

    return res.status(500).json({
      error: '令牌验证失败',
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

// 可选认证中间件（不强制要求登录）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // 可选认证失败不影响请求继续
    next();
  }
};

// 角色验证中间件
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: '需要登录',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.logSecurity('权限不足', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
        url: req.url
      });

      return res.status(403).json({
        error: '权限不足',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

// 商家权限验证
const requireMerchant = requireRole(['merchant', 'admin']);

// 管理员权限验证
const requireAdmin = requireRole(['admin']);

// 生成JWT令牌
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// 将令牌加入黑名单（登出时使用）
const blacklistToken = async (token) => {
  try {
    const redisClient = getRedisClient();
    const decoded = jwt.decode(token);
    
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.setEx(`blacklist:${token}`, ttl, '1');
      }
    }
    
    logger.logBusiness('用户登出', {
      userId: decoded?.id,
      action: 'logout',
      tokenBlacklisted: true
    });
    
    return true;
  } catch (error) {
    logger.logError(error);
    return false;
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireMerchant,
  requireAdmin,
  generateToken,
  blacklistToken
};