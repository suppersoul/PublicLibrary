const redis = require('redis');
require('dotenv').config();

// Redis客户端配置
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retry_strategy: function(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      // 如果服务器拒绝连接，停止重试
      return new Error('Redis服务器拒绝连接');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      // 如果总重试时间超过1小时，停止重试
      return new Error('重试时间超过1小时');
    }
    if (options.attempt > 10) {
      // 如果重试次数超过10次，停止重试
      return undefined;
    }
    // 重试延迟
    return Math.min(options.attempt * 100, 3000);
  }
});

// 连接Redis
async function connectRedis() {
  return new Promise((resolve, reject) => {
    redisClient.on('connect', () => {
      console.log('✅ Redis连接成功');
      resolve(redisClient);
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis连接错误:', err);
      reject(err);
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis准备就绪');
    });

    redisClient.on('end', () => {
      console.log('⚠️ Redis连接断开');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis正在重连...');
    });

    // 连接到Redis
    redisClient.connect().catch(reject);
  });
}

// 关闭Redis连接
async function closeRedis() {
  try {
    await redisClient.quit();
    console.log('✅ Redis连接已关闭');
  } catch (error) {
    console.error('❌ 关闭Redis连接失败:', error);
  }
}

// Redis工具函数
const redisUtils = {
  // 设置键值对
  async set(key, value, expireTime = null) {
    try {
      if (expireTime) {
        await redisClient.setEx(key, expireTime, JSON.stringify(value));
      } else {
        await redisClient.set(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      console.error('Redis SET错误:', error);
      return false;
    }
  },

  // 获取值
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET错误:', error);
      return null;
    }
  },

  // 删除键
  async del(key) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL错误:', error);
      return false;
    }
  },

  // 设置过期时间
  async expire(key, seconds) {
    try {
      await redisClient.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE错误:', error);
      return false;
    }
  },

  // 检查键是否存在
  async exists(key) {
    try {
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS错误:', error);
      return false;
    }
  },

  // 获取键的过期时间
  async ttl(key) {
    try {
      return await redisClient.ttl(key);
    } catch (error) {
      console.error('Redis TTL错误:', error);
      return -1;
    }
  },

  // 哈希表操作
  async hset(key, field, value) {
    try {
      await redisClient.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis HSET错误:', error);
      return false;
    }
  },

  async hget(key, field) {
    try {
      const value = await redisClient.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis HGET错误:', error);
      return null;
    }
  },

  async hgetall(key) {
    try {
      const result = await redisClient.hGetAll(key);
      const parsed = {};
      for (const [field, value] of Object.entries(result)) {
        parsed[field] = JSON.parse(value);
      }
      return parsed;
    } catch (error) {
      console.error('Redis HGETALL错误:', error);
      return {};
    }
  },

  // 列表操作
  async lpush(key, value) {
    try {
      await redisClient.lPush(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis LPUSH错误:', error);
      return false;
    }
  },

  async rpop(key) {
    try {
      const value = await redisClient.rPop(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis RPOP错误:', error);
      return null;
    }
  },

  // 集合操作
  async sadd(key, member) {
    try {
      await redisClient.sAdd(key, JSON.stringify(member));
      return true;
    } catch (error) {
      console.error('Redis SADD错误:', error);
      return false;
    }
  },

  async smembers(key) {
    try {
      const members = await redisClient.sMembers(key);
      return members.map(member => JSON.parse(member));
    } catch (error) {
      console.error('Redis SMEMBERS错误:', error);
      return [];
    }
  }
};

module.exports = {
  redisClient,
  connectRedis,
  closeRedis,
  redisUtils
};