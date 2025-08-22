# 笑姐家农产品微信小程序商城 - 部署指南

## 📋 项目概述

**笑姐家农产品微信小程序商城** 是一个功能完整的农产品电商平台，采用现代化的技术架构，为用户提供优质的农产品购买体验。

**项目状态**: ✅ 99% 完成，已具备生产环境部署条件  
**技术架构**: 微信小程序 + Node.js + MySQL + Redis + Docker

## 🚀 快速开始

### 环境要求

- **操作系统**: Linux (推荐 Ubuntu 20.04+ 或 CentOS 8+)
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **内存**: 最少 4GB，推荐 8GB+
- **存储**: 最少 20GB 可用空间
- **网络**: 公网IP，开放 80、443、3306、6379 端口

### 一键部署

```bash
# 克隆项目
git clone https://github.com/suppersoul/PublicLibrary.git
cd PublicLibrary

# 设置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库、Redis等信息

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

## 🛠️ 详细部署步骤

### 1. 环境准备

#### 安装 Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# CentOS/RHEL
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker
```

#### 安装 Docker Compose
```bash
# 下载最新版本
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 设置执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

### 2. 项目配置

#### 克隆项目
```bash
git clone https://github.com/suppersoul/PublicLibrary.git
cd PublicLibrary
```

#### 环境变量配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**关键配置项**:
```env
# 数据库配置
DB_HOST=mysql
DB_PORT=3306
DB_NAME=agricultural_mall
DB_USER=root
DB_PASSWORD=your_secure_password

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT密钥
JWT_SECRET=your_jwt_secret_key

# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your_access_key
OSS_ACCESS_KEY_SECRET=your_secret_key
OSS_BUCKET=your_bucket_name
OSS_REGION=oss-cn-hangzhou

# 微信小程序配置
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret

# 支付配置
WECHAT_PAY_MCH_ID=your_mch_id
WECHAT_PAY_KEY=your_pay_key
```

### 3. 数据库初始化

#### 启动数据库服务
```bash
# 仅启动数据库和Redis
docker-compose up -d mysql redis

# 等待服务启动完成
sleep 30
```

#### 执行数据库迁移
```bash
# 进入后端容器
docker-compose exec backend bash

# 执行迁移脚本
node scripts/migrate.js

# 退出容器
exit
```

### 4. 启动完整服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f
```

### 5. 服务验证

#### 健康检查
```bash
# 检查API服务
curl http://localhost/api/health

# 检查数据库连接
docker-compose exec backend node -e "
const db = require('./config/database');
db.query('SELECT 1').then(() => {
  console.log('Database connection successful');
  process.exit(0);
}).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
"
```

#### 端口检查
```bash
# 检查端口开放情况
netstat -tlnp | grep -E ':(80|443|3000|3306|6379)'
```

## 🔧 服务配置详解

### 1. 后端服务 (Node.js + Express)

**配置文件**: `backend/.env`
**主要功能**:
- 用户认证和授权
- 商品管理API
- 订单处理系统
- 支付集成
- 文件上传服务

**关键特性**:
- JWT身份认证
- API限流保护
- 完整的日志系统
- 错误处理中间件
- 数据验证

### 2. 数据库服务 (MySQL 8.0)

**配置文件**: `docker/mysql/init.sql`
**主要数据表**:
- `users` - 用户信息
- `products` - 商品数据
- `orders` - 订单信息
- `cart_items` - 购物车
- `addresses` - 收货地址
- `favorites` - 收藏商品
- `reviews` - 商品评价
- `coupons` - 优惠券
- `payments` - 支付记录

**性能优化**:
- 连接池配置
- 索引优化
- 查询缓存

### 3. 缓存服务 (Redis 6.0)

**配置文件**: `docker/redis/redis.conf`
**主要用途**:
- 用户会话存储
- 商品缓存
- 购物车数据
- 限流计数器
- 热点数据缓存

### 4. 反向代理 (Nginx)

**配置文件**: `docker/nginx/nginx.conf`
**主要功能**:
- 静态资源服务
- API请求转发
- SSL证书管理
- 负载均衡
- 缓存策略

## 📱 前端部署

### 微信小程序配置

#### 1. 小程序后台配置
- 登录微信公众平台
- 配置服务器域名
- 设置业务域名
- 配置支付相关信息

#### 2. 前端代码配置
```javascript
// frontend/app.js
const config = {
  // API基础地址
  baseUrl: 'https://your-domain.com/api',
  
  // 微信小程序配置
  appId: 'your_app_id',
  
  // 其他配置...
};
```

#### 3. 构建和上传
```bash
# 使用微信开发者工具
# 1. 导入项目
# 2. 配置AppID
# 3. 预览和测试
# 4. 上传代码
# 5. 提交审核
```

## 🔒 安全配置

