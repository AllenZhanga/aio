# Aio 轻量平台设计说明

## 1. 文档定位

本文档集用于设计一个类似 Dify、但更轻量、更适合 SaaS 与私有化 Docker 部署的 AI Agent 平台。

目标产品暂定名为 `Aio`，核心覆盖：

1. 流程应用
   - 可扩展组件
   - 拖拽设计工作流
   - HTTP/API 触发
   - 定时或事件触发

2. 智能体应用
   - Agent 编排
   - MCP 接入
   - 技能 Skill
   - 工具 Tool
   - 知识库 Knowledge Base

3. 知识库管理
   - 文档上传与解析
   - 分段、向量化、检索
   - 权限与发布
   - 对外 API

4. 部署形态
   - SaaS 多租户
   - SaaS 版本直接私有化部署
   - 独立 Docker 镜像 / Docker Compose
   - 内置数据库与中间件的一键部署包
   - 后续可演进到 Kubernetes

`Aio` 是独立服务，不依赖 Joget，也不复用 Joget 的表结构、插件体系、会话引擎或发布生命周期。Joget、CRM、企微机器人、业务系统都只是它的 API 调用方。

本文档强调“最快最轻量”：

1. 第一版以单个 `aio` 应用容器为主，容器内包含 API、Web 静态资源和 Worker。
2. 流程引擎先做可运行的 DAG，不做复杂 BPMN。
3. Agent 运行时先支持单 Agent、多工具、知识库检索，不做复杂多 Agent 协同。
4. 插件系统先做注册式组件，不做在线插件市场。
5. 私有化先支持内置依赖的 Docker Compose，不先做完整 Helm Chart。

## 2. 文档清单

| 文档 | 说明 |
| --- | --- |
| [01-product-scope.md](./01-product-scope.md) | 产品范围、角色、应用类型、MVP 边界 |
| [02-architecture.md](./02-architecture.md) | 最小可落地架构、模块划分、运行时链路 |
| [03-data-api-design.md](./03-data-api-design.md) | 核心数据模型、管理 API、运行 API、知识库 API |
| [04-deployment-roadmap.md](./04-deployment-roadmap.md) | Docker 部署、SaaS/私有化差异、分阶段计划 |
| [05-codebase-layout.md](./05-codebase-layout.md) | 独立服务代码仓库、目录结构、与 Joget 的代码边界 |
| [06-console-business-design.md](./06-console-business-design.md) | 控制台界面、SaaS 业务逻辑、应用中心、知识库、API 文档、发布检查与运行观测 |
| [07-implementation-roadmap.md](./07-implementation-roadmap.md) | 控制台与业务能力的分阶段实施路线、验收标准和开发顺序 |

## 3. 一句话方案

用一套轻量的应用模型统一承载 `workflow` 和 `agent`：

1. `App` 是对外发布单元。
2. `Workflow` 是流程应用的运行定义。
3. `Agent` 是智能体应用的运行定义。
4. `Tool`、`Skill`、`MCP Server`、`Knowledge Base` 是 Agent 可挂载能力。
5. `Run` 和 `Trace` 是所有调用的统一观测模型。

第一版不追求“完美低代码平台”，而是先实现：

1. 能创建 Agent。
2. 能配置模型、提示词、工具、知识库。
3. 能创建简单流程。
4. 能通过 API 调用应用。
5. 能查看运行记录。
6. 能用 Docker Compose 私有化跑起来。
