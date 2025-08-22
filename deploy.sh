#!/bin/bash

# 笑姐家农产品微信小程序商城部署脚本
# 使用方法: ./deploy.sh [环境] [操作]
# 环境: dev, test, prod
# 操作: build, deploy, restart, logs, stop

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
PROJECT_NAME="farm-product-mini-program"
DOCKER_COMPOSE_FILE="docker/docker-compose.yml"

# 默认值
ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}

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
    log_info "检查部署依赖..."
    
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
    
    # 检查Git
    if ! command -v git &> /dev/null; then
        log_error "Git未安装，请先安装Git"
        exit 1
    fi
    
    log_success "依赖检查完成"
}

# 环境配置
setup_environment() {
    log_info "配置环境: $ENVIRONMENT"
    
    case $ENVIRONMENT in
        dev)
            export NODE_ENV=development
            export COMPOSE_PROJECT_NAME="${PROJECT_NAME}-dev"
            ;;
        test)
            export NODE_ENV=test
            export COMPOSE_PROJECT_NAME="${PROJECT_NAME}-test"
            ;;
        prod)
            export NODE_ENV=production
            export COMPOSE_PROJECT_NAME="${PROJECT_NAME}-prod"
            ;;
        *)
            log_error "不支持的环境: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    log_success "环境配置完成: $NODE_ENV"
}

# 构建项目
build_project() {
    log_info "开始构建项目..."
    
    # 安装后端依赖
    log_info "安装后端依赖..."
    cd backend
    npm ci --only=production
    cd ..
    
    # 构建Docker镜像
    log_info "构建Docker镜像..."
    docker-compose -f $DOCKER_COMPOSE_FILE build
    
    log_success "项目构建完成"
}

# 部署项目
deploy_project() {
    log_info "开始部署项目..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    # 启动服务
    log_info "启动服务..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 检查服务状态
    check_services
    
    log_success "项目部署完成"
}

# 重启服务
restart_services() {
    log_info "重启服务..."
    
    docker-compose -f $DOCKER_COMPOSE_FILE restart
    
    log_success "服务重启完成"
}

# 停止服务
stop_services() {
    log_info "停止服务..."
    
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    log_success "服务停止完成"
}

# 查看日志
show_logs() {
    log_info "显示服务日志..."
    
    docker-compose -f $DOCKER_COMPOSE_FILE logs -f
}

# 检查服务状态
check_services() {
    log_info "检查服务状态..."
    
    # 检查容器状态
    local containers=$(docker-compose -f $DOCKER_COMPOSE_FILE ps -q)
    
    for container in $containers; do
        local status=$(docker inspect --format='{{.State.Status}}' $container)
        local name=$(docker inspect --format='{{.Name}}' $container | sed 's/\///')
        
        if [ "$status" = "running" ]; then
            log_success "容器 $name 运行正常"
        else
            log_error "容器 $name 状态异常: $status"
        fi
    done
    
    # 检查端口监听
    log_info "检查端口监听..."
    netstat -tlnp | grep -E ":(80|443|3000|3306|6379)" || log_warning "部分端口未监听"
}

# 数据库迁移
run_migrations() {
    log_info "运行数据库迁移..."
    
    # 等待数据库启动
    log_info "等待数据库启动..."
    sleep 20
    
    # 运行迁移
    docker-compose -f $DOCKER_COMPOSE_FILE exec backend npm run db:migrate
    
    log_success "数据库迁移完成"
}

# 数据备份
backup_database() {
    log_info "备份数据库..."
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $backup_dir
    
    docker-compose -f $DOCKER_COMPOSE_FILE exec mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} farm_product_db > "$backup_dir/database.sql"
    
    log_success "数据库备份完成: $backup_dir/database.sql"
}

# 清理资源
cleanup() {
    log_info "清理资源..."
    
    # 清理未使用的镜像
    docker image prune -f
    
    # 清理未使用的容器
    docker container prune -f
    
    # 清理未使用的网络
    docker network prune -f
    
    log_success "资源清理完成"
}

# 显示帮助信息
show_help() {
    echo "笑姐家农产品微信小程序商城部署脚本"
    echo ""
    echo "使用方法: $0 [环境] [操作]"
    echo ""
    echo "环境:"
    echo "  dev   - 开发环境"
    echo "  test  - 测试环境"
    echo "  prod  - 生产环境"
    echo ""
    echo "操作:"
    echo "  build   - 构建项目"
    echo "  deploy  - 部署项目"
    echo "  restart - 重启服务"
    echo "  stop    - 停止服务"
    echo "  logs    - 查看日志"
    echo "  status  - 检查状态"
    echo "  backup  - 备份数据库"
    echo "  cleanup - 清理资源"
    echo "  help    - 显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 dev deploy    # 部署到开发环境"
    echo "  $0 prod build    # 构建生产环境"
    echo "  $0 test logs     # 查看测试环境日志"
}

# 主函数
main() {
    log_info "开始执行部署脚本..."
    log_info "环境: $ENVIRONMENT, 操作: $ACTION"
    
    # 检查依赖
    check_dependencies
    
    # 配置环境
    setup_environment
    
    case $ACTION in
        build)
            build_project
            ;;
        deploy)
            build_project
            deploy_project
            run_migrations
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
        status)
            check_services
            ;;
        backup)
            backup_database
            ;;
        cleanup)
            cleanup
            ;;
        help)
            show_help
            ;;
        *)
            log_error "不支持的操作: $ACTION"
            show_help
            exit 1
            ;;
    esac
    
    log_success "部署脚本执行完成"
}

# 捕获信号
trap 'log_error "部署脚本被中断"; exit 1' INT TERM

# 执行主函数
main "$@"