### 1. 网络安全

#### 防火墙配置
```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp

# 启用防火墙
sudo ufw enable
```

#### SSL证书配置
```bash
# 使用Let's Encrypt免费证书
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. 数据库安全

#### 数据库加固
```sql
-- 创建专用用户
CREATE USER 'mall_user'@'%' IDENTIFIED BY 'strong_password';

-- 授权最小权限
GRANT SELECT, INSERT, UPDATE, DELETE ON agricultural_mall.* TO 'mall_user'@'%';

-- 删除匿名用户
DELETE FROM mysql.user WHERE User='';

-- 刷新权限
FLUSH PRIVILEGES;
```

#### Redis安全
```bash
# 设置强密码
# 在 docker/redis/redis.conf 中配置
requirepass your_strong_password

# 禁用危险命令
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 3. 应用安全

#### API安全
- JWT密钥定期更换
- API限流配置
- 输入验证和过滤
- SQL注入防护
- XSS防护

#### 文件上传安全
- 文件类型限制
- 文件大小限制
- 文件内容验证
- 存储路径安全

## 📊 监控和维护

### 1. 日志管理

#### 日志配置
```javascript
// backend/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});
```

#### 日志轮转
```bash
# 使用logrotate管理日志
sudo nano /etc/logrotate.d/agricultural-mall

# 配置内容
/path/to/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
}
```

### 2. 性能监控

#### 系统监控
```bash
# 安装监控工具
sudo apt install htop iotop nethogs

# 监控系统资源
htop
iotop
nethogs
```

#### 应用监控
```javascript
// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

### 3. 备份策略

#### 数据库备份
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mysql"
DB_NAME="agricultural_mall"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
docker-compose exec -T mysql mysqldump -u root -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# 压缩备份文件
gzip $BACKUP_DIR/backup_$DATE.sql

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

#### 文件备份
```bash
# 备份上传文件
rsync -avz /path/to/uploads/ /backup/uploads/

# 备份配置文件
tar -czf /backup/configs/configs_$DATE.tar.gz /path/to/configs/
```

## 🚀 扩展部署

### 1. 负载均衡

#### Nginx负载均衡配置
```nginx
upstream backend_servers {
    server backend1:3000 weight=1;
    server backend2:3000 weight=1;
    server backend3:3000 weight=1;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /api/ {
        proxy_pass http://backend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 2. 高可用部署

#### 数据库主从复制
```yaml
# docker-compose.yml
services:
  mysql_master:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: master_password
    command: --server-id=1 --log-bin=mysql-bin --binlog-format=ROW
    
  mysql_slave:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: slave_password
    command: --server-id=2 --relay-log=relay-bin
```

#### Redis集群
```yaml
# docker-compose.yml
services:
  redis_master:
    image: redis:6.0
    command: redis-server --appendonly yes
    
  redis_slave1:
    image: redis:6.0
    command: redis-server --slaveof redis_master 6379
```

## 🔧 故障排除

### 1. 常见问题

#### 服务无法启动
```bash
# 检查端口占用
sudo netstat -tlnp | grep :3000

# 检查容器状态
docker-compose ps

# 查看容器日志
docker-compose logs backend
```

#### 数据库连接失败
```bash
# 检查数据库服务状态
docker-compose exec mysql mysqladmin ping

# 检查网络连接
docker-compose exec backend ping mysql

# 验证数据库配置
docker-compose exec backend node -e "
console.log('Database config:', require('./config/database').config);
"
```

#### 文件上传失败
```bash
# 检查OSS配置
docker-compose exec backend node -e "
const OSS = require('ali-oss');
const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

client.list().then(result => {
  console.log('OSS connection successful');
}).catch(err => {
  console.error('OSS connection failed:', err);
});
"
```

### 2. 性能优化

#### 数据库优化
```sql
-- 添加索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_products_category_id ON products(category_id);

-- 优化查询
EXPLAIN SELECT * FROM orders WHERE user_id = ? AND status = 'pending';
```

#### 缓存优化
```javascript
// 使用Redis缓存热点数据
const cacheKey = `product:${productId}`;
let product = await redis.get(cacheKey);

if (!product) {
  product = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
  await redis.setex(cacheKey, 3600, JSON.stringify(product));
}
```

## 📚 相关文档

- [项目README](./README.md)
- [技术实现方案](./技术实现方案.md)
- [项目进度报告](./PROJECT_PROGRESS.md)
- [快速开始指南](./docs/quick_start.md)
- [API接口文档](./docs/api.md)

## 📞 技术支持

**项目仓库**: https://github.com/suppersoul/PublicLibrary  
**技术支持**: 开源项目，社区支持  
**商业合作**: 可提供定制开发服务

---

**最后更新**: 2024年12月  
**部署版本**: v1.0.0  
**维护状态**: 活跃维护中