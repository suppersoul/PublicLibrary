const { getMySQLPool } = require('../config/database');
const logger = require('../utils/logger');

// 数据库表结构
const tables = {
  // 用户表
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      openid VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
      unionid VARCHAR(100) COMMENT '微信unionid',
      nickname VARCHAR(100) COMMENT '用户昵称',
      avatar VARCHAR(500) COMMENT '头像地址',
      phone VARCHAR(20) COMMENT '手机号',
      gender TINYINT DEFAULT 0 COMMENT '性别：0-未知，1-男，2-女',
      birthday DATE COMMENT '生日',
      points INT DEFAULT 0 COMMENT '积分',
      level TINYINT DEFAULT 1 COMMENT '会员等级',
      role ENUM('user', 'merchant', 'admin') DEFAULT 'user' COMMENT '用户角色',
      status TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_openid (openid),
      INDEX idx_phone (phone),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表'
  `,

  // 商品分类表
  categories: `
    CREATE TABLE IF NOT EXISTS categories (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL COMMENT '分类名称',
      description TEXT COMMENT '分类描述',
      icon VARCHAR(200) COMMENT '分类图标',
      parent_id BIGINT DEFAULT 0 COMMENT '父分类ID，0表示顶级分类',
      sort_order INT DEFAULT 0 COMMENT '排序',
      status TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_parent_id (parent_id),
      INDEX idx_status (status),
      INDEX idx_sort (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表'
  `,

  // 商品表
  products: `
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL COMMENT '商品名称',
      description TEXT COMMENT '商品描述',
      price DECIMAL(10,2) NOT NULL COMMENT '售价',
      original_price DECIMAL(10,2) COMMENT '原价',
      stock INT DEFAULT 0 COMMENT '库存数量',
      sales_count INT DEFAULT 0 COMMENT '销量',
      views_count INT DEFAULT 0 COMMENT '浏览量',
      category_id BIGINT NOT NULL COMMENT '分类ID',
      brand VARCHAR(100) COMMENT '品牌',
      origin VARCHAR(200) COMMENT '产地',
      weight DECIMAL(8,2) COMMENT '重量',
      unit VARCHAR(20) COMMENT '单位',
      images JSON COMMENT '商品图片',
      tags JSON COMMENT '商品标签',
      specifications JSON COMMENT '规格参数',
      status TINYINT DEFAULT 1 COMMENT '状态：0-下架，1-上架',
      sort_order INT DEFAULT 0 COMMENT '排序',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_category_id (category_id),
      INDEX idx_status (status),
      INDEX idx_price (price),
      INDEX idx_sales (sales_count),
      INDEX idx_created (created_at),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表'
  `,

  // 订单表
  orders: `
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '订单号',
      user_id BIGINT NOT NULL COMMENT '用户ID',
      total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
      discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '优惠金额',
      actual_amount DECIMAL(10,2) NOT NULL COMMENT '实付金额',
      status TINYINT DEFAULT 0 COMMENT '订单状态：0-待支付，1-已支付，2-已发货，3-已完成，4-已取消，5-已退款',
      payment_method TINYINT COMMENT '支付方式：1-微信支付，2-余额支付',
      payment_time TIMESTAMP NULL COMMENT '支付时间',
      delivery_address JSON COMMENT '收货地址',
      delivery_fee DECIMAL(8,2) DEFAULT 0 COMMENT '运费',
      remark TEXT COMMENT '订单备注',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_user_id (user_id),
      INDEX idx_order_no (order_no),
      INDEX idx_status (status),
      INDEX idx_created (created_at),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表'
  `,

  // 订单商品表
  order_items: `
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      order_id BIGINT NOT NULL COMMENT '订单ID',
      product_id BIGINT NOT NULL COMMENT '商品ID',
      product_name VARCHAR(200) NOT NULL COMMENT '商品名称',
      product_image VARCHAR(500) COMMENT '商品图片',
      price DECIMAL(10,2) NOT NULL COMMENT '商品单价',
      quantity INT NOT NULL COMMENT '购买数量',
      subtotal DECIMAL(10,2) NOT NULL COMMENT '小计金额',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_order_id (order_id),
      INDEX idx_product_id (product_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单商品表'
  `,

  // 收货地址表
  addresses: `
    CREATE TABLE IF NOT EXISTS addresses (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL COMMENT '用户ID',
      receiver VARCHAR(50) NOT NULL COMMENT '收货人姓名',
      phone VARCHAR(20) NOT NULL COMMENT '收货人电话',
      province VARCHAR(50) NOT NULL COMMENT '省份',
      city VARCHAR(50) NOT NULL COMMENT '城市',
      district VARCHAR(50) NOT NULL COMMENT '区县',
      detail_address TEXT NOT NULL COMMENT '详细地址',
      is_default TINYINT DEFAULT 0 COMMENT '是否默认地址：0-否，1-是',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_user_id (user_id),
      INDEX idx_is_default (is_default),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货地址表'
  `,

  // 优惠券表
  coupons: `
    CREATE TABLE IF NOT EXISTS coupons (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL COMMENT '优惠券名称',
      type TINYINT NOT NULL COMMENT '优惠券类型：1-满减券，2-折扣券，3-无门槛券',
      value DECIMAL(10,2) NOT NULL COMMENT '优惠券面值',
      min_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
      discount DECIMAL(3,2) COMMENT '折扣率（0.01-1.00）',
      total_count INT NOT NULL COMMENT '发放总数',
      used_count INT DEFAULT 0 COMMENT '已使用数量',
      start_time TIMESTAMP NOT NULL COMMENT '生效时间',
      end_time TIMESTAMP NOT NULL COMMENT '失效时间',
      status TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_status (status),
      INDEX idx_time (start_time, end_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='优惠券表'
  `,

  // 用户优惠券表
  user_coupons: `
    CREATE TABLE IF NOT EXISTS user_coupons (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL COMMENT '用户ID',
      coupon_id BIGINT NOT NULL COMMENT '优惠券ID',
      status TINYINT DEFAULT 0 COMMENT '状态：0-未使用，1-已使用，2-已过期',
      used_time TIMESTAMP NULL COMMENT '使用时间',
      order_id BIGINT COMMENT '使用订单ID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
      INDEX idx_user_id (user_id),
      INDEX idx_coupon_id (coupon_id),
      INDEX idx_status (status),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户优惠券表'
  `,

  // 收藏表
  favorites: `
    CREATE TABLE IF NOT EXISTS favorites (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL COMMENT '用户ID',
      product_id BIGINT NOT NULL COMMENT '商品ID',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
      UNIQUE KEY uk_user_product (user_id, product_id),
      INDEX idx_user_id (user_id),
      INDEX idx_product_id (product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏表'
  `,

  // 系统配置表
  system_configs: `
    CREATE TABLE IF NOT EXISTS system_configs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      config_key VARCHAR(100) UNIQUE NOT NULL COMMENT '配置键',
      config_value TEXT COMMENT '配置值',
      description VARCHAR(200) COMMENT '配置描述',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
      INDEX idx_config_key (config_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表'
  `
};

// 初始化数据
const initialData = {
  // 商品分类
  categories: [
    { name: '新鲜水果', description: '当季新鲜水果', icon: 'fruit', sort_order: 1 },
    { name: '时令蔬菜', description: '新鲜时令蔬菜', icon: 'vegetable', sort_order: 2 },
    { name: '粮油调味', description: '优质粮油调味品', icon: 'grain', sort_order: 3 },
    { name: '肉禽蛋奶', description: '新鲜肉禽蛋奶', icon: 'meat', sort_order: 4 },
    { name: '水产海鲜', description: '鲜活水产海鲜', icon: 'seafood', sort_order: 5 },
    { name: '坚果零食', description: '健康坚果零食', icon: 'nut', sort_order: 6 }
  ],

  // 系统配置
  system_configs: [
    { config_key: 'site_name', config_value: '笑姐家农产品', description: '网站名称' },
    { config_key: 'site_description', config_value: '优质农产品直供平台', description: '网站描述' },
    { config_key: 'delivery_fee', config_value: '5.00', description: '默认运费' },
    { config_key: 'min_order_amount', config_value: '50.00', description: '最低起订金额' },
    { config_key: 'points_rate', config_value: '0.01', description: '积分兑换比例' }
  ]
};

// 执行数据库迁移
async function runMigration() {
  try {
    logger.info('开始数据库迁移...');
    
    const pool = getMySQLPool();
    
    // 创建表
    for (const [tableName, createSQL] of Object.entries(tables)) {
      try {
        await pool.execute(createSQL);
        logger.info(`表 ${tableName} 创建成功`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          logger.info(`表 ${tableName} 已存在，跳过创建`);
        } else {
          throw error;
        }
      }
    }

    // 插入初始数据
    await insertInitialData(pool);
    
    logger.info('数据库迁移完成');
    process.exit(0);
    
  } catch (error) {
    logger.error('数据库迁移失败:', error);
    process.exit(1);
  }
}

// 插入初始数据
async function insertInitialData(pool) {
  try {
    // 插入商品分类
    for (const category of initialData.categories) {
      const [existing] = await pool.execute(
        'SELECT id FROM categories WHERE name = ?',
        [category.name]
      );
      
      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)',
          [category.name, category.description, category.icon, category.sort_order]
        );
        logger.info(`分类 ${category.name} 插入成功`);
      }
    }

    // 插入系统配置
    for (const config of initialData.system_configs) {
      const [existing] = await pool.execute(
        'SELECT id FROM system_configs WHERE config_key = ?',
        [config.config_key]
      );
      
      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO system_configs (config_key, config_value, description) VALUES (?, ?, ?)',
          [config.config_key, config.config_value, config.description]
        );
        logger.info(`配置 ${config.config_key} 插入成功`);
      }
    }

    logger.info('初始数据插入完成');
    
  } catch (error) {
    logger.error('插入初始数据失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };