#!/bin/bash

# 笑姐家农产品微信小程序商城部署脚本
# 使用方法: ./deploy.sh [环境] [操作]
# 环境: dev, test, prod
# 操作: build, deploy, restart, stop, logs, backup

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="xiaojie-farm"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"

# 默认值
ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}

# 环境配置
case $ENVIRONMENT in
  dev)
    ENV_FILE="$PROJECT_ROOT/.env.dev"
    DOCKER_COMPOSE_OVERRIDE="$PROJECT_ROOT/docker/docker-compose.dev.yml"
    ;;
  test)
    ENV_FILE="$PROJECT_ROOT/.env.test"
    DOCKER_COMPOSE_OVERRIDE="$PROJECT_ROOT/docker/docker-compose.test.yml"
    ;;
  prod)
    ENV_FILE="$PROJECT_ROOT/.env.prod"
    DOCKER_COMPOSE_OVERRIDE="$PROJECT_ROOT/docker/docker-compose.prod.yml"
    ;;
  *)
    echo -e "${RED}错误: 无效的环境参数 '$ENVIRONMENT'${NC}"
    echo "支持的环境: dev, test, prod"
    exit 1
    ;;
esac

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    # 检查Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        exit 1
    fi
    
    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js"
        exit 1
    fi
    
    log_success "系统依赖检查完成"
}

# 检查环境文件
check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "环境配置文件 $ENV_FILE 不存在，将使用默认配置"
        return 1
    fi
    
    log_info "使用环境配置文件: $ENV_FILE"
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
    return 0
}

# 构建项目
build_project() {
    log_info "开始构建项目..."
    
    cd "$PROJECT_ROOT"
    
    # 安装后端依赖
    log_info "安装后端依赖..."
    cd backend
    npm install --production
    cd ..
    
    # 安装管理后台依赖
    log_info "安装管理后台依赖..."
    cd admin
    npm install --production
    cd ..
    
    # 构建前端
    log_info "构建前端小程序..."
    # 这里可以添加前端构建逻辑
    
    log_success "项目构建完成"
}

# 部署项目
deploy_project() {
    log_info "开始部署项目到 $ENVIRONMENT 环境..."
    
    cd "$PROJECT_ROOT/docker"
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f docker-compose.yml down --remove-orphans
    
    # 启动服务
    log_info "启动服务..."
    if [ -f "$DOCKER_COMPOSE_OVERRIDE" ]; then
        docker-compose -f docker-compose.yml -f "$DOCKER_COMPOSE_OVERRIDE" up -d
    else
        docker-compose -f docker-compose.yml up -d
    fi
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    check_service_status
    
    log_success "项目部署完成"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    
    cd "$PROJECT_ROOT/docker"
    
    if [ -f "$DOCKER_COMPOSE_OVERRIDE" ]; then
        docker-compose -f docker-compose.yml -f "$DOCKER_COMPOSE_OVERRIDE" restart
    else
        docker-compose -f docker-compose.yml restart
    fi
    
    log_success "服务重启完成"
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    
    cd "$PROJECT_ROOT/docker"
    
    if [ -f "$DOCKER_COMPOSE_OVERRIDE" ]; then
        docker-compose -f docker-compose.yml -f "$DOCKER_COMPOSE_OVERRIDE" down
    else
        docker-compose -f docker-compose.yml down
    fi
    
    log_success "服务已停止"
}

# 查看日志
show_logs() {
    log_info "显示服务日志..."
    
    cd "$PROJECT_ROOT/docker"
    
    if [ -f "$DOCKER_COMPOSE_OVERRIDE" ]; then
        docker-compose -f docker-compose.yml -f "$DOCKER_COMPOSE_OVERRIDE" logs -f
    else
        docker-compose -f docker-compose.yml logs -f
    fi
}

# 备份数据
backup_data() {
    log_info "开始备份数据..."
    
    BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    cd "$PROJECT_ROOT/docker"
    
    # 备份MySQL数据
    log_info "备份MySQL数据..."
    docker-compose exec -T mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD:-xiaojie123456}" xiaojie_farm > "$BACKUP_DIR/database.sql"
    
    # 备份上传文件
    log_info "备份上传文件..."
    if [ -d "$PROJECT_ROOT/backend/uploads" ]; then
        tar -czf "$BACKUP_DIR/uploads.tar.gz" -C "$PROJECT_ROOT/backend" uploads
    fi
    
    # 备份配置文件
    log_info "备份配置文件..."
    cp "$ENV_FILE" "$BACKUP_DIR/" 2>/dev/null || true
    
    log_success "数据备份完成: $BACKUP_DIR"
}

# 检查服务状态
check_service_status() {
    log_info "检查服务状态..."
    
    cd "$PROJECT_ROOT/docker"
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    if [ -f "$DOCKER_COMPOSE_OVERRIDE" ]; then
        docker-compose -f docker-compose.yml -f "$DOCKER_COMPOSE_OVERRIDE" ps
    else
        docker-compose -f docker-compose.yml ps
    fi
    
    # 检查关键服务
    log_info "检查关键服务状态..."
    
    # 检查MySQL
    if docker-compose exec -T mysql mysqladmin ping -h localhost -u root -p"${MYSQL_ROOT_PASSWORD:-xiaojie123456}" &>/dev/null; then
        log_success "MySQL服务正常"
    else
        log_error "MySQL服务异常"
    fi
    
    # 检查Redis
    if docker-compose exec -T redis redis-cli ping &>/dev/null; then
        log_success "Redis服务正常"
    else
        log_error "Redis服务异常"
    fi
    
    # 检查后端API
    if curl -f http://localhost:3000/health &>/dev/null; then
        log_success "后端API服务正常"
    else
        log_error "后端API服务异常"
    fi
}

# 显示帮助信息
show_help() {
    echo "笑姐家农产品微信小程序商城部署脚本"
    echo ""
    echo "使用方法: $0 [环境] [操作]"
    echo ""
    echo "环境:"
    echo "  dev    - 开发环境"
    echo "  test   - 测试环境"
    echo "  prod   - 生产环境"
    echo ""
    echo "操作:"
    echo "  build   - 构建项目"
    echo "  deploy  - 部署项目"
    echo "  restart - 重启服务"
    echo "  stop    - 停止服务"
    echo "  logs    - 查看日志"
    echo "  backup  - 备份数据"
    echo "  status  - 检查状态"
    echo "  help    - 显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 dev deploy    # 部署到开发环境"
    echo "  $0 prod restart  # 重启生产环境服务"
    echo "  $0 test backup   # 备份测试环境数据"
}

# 主函数
main() {
    log_info "开始执行 $ACTION 操作，环境: $ENVIRONMENT"
    
    # 检查依赖
    check_dependencies
    
    # 检查环境文件
    check_env_file
    
    # 根据操作执行相应功能
    case $ACTION in
        build)
            build_project
            ;;
        deploy)
            build_project
            deploy_project
            ;;
        restart)
            restart_services
            ;;
        stop)
            stop_services
            ;;
        logs)
            show_logs
            ;;
        backup)
            backup_data
            ;;
        status)
            check_service_status
            ;;
        help)
            show_help
            ;;
        *)
            log_error "无效的操作参数 '$ACTION'"
            show_help
            exit 1
            ;;
    esac
    
    log_success "操作执行完成"
}

# 执行主函数
main "$@"