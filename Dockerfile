# ==========================================
# 阶段 1: 前端 UI 构建 (Node.js)
# ==========================================
FROM node:25-alpine3.23 AS ui-builder
WORKDIR /app

# 可选构建加速源 (国内构建时可传入 --build-arg NPM_REGISTRY=https://registry.npmmirror.com)
ARG NPM_REGISTRY=""
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry $NPM_REGISTRY; fi

# 安装基础依赖
RUN apk upgrade --no-cache

# 复制 UI 依赖定义
COPY ui/package*.json ./
RUN npm ci

# 复制 UI 源码
COPY ui/ ./

# 构建前端应用 (包含 Chrome 90 兼容降级 & 汉化资源)
# 生成输出目录为 /app/out
RUN npx vite build

# ==========================================
# 阶段 2: 后端 Go 服务编译
# ==========================================
FROM golang:1.27.3-alpine3.24 AS builder
WORKDIR /app

# 可选 Go 模块代理源 (默认使用 goproxy.cn 加速，也可传入覆盖)
ARG GOPROXY="https://goproxy.cn,direct"
ENV GOPROXY=${GOPROXY}

# 安装编译 SQLite CGO 所需的 gcc 与依赖库
RUN apk upgrade --no-cache && \
    apk add --no-cache gcc musl-dev sqlite-dev binutils binutils-gold

# 开启 CGO
ENV CGO_ENABLED=1 GOOS=linux GOWORK=off

# 依赖下载
COPY transports/go.mod transports/go.sum ./
RUN go mod download

# 复制 transports 源码
COPY transports/ ./

# 将编译完成的前端 UI 静态资源嵌入 bifrost-http
COPY --from=ui-builder /app/out ./bifrost-http/ui

# 静态链接编译二进制文件
# 支持通过 --build-arg VERSION=xxx 传入自定义版本号；若未指定则自动从 transports/version 动态读取上游版本
ARG VERSION=""
RUN CURRENT_VER="${VERSION:-$(cat version 2>/dev/null || echo '2.4.0')}" && \
    CURRENT_VER="${CURRENT_VER#v}" && \
    go build \
    -ldflags="-w -s -X main.Version=v${CURRENT_VER} -extldflags '-static'" \
    -a -trimpath \
    -tags "sqlite_static" \
    -o /app/main \
    ./bifrost-http

RUN test -f /app/main || (echo "Build failed" && exit 1)

# ==========================================
# 阶段 3: 最小化轻量运行时镜像
# ==========================================
FROM alpine:3.23.5
WORKDIR /app

# 运行时基础系统库
RUN apk upgrade --no-cache && \
    apk add --no-cache musl libgcc ca-certificates zlib tzdata

# 默认时区设为中国标准时间 (Asia/Shanghai)
ENV TZ=Asia/Shanghai

# 从构建阶段复制二进制与启动脚本
COPY --from=builder /app/main .
COPY --from=builder /app/docker-entrypoint.sh .

# 环境变量配置
ARG ARG_APP_PORT=8080
ARG ARG_APP_HOST=0.0.0.0
ARG ARG_LOG_LEVEL=info
ARG ARG_LOG_STYLE=console
ARG ARG_APP_DIR=/app/data

ENV APP_PORT=$ARG_APP_PORT \
    APP_HOST=$ARG_APP_HOST \
    LOG_LEVEL=$ARG_LOG_LEVEL \
    LOG_STYLE=$ARG_LOG_STYLE \
    APP_DIR=$ARG_APP_DIR

# 初始化运行目录与用户权限
RUN mkdir -p "$APP_DIR/logs" && \
    adduser -D -s /bin/sh appuser && \
    chown -R appuser:appuser /app && \
    chown -R appuser:0 "$APP_DIR" && \
    { [ "$APP_DIR" = "/app" ] || chmod -R g=rwX "$APP_DIR"; } && \
    chmod +x /app/docker-entrypoint.sh

USER 1000:0

# 数据持久化卷
VOLUME ["${APP_DIR}"]
EXPOSE 8080

# 容器健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/main"]
