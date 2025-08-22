# 笑姐家农产品微信小程序商城

## 项目简介
基于"笑姐家农产品"品牌，开发的专业农产品微信小程序商城，为用户提供优质的农产品购买体验，帮助农户拓展销售渠道。

## 项目结构
```
├── frontend/          # 微信小程序前端
├── backend/           # 后端API服务
├── admin/             # 管理后台
├── docs/              # 项目文档
├── scripts/           # 部署脚本
└── docker/            # Docker配置
```

## 技术栈
- **前端**: 微信小程序原生开发
- **后端**: Node.js + Express.js + MySQL
- **缓存**: Redis
- **文件存储**: 阿里云OSS
- **部署**: Docker + Nginx

## 快速开始

### 环境要求
- Node.js 16+
- MySQL 8.0
- Redis 6.0
- 微信开发者工具

### 安装依赖
```bash
# 后端依赖
cd backend
npm install

# 管理后台依赖
cd admin
npm install
```

### 配置环境
1. 复制 `backend/.env.example` 为 `backend/.env`
2. 配置数据库连接信息
3. 配置微信小程序AppID和密钥
4. 配置阿里云OSS信息

### 启动服务
```bash
# 启动后端服务
cd backend
npm run dev

# 启动管理后台
cd admin
npm run dev
```

### 小程序开发
1. 使用微信开发者工具打开 `frontend` 目录
2. 配置小程序AppID
3. 开始开发

## 功能特性
- 用户注册登录（微信授权）
- 商品展示与搜索
- 购物车与订单管理
- 微信支付集成
- 营销活动系统
- 积分与优惠券
- 商家管理后台
- 数据统计分析

## 开发进度
- [x] 项目需求分析
- [x] 技术方案设计
- [x] 项目进度规划
- [ ] 前端小程序开发
- [ ] 后端API开发
- [ ] 管理后台开发
- [ ] 测试与部署

## 贡献指南
1. Fork 项目
2. 创建功能分支
3. 提交代码
4. 创建 Pull Request

## 许可证
MIT License

## 联系方式
- 项目负责人：[您的姓名]
- 邮箱：[您的邮箱]
- 微信：[您的微信号]