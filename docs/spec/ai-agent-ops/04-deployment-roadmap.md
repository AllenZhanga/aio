# Aio 部署与迭代路线

## 1. 最小 Docker 部署

第一版私有化使用与 SaaS 同源的独立 Docker 镜像部署。SaaS 版本不做代码分叉，私有化部署只通过环境变量、License、租户模式和外部依赖配置调整能力开关。

私有化部署提供两种模式：

1. 内置依赖一键版
   - 交付一个 Docker Compose 包。
   - 内置 Postgres、Redis、MinIO、Qdrant。
   - 适合 PoC、小团队、客户首次安装和离线演示。

2. 外置依赖生产版
   - 应用侧仍只部署一个 `aio` 容器。
   - 数据库、Redis、对象存储、向量库由客户提供。
   - 适合正式生产、已有基础设施、统一备份和高可用场景。

推荐默认交付内置依赖一键版，服务如下：

| 服务 | 说明 | 是否必需 |
| --- | --- | --- |
| `aio` | Web 控制台、后端 API、运行时入口、Worker | 是 |
| `postgres` | 内置主数据库 | 内置版必需，外置版可关闭 |
| `redis` | 内置队列、缓存、限流 | 内置版必需，外置版可关闭 |
| `minio` | 内置文件对象存储 | 内置版必需，外置版可关闭 |
| `qdrant` | 内置向量数据库 | 内置版必需，外置版可关闭 |

`aio` 镜像内包含：

1. Web 控制台静态资源。
2. API Server。
3. Worker Runtime。
4. 数据库 migration 和初始化脚本。

容器启动后由同一个入口进程启动 API 和 Worker。轻量实现可以用应用内后台线程；如果运行时需要多进程，也应由容器内 supervisor 管理，对部署者仍表现为一个容器。

## 2. 内置依赖 docker-compose 结构

```yaml
services:
  aio:
    image: dxnow/aio:${VERSION}
    env_file: .env
    depends_on:
      - postgres
      - redis
      - minio
      - qdrant
    ports:
      - "8080:8080"

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: agent_ops
      POSTGRES_USER: agent_ops
      POSTGRES_PASSWORD: agent_ops_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio_password
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  qdrant:
    image: qdrant/qdrant
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "6333:6333"

volumes:
  postgres_data:
  redis_data:
  minio_data:
  qdrant_data:
```

这个版本是默认私有化交付形态。客户只需要准备 Docker 环境和模型供应商配置，即可启动完整服务。

内置版要求：

1. 所有状态数据必须挂载到 volume，不允许写在应用容器层。
2. 启动时自动执行数据库 migration。
3. 首次启动自动创建默认租户、默认管理员和默认空间。
4. 支持离线镜像包导入，例如 `docker load` 后再 `docker compose up -d`。
5. 提供备份脚本，至少覆盖 Postgres、MinIO、Qdrant。

## 3. 外置依赖 docker-compose 结构

外置版只运行应用容器：

```yaml
services:
  aio:
    image: dxnow/aio:${VERSION}
    env_file: .env
    ports:
      - "8080:8080"
```

外置版用于对接客户已有基础设施：

1. `DB_HOST` 指向客户 Postgres。
2. `REDIS_URL` 指向客户 Redis。
3. `S3_ENDPOINT` 指向客户 S3、MinIO 或兼容对象存储。
4. `QDRANT_URL` 或 `PGVECTOR` 指向客户向量存储。

## 4. 核心环境变量

