# Terminal-LittleBaby

Terminal-LittleBaby 是一个自托管的个人管理控制台，暗色主题，桌面端优先。集成以下功能模块：

- **财务管理** — 资产账户、负债账户、交易记录、月度预算、储蓄目标、收支趋势图表
- **课程表** — 周视图课表，支持多学期、多角色（我/伴侣）、按周切换
- **LittleBaby Agent 管理** — 定时任务（Cron）管理、记忆文件浏览与搜索、Digest 去重历史
- **LLM 用量监控** — API 渠道（公司/个人）费用追踪，按时段和日限额自动切换渠道

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 7 |
| UI 组件 | Ant Design 6（暗色主题） |
| 图表 | ECharts 6 |
| 后端 | Express 5 + TypeScript |
| 数据库 | MySQL 8.0（`mysql2`） |
| 桌面端 | Electron 41（可选） |
| 部署 | Docker Compose + Nginx |

## 目录结构

```text
terminal-littlebaby/
├── frontend/                # React SPA
│   ├── src/
│   │   ├── pages/           # 13 个页面组件
│   │   ├── components/      # 图标、趋势图、快捷按钮
│   │   ├── services/api.ts  # API 客户端
│   │   └── types/           # TypeScript 类型定义
│   ├── Dockerfile           # 多阶段构建：node:20-alpine → nginx:alpine
│   └── nginx.conf
├── backend/                 # Express API 服务
│   ├── src/
│   │   ├── routes/          # 14 个路由文件
│   │   ├── services/        # LLM 渠道自动调度
│   │   ├── utils/           # 预算、分类、目标、学期等工具
│   │   └── config/          # 数据库连接池
│   └── Dockerfile           # 多阶段构建：node:20-alpine
├── desktop/                 # Electron 桌面壳（macOS）
├── littlebaby-cron-bridge/  # 独立 HTTP 桥接，转发 cron 操作到 littlebaby CLI
├── docker-compose.yml
├── FRONTEND_DESIGN_GUIDE.md # 设计规范文档
└── state/                   # 运行时状态（gitignored）
```

## 部署

通过 Docker Compose 部署两个容器：

| 服务 | 容器名 | 说明 |
| --- | --- | --- |
| frontend | `terminal-littlebaby-frontend` | Nginx 托管构建后的 SPA |
| backend | `terminal-littlebaby-backend` | Express API，监听 `127.0.0.1:3000` |

```bash
docker compose up -d --build
```

### 环境变量

在 `backend/.env` 中配置：

| 变量 | 说明 |
| --- | --- |
| `APP_PASSWORD` | 登录密码（≥16 字符） |
| `JWT_SECRET` | Token 签名密钥（≥32 字符） |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接信息 |
| `AI_API_KEY` | AI Agent API 密钥（≥32 字符） |
| `LITTLEBABY_CRON_BRIDGE_URL` | Cron 桥接地址（默认 `http://localhost:3011`） |
| `LITTLEBABY_CRON_BRIDGE_TOKEN` | Cron 桥接认证 Token |

## API 概览

后端提供两套认证方式：

- **Cookie/Bearer Token** — 面向前端 Web 界面
- **X-API-Key** — 面向 AI Agent（`/api/ai/*`），支持程序化记账、查询课程、管理分类等

主要路由：

| 路径 | 功能 |
| --- | --- |
| `/api/auth` | 登录、验证、登出 |
| `/api/transactions` | 交易 CRUD，自动更新账户余额 |
| `/api/accounts` | 资产/负债账户管理 |
| `/api/categories` | 收支分类管理（叶子+分组） |
| `/api/budgets` | 月度预算管理 |
| `/api/goals` | 储蓄目标追踪 |
| `/api/schedule` | 课程表 CRUD，支持批量导入和冲突检测 |
| `/api/ai/*` | AI Agent 专用接口（记账、查课、Digest 去重等） |
| `/api/llm-usage` | LLM API 用量和费用监控 |
| `/api/littlebaby-cron` | LittleBaby 定时任务管理 |
| `/api/littlebaby-memory` | LittleBaby 记忆文件管理 |

## LittleBaby Cron Bridge

`littlebaby-cron-bridge/server.mjs` 是一个零依赖的独立 HTTP 服务，运行在宿主机上（非容器化），桥接 Web 后端和 `littlebaby` CLI 的 cron 子系统。它将 HTTP 请求翻译为 `littlebaby cron` CLI 命令执行。

## 许可证

本项目仅供个人使用，未公开授权。
