-- 笑姐家农产品微信小程序商城数据库初始化脚本
-- 创建时间: 2024-08-22
-- 数据库版本: v1.0.0

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `farm_product_db` 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `farm_product_db`;

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `openid` VARCHAR(100) NOT NULL UNIQUE COMMENT '微信openid',
  `unionid` VARCHAR(100) NULL COMMENT '微信unionid',
  `nickname` VARCHAR(100) NULL COMMENT '用户昵称',
  `avatar` VARCHAR(500) NULL COMMENT '用户头像',
  `phone` VARCHAR(20) NULL COMMENT '手机号',
  `gender` TINYINT DEFAULT 0 COMMENT '性别：0-未知，1-男，2-女',
  `birthday` DATE NULL COMMENT '生日',
  `points` INT DEFAULT 0 COMMENT '积分',
  `level` TINYINT DEFAULT 1 COMMENT '会员等级：1-普通，2-银卡，3-金卡，4-钻石',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_openid` (`openid`),
  INDEX `idx_phone` (`phone`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 用户地址表
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '地址ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `receiver` VARCHAR(50) NOT NULL COMMENT '收货人姓名',
  `phone` VARCHAR(20) NOT NULL COMMENT '收货人电话',
  `province` VARCHAR(50) NOT NULL COMMENT '省份',
  `city` VARCHAR(50) NOT NULL COMMENT '城市',
  `district` VARCHAR(50) NOT NULL COMMENT '区县',
  `detail` VARCHAR(200) NOT NULL COMMENT '详细地址',
  `is_default` TINYINT DEFAULT 0 COMMENT '是否默认地址：0-否，1-是',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_default` (`is_default`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户地址表';

-- 商品分类表
CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
  `description` TEXT NULL COMMENT '分类描述',
  `image` VARCHAR(500) NULL COMMENT '分类图片',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '父分类ID',
  `level` TINYINT DEFAULT 1 COMMENT '分类层级',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_parent_id` (`parent_id`),
  INDEX `idx_level` (`level`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`parent_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

-- 商品表
CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  `name` VARCHAR(200) NOT NULL COMMENT '商品名称',
  `description` TEXT NULL COMMENT '商品描述',
  `price` DECIMAL(10,2) NOT NULL COMMENT '售价',
  `original_price` DECIMAL(10,2) NULL COMMENT '原价',
  `cost_price` DECIMAL(10,2) NULL COMMENT '成本价',
  `stock` INT DEFAULT 0 COMMENT '库存数量',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '分类ID',
  `brand` VARCHAR(100) NULL COMMENT '品牌',
  `origin` VARCHAR(200) NULL COMMENT '产地',
  `weight` DECIMAL(8,2) NULL COMMENT '重量(kg)',
  `unit` VARCHAR(20) NULL COMMENT '单位',
  `images` JSON NULL COMMENT '商品图片JSON数组',
  `tags` JSON NULL COMMENT '商品标签JSON数组',
  `specifications` JSON NULL COMMENT '规格参数JSON',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0-下架，1-上架，2-预售',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `sales_count` INT DEFAULT 0 COMMENT '销量',
  `view_count` INT DEFAULT 0 COMMENT '浏览量',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_category_id` (`category_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_price` (`price`),
  INDEX `idx_sales_count` (`sales_count`),
  FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- 购物车表
CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '购物车项ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  `quantity` INT NOT NULL DEFAULT 1 COMMENT '数量',
  `selected` TINYINT DEFAULT 1 COMMENT '是否选中：0-否，1-是',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='购物车表';

-- 订单表
CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` VARCHAR(50) NOT NULL UNIQUE COMMENT '订单号',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `total_amount` DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  `discount_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '优惠金额',
  `actual_amount` DECIMAL(10,2) NOT NULL COMMENT '实付金额',
  `status` TINYINT DEFAULT 0 COMMENT '订单状态：0-待支付，1-已支付，2-已发货，3-已完成，4-已取消，5-已退款',
  `payment_method` TINYINT NULL COMMENT '支付方式：1-微信支付，2-余额支付',
  `payment_time` TIMESTAMP NULL COMMENT '支付时间',
  `delivery_address` JSON NOT NULL COMMENT '收货地址JSON',
  `delivery_fee` DECIMAL(8,2) DEFAULT 0 COMMENT '运费',
  `remark` TEXT NULL COMMENT '订单备注',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_order_no` (`order_no`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 订单详情表
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单项ID',
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT '商品ID',
  `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称',
  `product_image` VARCHAR(500) NULL COMMENT '商品图片',
  `price` DECIMAL(10,2) NOT NULL COMMENT '商品单价',
  `quantity` INT NOT NULL COMMENT '购买数量',
  `subtotal` DECIMAL(10,2) NOT NULL COMMENT '小计金额',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_product_id` (`product_id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单详情表';

-- 优惠券表
CREATE TABLE IF NOT EXISTS `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '优惠券ID',
  `name` VARCHAR(100) NOT NULL COMMENT '优惠券名称',
  `type` TINYINT NOT NULL COMMENT '类型：1-满减券，2-折扣券，3-无门槛券',
  `value` DECIMAL(10,2) NOT NULL COMMENT '优惠券面值',
  `min_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
  `discount` DECIMAL(3,2) NULL COMMENT '折扣率(0.1-1.0)',
  `total_count` INT NOT NULL COMMENT '发放总数',
  `used_count` INT DEFAULT 0 COMMENT '已使用数量',
  `start_time` TIMESTAMP NOT NULL COMMENT '生效时间',
  `end_time` TIMESTAMP NOT NULL COMMENT '过期时间',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_time_range` (`start_time`, `end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='优惠券表';

-- 用户优惠券表
CREATE TABLE IF NOT EXISTS `user_coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户优惠券ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `coupon_id` BIGINT UNSIGNED NOT NULL COMMENT '优惠券ID',
  `status` TINYINT DEFAULT 0 COMMENT '状态：0-未使用，1-已使用，2-已过期',
  `used_time` TIMESTAMP NULL COMMENT '使用时间',
  `order_id` BIGINT UNSIGNED NULL COMMENT '使用的订单ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_coupon_id` (`coupon_id`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`coupon_id`) REFERENCES `coupons` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户优惠券表';

-- 积分记录表
CREATE TABLE IF NOT EXISTS `point_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '积分记录ID',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  `type` TINYINT NOT NULL COMMENT '类型：1-消费获得，2-签到获得，3-活动获得，4-消费使用，5-过期扣除',
  `points` INT NOT NULL COMMENT '积分变动数量',
  `description` VARCHAR(200) NULL COMMENT '描述',
  `order_id` BIGINT UNSIGNED NULL COMMENT '关联订单ID',
  `expire_time` TIMESTAMP NULL COMMENT '过期时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分记录表';

-- 支付记录表
CREATE TABLE IF NOT EXISTS `payment_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '支付记录ID',
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT '订单ID',
  `payment_no` VARCHAR(100) NOT NULL UNIQUE COMMENT '支付流水号',
  `amount` DECIMAL(10,2) NOT NULL COMMENT '支付金额',
  `payment_method` TINYINT NOT NULL COMMENT '支付方式：1-微信支付，2-余额支付',
  `status` TINYINT DEFAULT 0 COMMENT '状态：0-待支付，1-支付成功，2-支付失败，3-已退款',
  `transaction_id` VARCHAR(100) NULL COMMENT '第三方交易号',
  `paid_at` TIMESTAMP NULL COMMENT '支付时间',
  `refund_at` TIMESTAMP NULL COMMENT '退款时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_order_id` (`order_id`),
  INDEX `idx_payment_no` (`payment_no`),
  INDEX `idx_status` (`status`),
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='支付记录表';

-- 管理员表
CREATE TABLE IF NOT EXISTS `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '管理员ID',
  `username` VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码',
  `real_name` VARCHAR(50) NULL COMMENT '真实姓名',
  `phone` VARCHAR(20) NULL COMMENT '手机号',
  `email` VARCHAR(100) NULL COMMENT '邮箱',
  `role` TINYINT DEFAULT 1 COMMENT '角色：1-超级管理员，2-普通管理员，3-运营人员',
  `status` TINYINT DEFAULT 1 COMMENT '状态：0-禁用，1-正常',
  `last_login_at` TIMESTAMP NULL COMMENT '最后登录时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_username` (`username`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS `system_configs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `key` VARCHAR(100) NOT NULL UNIQUE COMMENT '配置键',
  `value` TEXT NOT NULL COMMENT '配置值',
  `description` VARCHAR(200) NULL COMMENT '配置描述',
  `type` TINYINT DEFAULT 1 COMMENT '类型：1-字符串，2-数字，3-布尔值，4-JSON',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统配置表';

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` BIGINT UNSIGNED NULL COMMENT '操作用户ID',
  `user_type` TINYINT NOT NULL COMMENT '用户类型：1-普通用户，2-管理员',
  `action` VARCHAR(100) NOT NULL COMMENT '操作动作',
  `resource` VARCHAR(100) NULL COMMENT '操作资源',
  `resource_id` BIGINT UNSIGNED NULL COMMENT '资源ID',
  `ip_address` VARCHAR(45) NULL COMMENT 'IP地址',
  `user_agent` TEXT NULL COMMENT '用户代理',
  `request_data` JSON NULL COMMENT '请求数据',
  `response_data` JSON NULL COMMENT '响应数据',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- 插入初始数据

-- 插入商品分类
INSERT INTO `categories` (`name`, `description`, `level`, `sort_order`) VALUES
('新鲜水果', '当季新鲜水果，产地直供', 1, 1),
('时令蔬菜', '绿色有机蔬菜，健康美味', 1, 2),
('粮油调味', '优质粮油调味品', 1, 3),
('肉禽蛋奶', '新鲜肉禽蛋奶制品', 1, 4),
('休闲零食', '健康美味休闲零食', 1, 5);

-- 插入水果子分类
INSERT INTO `categories` (`name`, `description`, `parent_id`, `level`, `sort_order`) VALUES
('苹果', '红富士、青苹果等', 1, 2, 1),
('橙子', '脐橙、血橙等', 1, 2, 2),
('葡萄', '巨峰、阳光玫瑰等', 1, 2, 3);

-- 插入蔬菜子分类
INSERT INTO `categories` (`name`, `description`, `parent_id`, `level`, `sort_order`) VALUES
('叶菜类', '白菜、菠菜、生菜等', 2, 2, 1),
('根茎类', '萝卜、土豆、红薯等', 2, 2, 2),
('瓜果类', '黄瓜、茄子、辣椒等', 2, 2, 3);

-- 插入示例商品
INSERT INTO `products` (`name`, `description`, `price`, `original_price`, `stock`, `category_id`, `brand`, `origin`, `weight`, `unit`, `images`, `tags`, `specifications`) VALUES
('红富士苹果', '新鲜红富士苹果，脆甜多汁，产地直供', 15.80, 20.00, 1000, 6, '笑姐家', '山东烟台', 5.0, '斤', '["apple1.jpg", "apple2.jpg"]', '["新鲜", "脆甜", "产地直供"]', '{"规格": "5斤装", "保质期": "7天", "储存方式": "冷藏"}'),
('新鲜菠菜', '绿色有机菠菜，营养丰富，口感鲜嫩', 8.50, 12.00, 500, 9, '笑姐家', '本地种植', 1.0, '斤', '["spinach1.jpg", "spinach2.jpg"]', '["有机", "新鲜", "营养"]', '{"规格": "1斤装", "保质期": "3天", "储存方式": "冷藏"}'),
('优质大米', '东北优质大米，颗粒饱满，口感香糯', 45.00, 55.00, 200, 3, '笑姐家', '黑龙江', 10.0, '斤', '["rice1.jpg", "rice2.jpg"]', '["优质", "香糯", "东北"]', '{"规格": "10斤装", "保质期": "12个月", "储存方式": "干燥"}');

-- 插入管理员账号
INSERT INTO `admins` (`username`, `password`, `real_name`, `role`) VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', '超级管理员', 1);

-- 插入系统配置
INSERT INTO `system_configs` (`key`, `value`, `description`, `type`) VALUES
('site_name', '笑姐家农产品', '网站名称', 1),
('site_description', '新鲜农产品，产地直供', '网站描述', 1),
('delivery_fee', '5.00', '基础运费', 2),
('min_free_delivery', '99.00', '免运费最低金额', 2),
('points_rate', '0.01', '消费积分比例', 2),
('auto_cancel_minutes', '30', '自动取消订单时间(分钟)', 2);

-- 创建索引优化查询性能
CREATE INDEX `idx_products_category_status` ON `products` (`category_id`, `status`);
CREATE INDEX `idx_orders_user_status` ON `orders` (`user_id`, `status`);
CREATE INDEX `idx_cart_items_user_selected` ON `cart_items` (`user_id`, `selected`);
CREATE INDEX `idx_user_coupons_user_status` ON `user_coupons` (`user_id`, `status`);

-- 创建视图
CREATE VIEW `v_product_sales` AS
SELECT 
  p.id,
  p.name,
  p.price,
  p.sales_count,
  p.view_count,
  c.name as category_name,
  ROUND(p.sales_count * p.price, 2) as total_sales
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.status = 1;

-- 创建存储过程：计算用户积分
DELIMITER //
CREATE PROCEDURE `CalculateUserPoints`(IN user_id BIGINT)
BEGIN
  DECLARE total_points INT DEFAULT 0;
  
  SELECT COALESCE(SUM(points), 0) INTO total_points
  FROM point_records 
  WHERE user_id = user_id AND expire_time > NOW();
  
  UPDATE users SET points = total_points WHERE id = user_id;
  
  SELECT total_points as current_points;
END //
DELIMITER ;

-- 创建触发器：更新商品销量
DELIMITER //
CREATE TRIGGER `tr_order_complete_update_sales` 
AFTER UPDATE ON `orders`
FOR EACH ROW
BEGIN
  IF NEW.status = 3 AND OLD.status != 3 THEN
    UPDATE products p
    INNER JOIN order_items oi ON p.id = oi.product_id
    SET p.sales_count = p.sales_count + oi.quantity
    WHERE oi.order_id = NEW.id;
  END IF;
END //
DELIMITER ;

-- 创建事件：清理过期积分
DELIMITER //
CREATE EVENT `evt_clean_expired_points`
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
  UPDATE point_records 
  SET points = 0 
  WHERE expire_time < NOW() AND points > 0;
END //
DELIMITER ;

-- 显示创建结果
SELECT '数据库表创建完成' as message;
SHOW TABLES;