```env
APP_MODE=private
DEPLOYMENT_PROFILE=embedded
APP_BASE_URL=http://localhost:8080
WEB_BASE_URL=http://localhost:3000

DB_MODE=embedded
DB_HOST=postgres
DB_PORT=5432
DB_NAME=agent_ops
DB_USER=agent_ops
DB_PASSWORD=agent_ops_password

REDIS_URL=redis://redis:6379/0

STORAGE_TYPE=s3
STORAGE_MODE=embedded
S3_ENDPOINT=http://minio:9000
S3_BUCKET=aio
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio_password
S3_FORCE_PATH_STYLE=true

VECTOR_STORE=qdrant
VECTOR_MODE=embedded
QDRANT_URL=http://qdrant:6333

DEFAULT_TENANT_ID=default
ENABLE_MULTI_TENANT=false
ENABLE_STDIO_MCP=false
ENABLE_CODE_NODE=false
```

生产外置版只需要把 `DEPLOYMENT_PROFILE`、`DB_MODE`、`STORAGE_MODE`、`VECTOR_MODE` 改成 `external`，并替换对应连接地址。

## 5. SaaS 与私有化差异

| 能力 | SaaS | 私有化 |
| --- | --- | --- |
| 多租户 | 开启 | 默认关闭 |
| 用户登录 | 平台账号、SSO | 本地管理员、企业 SSO 可选 |
| MCP stdio | 默认禁用 | 可配置开启 |
| Code 节点 | 默认禁用或沙箱 | 可配置开启 |
| 计量 | 必须记录 | 可关闭计费，只保留统计 |
| 模型供应商 | 租户自配或平台统一 | 企业内网模型网关 |
| 数据库 | 托管 Postgres | 内置 Postgres 或企业 Postgres |
| Redis | 托管 Redis | 内置 Redis 或企业 Redis |
| 文件存储 | 云 S3 | 内置 MinIO 或企业 S3 |
| 向量库 | 托管 Qdrant/Milvus | 内置 Qdrant 或企业向量库 |

部署原则：

1. SaaS 和私有化使用同一个 `aio` 应用镜像。
2. 私有化不是 Joget 插件，也不是嵌入 Joget war 包，而是独立容器服务。
3. 默认私有化包内置数据库和中间件，方便一键启动。
4. 私有化客户也可以接自己的数据库、Redis、对象存储、向量库和模型网关。
5. 业务系统通过 API Key、OAuth/OIDC、Webhook 与平台集成。
6. 版本升级以镜像 tag 和数据库 migration 为边界。
7. 内置依赖也必须提供备份、恢复和升级说明。

## 6. 安全基线

第一版必须具备：

1. API Key 哈希存储，只展示一次明文。
2. Provider 密钥加密存储。
3. 对外 API 按租户和应用鉴权。
4. 文件上传限制大小和类型。
5. HTTP Tool 支持域名白名单。
6. SaaS 环境默认禁用 stdio MCP 和 Code 节点。
7. 所有运行日志支持敏感字段脱敏。

后续增强：

1. 工具调用审批。
2. 数据集行级权限。
3. Prompt 注入检测。
4. 沙箱执行代码节点。
5. 审计日志不可篡改存储。

## 7. 分阶段路线

### Phase 0：技术骨架，1 到 2 周

目标：让系统能启动、登录、创建基础对象。

交付：

1. 内置依赖 Docker Compose。
2. 数据库迁移。
3. 用户、租户、空间。
4. Provider 管理。
5. API Key 管理。
6. 基础健康检查。
7. 备份和恢复脚本。

验收：

1. 本地 `docker compose up` 后可进入控制台。
2. 能配置一个 OpenAI Compatible 模型供应商。
3. 能创建 API Key。
4. 停止并重启容器后数据不丢失。
5. 能导出并恢复 Postgres、MinIO、Qdrant 数据。

### Phase 1：Agent MVP，2 到 3 周

目标：完成可用的 Agent 应用闭环。

交付：

1. Agent 创建、编辑、测试、发布。
2. Prompt、模型参数、变量。
3. HTTP Tool。
4. Chat API。
5. SSE 流式返回。
6. Run/Trace 日志。

验收：

1. 能创建一个客服 Agent。
2. 能通过控制台测试。
3. 能通过 `/v1/apps/{appId}/chat` 调用。
4. 能查看 LLM 调用 trace 和 token。

