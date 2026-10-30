# Bifrost AI 网关 (中文汉化 & Chrome 90 兼容 Docker 版)

本项目是基于开源高效 AI 网关 [Maxim AI Bifrost](https://github.com/maximhq/bifrost) 的定制构建版本，专门针对**全中文界面本地化**与**低版本现代浏览器（兼容至 Chrome 90+）**进行了完整适配与工程级改造，并提供完整的 Docker 容器化开箱即用支持。

---

## 🌟 本版本核心特性

### 1. 全界面中文本地化 (汉化)
- **全局导航与菜单**：全面汉化侧边栏、顶部导航条、主题模式切换、快速搜索菜单与快捷提示。
- **监控与仪表盘**：总览概览看板、调用量折线/柱状图、Token 消耗统计、响应延迟分布、网关开销与吞吐率指标全部完成中文适配。
- **请求与日志中心**：LLM 调用日志表、多维度筛选抽屉（状态、模型、供应商、客户端、会话、成本等）、详细请求入参/出参透视抽屉汉化。
- **模型与密钥管理**：模型供应商接入向导、虚拟密钥（Virtual Key）配额管理、速率限制、预算告警。
- **智能路由与护栏**：基于 CEL 语法的智能路由规则树、安全护栏、熔断降级。
- **初始化与权限**：开箱即见的安装令牌（Setup Token）引导向导、管理员账户注册与登录页面纯正中文体验。

### 2. Chrome 90+ 浏览器向下兼容
针对较低版本 Chromium 内核环境（如特定企业定制内网浏览器、国产安全操作系统内置浏览器、Chrome 90+）：
- **现代 JS 语法与 API 降级**：
  - 自动注入全局运行时 Polyfill：`crypto.randomUUID()`（Chrome 92+）、`Object.hasOwn()`（Chrome 93+）、`Array.prototype.at()`（Chrome 92+）、`String.prototype.at()`（Chrome 92+）、`structuredClone()`（Chrome 98+）。
  - esbuild 编译目标设定为 `es2020` + `chrome90`。
- **Tailwind CSS v4 样式降级**：
  - 集成 `LightningCSS` 转译引擎，将原生 CSS 嵌套（`& .child`，Chrome 112+）平铺展平为 Chrome 90 可识别的选择器。
  - 将现代色域（`oklch`、`color-mix`，Chrome 111+）自动下采样为通用 `sRGB/RGB` 格式。

### 3. 开箱即用的 Docker 容器化
- 多阶段镜像构建，内置国内镜像源参数（npmmirror + goproxy.cn），国内网络环境下构建流畅。
- 采用静态 CGO 编译与 Alpine 最小化轻量运行时。
- 内置容器健康检查（Health Check）与时区（Asia/Shanghai）设置。

---

## 🚀 快速启动

### 方式一：使用 Docker Compose（推荐）

1. 进入项目根目录：
   ```bash
   cd E:\github\bifrost
   ```

2. 启动容器（首次会自动执行多阶段构建）：
   ```bash
   docker compose up -d --build
   ```

3. 查看容器运行日志：
   ```bash
   docker compose logs -f
   ```

4. 停止容器：
   ```bash
   docker compose down
   ```

---

### 方式二：使用标准 Docker CLI 构建与运行

1. **构建镜像**（支持传入加速源）：
   ```bash
   docker build \
     --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
     --build-arg GOPROXY=https://goproxy.cn,direct \
     -t bifrost-zh:latest .
   ```

2. **创建本地数据挂载目录并启动容器**：
   ```bash
   # 创建本地持久化数据目录
   mkdir -p ./data

   # 启动容器
   docker run -d \
     --name bifrost \
     --restart unless-stopped \
     -p 8080:8080 \
     -e APP_PORT=8080 \
     -e APP_HOST=0.0.0.0 \
     -e LOG_LEVEL=info \
     -e LOG_STYLE=console \
     -e BIFROST_SETUP_TOKEN=bifrost-admin-token \
     -e TZ=Asia/Shanghai \
     -v $(pwd)/data:/app/data \
     bifrost-zh:latest
   ```

---

## 🔑 首次初始化与使用向导

1. **访问管理控制台**：
   在浏览器（包括 Chrome 90 及以上任意版本）中打开：
   [http://localhost:8080](http://localhost:8080)

2. **输入安装令牌 (Setup Token)**：
   初次启动时，由于尚未创建管理员账户，系统处于安全锁定模式。
   - 默认安装令牌：`bifrost-admin-token`（在 `docker-compose.yml` 中的 `BIFROST_SETUP_TOKEN` 环境变量中设定，您可自由更改）。
   - 输入安装令牌后点击**“继续”**。

3. **创建管理员账户**：
   在安全设置页面输入您想设置的管理员用户名与密码，保存后管理控制台即正式解锁。

4. **配置模型供应商**：
   进入**“模型管理 -> 模型供应商”**，添加您需要使用的 API 凭据：
   - OpenAI / Azure OpenAI
   - Anthropic (Claude)
   - DeepSeek
   - Google Gemini
   - AWS Bedrock / 阿里云百炼 / 各种兼容 OpenAI 格式的自定义供应商

5. **生成虚拟密钥 (Virtual Key)**：
   进入**“组织治理 -> 虚拟密钥”**，点击**“新建虚拟密钥”**：
   - 获得以 `bf-` 开头的标准密钥。
   - 即可在任意现有 AI 客户端（如 NextChat, LobeChat, Cursor, Dify 等）中将请求地址配置为 `http://localhost:8080/v1`，享受统一聚合、智能路由、用量监控与风控审计。

---

## ⚙️ 核心环境变量说明

| 环境变量 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `APP_PORT` | `8080` | Bifrost 网关服务监听端口 |
| `APP_HOST` | `0.0.0.0` | 监听的主机网络接口 |
| `BIFROST_SETUP_TOKEN` | `bifrost-admin-token` | 首次初始化控制台的访问令牌 |
| `APP_DIR` | `/app/data` | 数据持久化存储目录（包含 SQLite 库与日志） |
| `LOG_LEVEL` | `info` | 日志级别：`debug` / `info` / `warn` / `error` |
| `LOG_STYLE` | `console` | 日志输出风格：`console`（彩色可读） / `json`（生产结构化） |
| `TZ` | `Asia/Shanghai` | 容器默认系统时区 |
