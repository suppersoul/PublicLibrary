const mysql = require('mysql2/promise');
const Redis = require('redis');
const logger = require('../utils/logger');

// MySQL连接池配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'xiaojie_farm',
  charset: process.env.DB_CHARSET || 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// 创建MySQL连接池
let mysqlPool;

const createMySQLPool = async () => {
  try {
    mysqlPool = mysql.createPool(dbConfig);
    
    // 测试连接
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
    
    logger.info('MySQL数据库连接成功');
    return mysqlPool;
  } catch (error) {
    logger.error('MySQL数据库连接失败:', error);
    throw error;
  }
};

// Redis客户端配置
let redisClient;

const createRedisClient = async () => {
  try {
    redisClient = Redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB) || 0
    });

    redisClient.on('error', (err) => {
      logger.error('Redis连接错误:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis连接成功');
    });

    redisClient.on('ready', () => {
      logger.info('Redis准备就绪');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Redis连接失败:', error);
    throw error;
  }
};

// 获取MySQL连接池
const getMySQLPool = () => {
  if (!mysqlPool) {
    throw new Error('MySQL连接池未初始化');
  }
  return mysqlPool;
};

// 获取Redis客户端
const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis客户端未初始化');
  }
  return redisClient;
};

// 关闭数据库连接
const closeConnections = async () => {
  try {
    if (mysqlPool) {
      await mysqlPool.end();
      logger.info('MySQL连接池已关闭');
    }
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis连接已关闭');
    }
  } catch (error) {
    logger.error('关闭数据库连接时出错:', error);
  }
};

// 初始化数据库连接
const initDatabase = async () => {
  try {
    await createMySQLPool();
    await createRedisClient();
    logger.info('数据库初始化完成');
  } catch (error) {
    logger.error('数据库初始化失败:', error);
    throw error;
  }
};

module.exports = {
  initDatabase,
  getMySQLPool,
  getRedisClient,
  closeConnections
};