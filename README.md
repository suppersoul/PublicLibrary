# 笑姐家农产品微信小程序商城

## 项目简介

基于微信小程序开发的农产品电商平台，为"笑姐家农产品"品牌提供完整的线上销售解决方案。

## 功能特性

- 🛒 完整的电商功能（商品展示、购物车、订单管理、支付）
- 👥 用户管理系统（注册、登录、个人中心）
- 🏪 商家管理后台（商品管理、订单处理、库存管理）
- 📊 数据统计分析（销售数据、用户行为分析）
- 🎯 营销工具（优惠券、积分、秒杀、拼团）
- 🔒 安全支付（微信支付集成、数据加密）

## 技术架构

### 前端
- 微信小程序原生开发
- WXML + WXSS + JavaScript
- Vant Weapp UI组件库

### 后端
- Node.js + Express.js
- MySQL 8.0 数据库
- Redis 6.0 缓存
- JWT 身份认证

### 部署
- Docker 容器化
- Nginx 负载均衡
- 阿里云OSS文件存储

## 项目结构

```
farm-product-mini-program/
├── frontend/                 # 微信小程序前端
│   ├── pages/               # 页面文件
│   ├── components/          # 组件文件
│   ├── utils/               # 工具函数
│   └── app.js              # 小程序入口
├── backend/                  # 后端服务
│   ├── src/                 # 源代码
│   ├── config/              # 配置文件
│   ├── routes/              # 路由文件
│   └── package.json         # 依赖配置
├── database/                 # 数据库相关
│   ├── schema/              # 数据库表结构
│   └── seeds/               # 初始数据
├── docs/                     # 项目文档
└── docker/                   # Docker配置
```

## 快速开始

### 环境要求
- Node.js 16+
- MySQL 8.0+
- Redis 6.0+
- 微信开发者工具

### 安装步骤

1. 克隆项目
```bash
git clone https://github.com/your-username/farm-product-mini-program.git
cd farm-product-mini-program
```

2. 安装后端依赖
```bash
cd backend
npm install
```

3. 配置数据库
```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE farm_product_db;

# 导入表结构
mysql -u root -p farm_product_db < database/schema/init.sql
```

4. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

5. 启动后端服务
```bash
npm run dev
```

6. 配置小程序
- 使用微信开发者工具打开 `frontend` 目录
- 配置小程序AppID
- 修改 `config.js` 中的API地址

## 开发指南

### 添加新功能
1. 在后端 `src/controllers` 中添加控制器
2. 在 `src/routes` 中定义路由
3. 在前端添加对应页面和组件
4. 更新API文档

### 数据库操作
- 使用 Sequelize ORM 进行数据库操作
- 新增表结构在 `database/schema` 目录
- 数据迁移使用 Sequelize CLI

### 测试
```bash
# 运行单元测试
npm run test

# 运行集成测试
npm run test:integration
```

## 部署说明

### Docker部署
```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d
```

### 生产环境配置
1. 配置HTTPS证书
2. 设置环境变量
3. 配置数据库连接池
4. 设置日志级别

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 联系方式

- 项目维护者: [您的姓名]
- 邮箱: [您的邮箱]
- 微信: [您的微信号]

## 更新日志

### v1.0.0 (2024-08-22)
- 初始版本发布
- 基础电商功能
- 用户管理系统
- 商家管理后台

---

*本项目为农产品电商提供完整的解决方案，如有问题请提交Issue或联系维护者*