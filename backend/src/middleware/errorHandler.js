/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  console.error('错误详情:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Sequelize 数据库错误
  if (err.name === 'SequelizeValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      code: 400,
      message: `数据验证失败: ${message}`,
      data: null
    };
  }

  // Sequelize 唯一性约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      code: 400,
      message: `数据重复: ${message}`,
      data: null
    };
  }

  // Sequelize 外键约束错误
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = {
      code: 400,
      message: '关联数据不存在',
      data: null
    };
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    error = {
      code: 401,
      message: '无效的访问令牌',
      data: null
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      code: 401,
      message: '访问令牌已过期',
      data: null
    };
  }

  // 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      code: 400,
      message: '文件大小超出限制',
      data: null
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      code: 400,
      message: '不支持的文件类型',
      data: null
    };
  }

  // 微信API错误
  if (err.errcode) {
    error = {
      code: 400,
      message: `微信API错误: ${err.errmsg || err.message}`,
      data: null
    };
  }

  // 默认错误响应
  const statusCode = error.code || 500;
  const message = error.message || '服务器内部错误';

  // 生产环境不暴露错误堆栈
  const response = {
    code: statusCode,
    message: message,
    data: null
  };

  // 开发环境返回详细错误信息
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      stack: err.stack,
      name: err.name,
      code: err.code
    };
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;