const { Sequelize } = require('sequelize');
require('dotenv').config();

// 数据库连接配置
const sequelize = new Sequelize(
  process.env.DB_NAME || 'farm_product_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    timezone: '+08:00', // 设置时区为北京时间
    define: {
      timestamps: true, // 自动添加 createdAt 和 updatedAt 字段
      underscored: true, // 使用下划线命名
      freezeTableName: true, // 冻结表名
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    pool: {
      max: 20, // 连接池最大连接数
      min: 5,  // 连接池最小连接数
      acquire: 30000, // 获取连接的最大等待时间
      idle: 10000 // 连接在释放之前可以空闲的最长时间
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      typeCast: true
    }
  }
);

// 测试数据库连接
async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 同步数据库模型（开发环境）
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('✅ 数据库模型同步完成');
    }
    
    return sequelize;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw error;
  }
}

// 关闭数据库连接
async function closeDB() {
  try {
    await sequelize.close();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接失败:', error);
  }
}

module.exports = {
  sequelize,
  connectDB,
  closeDB
};