### Phase 2：知识库 MVP，2 到 3 周

目标：让 Agent 能基于企业文档回答问题。

交付：

1. 数据集管理。
2. 文件上传。
3. 文本解析和分段。
4. Embedding Worker。
5. Qdrant 检索。
6. Agent 挂载知识库。
7. 知识库对外写入和检索 API。

验收：

1. 上传文档后可看到解析状态。
2. 检索测试能返回片段。
3. Agent 回答能引用知识片段。
4. 外部系统能通过 API 写入文档。

### Phase 3：Workflow MVP，3 到 4 周

目标：支持流程应用、拖拽设计、用户确认和用户表单输入。

交付：

1. DAG 画布。
2. Start、LLM、Agent、HTTP、Knowledge、Condition、User Confirm、User Form、End 节点。
3. 节点调试。
4. Workflow 发布。
5. Workflow Run API。
6. Wait Task API。
7. Run 查询和 Trace 查询 API。
8. Webhook 事件。

验收：

1. 能搭建一个“检索知识库 -> 调模型 -> 调业务 API -> 输出”的流程。
2. 每个节点可查看输入、输出和耗时。
3. 发布后可被外部 API 调用。
4. 流程执行到确认节点时返回 `waiting` 和 `wait_task`。
5. 外部系统提交确认或表单后，流程能从暂停节点继续执行。
6. 重复提交同一个等待任务不会导致重复执行业务动作。

### Phase 4：MCP 与技能，2 到 3 周

目标：扩展 Agent 能力接入方式。

交付：

1. MCP Server 管理。
2. MCP 工具同步。
3. Agent 挂载 MCP 工具。
4. Skill 模板管理。
5. Skill 应用到 Agent。

验收：

1. 能接入一个 SSE MCP Server。
2. Agent 能调用 MCP 工具。
3. 能把一组 prompt + tools 保存为 Skill 并复用。

### Phase 5：SaaS 运营增强，持续迭代

目标：让平台具备商业化和规模运行能力。

交付：

1. 租户套餐和额度。
2. 用量统计。
3. 费用估算。
4. 审计日志。
5. SSO。
6. 更细粒度权限。
7. 灰度发布和版本回滚。

## 8. 与业务系统的集成边界

`Aio` 不作为 Joget 插件实现。Joget 只通过 API 使用它，边界如下：

1. Joget 调用 Agent 或 Workflow
   - `POST /v1/apps/{appId}/chat`
   - `POST /v1/apps/{appId}/run`

2. Joget 查询运行结果
   - `GET /v1/runs/{runId}`
   - `GET /v1/runs/{runId}/traces`

3. Joget 处理用户确认和表单
   - `GET /v1/wait-tasks/{waitTaskId}`
   - `POST /v1/wait-tasks/{waitTaskId}/submit`
   - `POST /v1/wait-tasks/{waitTaskId}/reject`

4. Joget 接收异步事件
   - 配置 webhook，接收 `run.waiting`、`wait_task.created`、`run.succeeded`、`run.failed` 等事件。

5. Joget 同步知识
   - `POST /v1/datasets/{datasetId}/documents`
   - `POST /v1/datasets/{datasetId}/retrieve`

不允许的集成方式：

1. 不让 Joget 直接读写 `Aio` 数据库。
2. 不把 `Aio` 的运行时塞进 Joget 插件。
3. 不复用 Joget 的表单存储作为平台主数据。
4. 不把私有化部署做成 Joget 应用包。

最小技术路径：

1. 先做单容器 `aio` 镜像，内含 API Server、Web Console、Worker Runtime 和数据库 migration。
2. 再做 Agent Run API、Workflow Run API、Wait Task API。
3. 然后让 Joget 通过 API 接入，作为第一个外部集成样板。
4. 最后补知识库 Worker、画布、MCP 和技能。

这样得到的是一个真正独立、可 SaaS、可私有化、可被任意业务系统调用的平台。
