# Aio

[English](README.md)

Aio 是一个轻量级 AI 应用平台，用于构建、发布和运营 Agent、Workflow、知识库、工具、MCP 集成以及 Human-in-the-loop 自动化能力。

Aio 以 API 优先、SaaS 可演进、私有化 Docker 部署为核心设计目标，内置 Web 控制台和运行时 API。

## Aio 能做什么

Aio 关注 AI 应用生产运行所需的核心能力，避免把平台本身做成过重的低代码系统：

- **Agent 应用**：支持模型配置、提示词、技能、工具、MCP 工具、记忆和知识库检索。
- **Workflow 应用**：基于轻量 DAG 执行，覆盖 LLM、Agent、HTTP、条件、知识检索、用户确认和用户表单节点。
- **Human-in-the-loop 自动化**：流程可暂停为等待任务，通过 API 或控制台提交后继续执行。
- **知识库管理**：支持数据集、文档、分块、轻量索引、检索测试和运行时检索 API。
- **工具与 MCP 集成**：支持 HTTP 工具、内置工具和 MCP Server。
- **模型供应商管理**：支持 OpenAI Compatible 或私有大模型网关配置。
- **运行观测**：支持 Run、Trace、等待任务、API Key、用量摘要和审计事件。
- **私有化部署**：支持通过 Docker Compose 启动 Postgres、Redis、MinIO、Qdrant，也可以接入外部基础设施。

## 项目状态

Aio 当前处于早期 MVP 实现阶段。当前代码库已经包含：

- Spring Boot API Server 和运行时引擎。
- React/Vite Web 控制台。
- 覆盖身份、模型供应商、应用、运行时记录、工具、知识库、等待任务和技能的 Flyway 迁移。
- 带租户/工作空间上下文的控制台登录。
- `/api/aio/admin/**` 管理 API 和 `/v1/**` 运行时 API。
- Docker 打包流程：先构建 Web 控制台，再将静态资源打进服务端镜像。

当前 MVP 边界：

- 知识库检索当前使用数据库内 chunk 和轻量关键词评分。Qdrant/pgvector 与 Provider Embedding 属于部署架构和路线图能力，当前运行时索引器尚未真正写入向量库。
- 运行观测当前提供 Run、Trace、用量摘要、API Key 状态和派生审计摘要，尚未落独立的逐次 API 调用日志表。
- 工作流后端支持轻量 DAG 节点集合，控制台也已暴露同类节点用于 MVP 搭建；更细的结构化节点编辑器属于后续增强。

## 架构

```text
Browser Console
  │
  ├─ /api/aio/auth/**          控制台登录和工作空间切换
  ├─ /api/aio/admin/**         通过控制台 Token 鉴权的管理 API
  └─ /v1/**                    通过 Runtime API Key 鉴权的运行时 API

aio container
  ├─ Web 控制台静态资源
  ├─ Spring Boot API Server
  ├─ Runtime Engine
  ├─ Worker/Runtime Services
  └─ Flyway 数据库迁移

Infrastructure
  ├─ Postgres
  ├─ Redis
  ├─ MinIO
  └─ Qdrant
```

主部署镜像为：

```text
dxnow/aio:${VERSION}
```

## 使用 Docker Compose 快速启动

