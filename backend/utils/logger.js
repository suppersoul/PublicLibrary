const winston = require('winston');
const path = require('path');

// 创建logs目录
const fs = require('fs');
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// 开发环境下添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// 添加日志方法
logger.startTimer = () => {
  return winston.startTimer();
};

logger.profile = (id, ...meta) => {
  logger.profile(id, ...meta);
};

// 自定义日志方法
logger.logRequest = (req, res, responseTime) => {
  logger.info('HTTP请求', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    responseTime: `${responseTime}ms`,
    statusCode: res.statusCode,
    userId: req.user?.id || 'anonymous'
  });
};

logger.logError = (error, req = null) => {
  logger.error('系统错误', {
    message: error.message,
    stack: error.stack,
    url: req?.url,
    method: req?.method,
    userId: req?.user?.id || 'anonymous',
    timestamp: new Date().toISOString()
  });
};

logger.logSecurity = (event, details) => {
  logger.warn('安全事件', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

logger.logBusiness = (action, details) => {
  logger.info('业务操作', {
    action,
    details,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;