1. 创建本地环境变量文件：

   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env`，为 `DB_PASSWORD`、`S3_ACCESS_KEY`、`S3_SECRET_KEY` 和 `AIO_SECRET_KEY` 设置强密码或强密钥。

3. 启动内置依赖版本：

   ```bash
   docker compose up --build
   ```

4. 打开控制台：

   ```text
   http://localhost:8080
   ```

5. 使用已配置的控制台账号登录，创建应用，发布应用，生成 Runtime API Key，然后调用运行时 API。

## 控制台鉴权

私有化部署仍需要控制台登录。Web 控制台调用：

```http
POST /api/aio/auth/login
```

返回的控制台 Token 需要发送给所有管理 API：

```http
Authorization: Bearer <console_token>
```

`/v1/**` 下的运行时 API 使用 Runtime API Key：

```http
Authorization: Bearer sk_xxx
```

### 开发账号

本地开发可以通过 `AIO_CONSOLE_ACCOUNTS` 配置多个控制台账号：

```text
admin:admin:default:Admin:admin,alice:alice_dev_password:alice:Alice:member,bob:bob_dev_password:bob:Bob:member
```

示例账号：

| 用户名 | 密码 | 角色 | 工作空间 |
| --- | --- | --- | --- |
| `admin` | `admin` | `admin` | `default` |
| `alice` | `alice_dev_password` | `member` | `alice` |
| `bob` | `bob_dev_password` | `member` | `bob` |

在任何共享、内部或生产部署前，请务必修改所有开发密码。

### 租户与工作空间上下文

在内置私有化基线中，Aio 会初始化 `default` 租户和 `default` 工作空间。当 `AIO_CONSOLE_ACCOUNTS` 包含更多工作空间时，登录过程会按需创建这些工作空间。

应用、知识库、模型供应商、API Key、Run、Trace 和等待任务都按租户和工作空间隔离。工作空间切换会进行权限校验：

- 管理员账号可以访问当前租户下所有工作空间。
- 成员账号只能访问 `AIO_CONSOLE_ACCOUNTS` 中分配给自己的工作空间。
- 管理 API 不能通过自定义租户/工作空间 Header 越权切换上下文；后端会使用已认证控制台 Token 中的上下文。

### 鉴权环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AIO_CONSOLE_USERNAME` | `admin` | 当 `AIO_CONSOLE_ACCOUNTS` 为空时使用的兜底管理员用户名。 |
| `AIO_CONSOLE_PASSWORD` | `admin` | 当 `AIO_CONSOLE_ACCOUNTS` 为空时使用的兜底管理员密码。 |
| `AIO_CONSOLE_ACCOUNTS` | empty | 可选的多账号列表，格式为 `username:password:workspaceId:displayName:role`，角色支持 `admin` 或 `member`。 |
| `AIO_CONSOLE_SESSION_TTL_SECONDS` | `28800` | 控制台会话有效期，单位为秒。 |
| `AIO_SECRET_KEY` | `dev-only-change-me` | Token 签名和密钥加密使用的密钥。 |

## 核心 API 区域

### 控制台鉴权 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/api/aio/auth/login` | 登录控制台。 |
| `GET` | `/api/aio/auth/me` | 校验当前控制台 Token。 |
| `POST` | `/api/aio/auth/switch-workspace` | 切换到有权限访问的工作空间。 |

### 管理 API

| 区域 | 路径 |
| --- | --- |
| 身份与凭据 | `/api/aio/admin/tenants`, `/api/aio/admin/workspaces`, `/api/aio/admin/api-keys` |
| 应用 | `/api/aio/admin/apps`, `/api/aio/admin/apps/{appId}/versions`, `/api/aio/admin/apps/{appId}/validate`, `/api/aio/admin/apps/{appId}/publish` |
| 模型供应商 | `/api/aio/admin/providers` |
| 工具与 MCP | `/api/aio/admin/tools`, `/api/aio/admin/mcp-servers` |
| 知识库 | `/api/aio/admin/datasets`, `/api/aio/admin/datasets/{datasetId}/documents`, `/api/aio/admin/datasets/{datasetId}/retrieve-test` |
| 等待任务 | `/api/aio/admin/wait-tasks` |
| 运行观测 | `/api/aio/admin/runs`, `/api/aio/admin/runs/{runId}/traces` |
| SaaS 运营 | `/api/aio/admin/usage-summary`, `/api/aio/admin/audit-events` |

### 运行时 API

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `POST` | `/v1/apps/{appId}/chat` | 调用已发布的 Agent 应用。 |
| `POST` | `/v1/apps/{appId}/run` | 运行已发布的 Workflow 应用。 |
| `GET` | `/v1/runs/{runId}` | 查询运行状态和输出。 |
| `GET` | `/v1/runs/{runId}/traces` | 查询运行 Trace。 |
| `GET` | `/v1/wait-tasks/{waitTaskId}` | 查询等待任务。 |
| `POST` | `/v1/wait-tasks/{waitTaskId}/submit` | 提交等待任务并恢复流程。 |
| `POST` | `/v1/datasets/{datasetId}/documents` | 写入运行时文档。 |
| `POST` | `/v1/datasets/{datasetId}/retrieve` | 检索知识库记录。 |

## 运行时调用示例

运行一个 Workflow：

```http
POST /v1/apps/{appId}/run
Authorization: Bearer sk_xxx
Content-Type: application/json
```

```json
{
  "inputs": {
    "question": "How should we follow up with this customer?",
    "operator_id": "user_001"
  },
  "response_mode": "blocking"
}
```

如果流程需要用户输入，Aio 会返回等待任务：

```json
{
  "run_id": "run_003",
  "status": "waiting",
  "wait_task": {
    "id": "wait_001",
    "type": "user_confirm",
    "title": "Confirm task creation",
    "actions": [
      {"key": "approve", "label": "Approve"},
      {"key": "reject", "label": "Reject"}
    ]
  }
}
```

提交等待任务：

```http
POST /v1/wait-tasks/{waitTaskId}/submit
Authorization: Bearer sk_xxx
Idempotency-Key: 8e4b1a1c-6d4f-4fd8-a2ef-42d0a5b39c11
Content-Type: application/json
```

```json
{
  "action": "approve",
  "submitted_by": {
    "type": "external_user",
    "id": "user_001",
    "name": "Alex"
  }
}
```

## 本地开发

### 后端

```bash
mvn -pl apps/server test
```

后端是 Spring Boot 应用，Flyway 迁移文件位于 `apps/server/src/main/resources/db/migration`。

### 前端

```bash
cd apps/web
npm install
npm run dev
npm run build
```

前端是 React/Vite 控制台。Docker 构建时会先构建 `apps/web/dist`，再复制到 Spring Boot 静态资源目录中，最终打包成服务端镜像。

### 构建 Docker 镜像

```bash
docker build -t dxnow/aio:dev .
```

## 仓库结构

```text
aio/
  apps/
    server/                 Spring Boot API Server 和 Runtime
    web/                    React/Vite Web 控制台
  packages/
    shared/                 共享包占位
  deploy/
    embedded/               内置依赖部署资产
    external/               外部基础设施部署资产
    scripts/                备份、恢复和迁移脚本
  docs/
    spec/ai-agent-ops/      产品、架构、API、部署和路线图文档
  Dockerfile
  docker-compose.yml
  docker-compose.external.yml
  .env.example
```

## 文档

设计和实施文档位于 `docs/spec/ai-agent-ops`：

- 产品范围
- 架构设计
- 数据与 API 设计
- 部署路线图
- 代码库结构
- 控制台业务设计
- 实施路线图

## License

许可证待定。
