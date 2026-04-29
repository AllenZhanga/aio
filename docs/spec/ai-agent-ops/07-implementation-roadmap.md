# Aio 控制台与业务能力分步实施路线

## 1. 文档定位

本文是 [06-console-business-design.md](./06-console-business-design.md) 的落地拆解，用于指导开发按阶段实现控制台页面和业务能力，避免“一次性做全”导致范围失控。

已有 [04-deployment-roadmap.md](./04-deployment-roadmap.md) 偏底层平台、运行时和部署路线；本文专注控制台产品页面、SaaS 能力、API 使用体验、知识库、发布校验和观测能力。

## 2. 分步实施原则

1. 先闭环，后完善：每个阶段都必须可演示、可测试、可发布。
2. 先用户主路径，后管理增强：应用创建、发布、API 调用、观测优先。
3. 先单空间体验，后 SaaS 增强：表结构保持租户/空间字段，界面逐步开放组织和计费。
4. 先阻断错误，后智能建议：发布检查先保证不发布坏流程，再做优化建议。
5. 先结构化 Trace，后高级分析：先能查 Run 和节点日志，再做指标、告警和成本分析。

## 3. 总体阶段

| 阶段 | 名称 | 目标 | 结果 |
| --- | --- | --- | --- |
| P0 | 当前基线整理 | 稳定已有应用中心、Agent/Workflow 基础闭环 | 可继续迭代的控制台骨架 |
| P1 | 应用中心与设计器成型 | 完成应用创建、三类 Agent 设计、Workflow 独立画布 | 用户能创建并设计应用 |
| P2 | API 使用体验 | 完成应用 API 文档页、API Key scope、调用示例 | 开发者能直接复制示例调用 |
| P3 | 知识库管理 | 完成数据集、文档、分段、检索测试和挂载 | Agent 可基于知识库回答 |
| P4 | 发布检查与版本控制 | 完成 Agent/Workflow 发布校验、版本差异、回滚 | 发布过程可控，不发布明显错误流程 |
| P5 | 运行观测 | 完成 Run 列表、Trace 详情、Workflow 节点观测、Agent 日志 | 能定位每次运行问题 |
| P6 | Human-in-the-loop | 完成任务中心、等待任务处理、Webhook | 流程可暂停、确认、恢复 |
| P7 | SaaS 运营能力 | 完成组织权限、用量额度、审计、系统设置 | 具备 SaaS 服务形态 |
| P8 | 能力扩展 | 完成 Tool、MCP、Skill 管理增强 | Agent 能力可扩展复用 |

## 4. P0：当前基线整理

### 4.1 目标

把当前已实现能力整理成稳定基线，补齐明显缺口，避免后续迭代反复返工。

### 4.2 范围

1. 应用中心卡片平铺、筛选、搜索、创建弹窗。
2. Chatflow、Agent、文本生成、Workflow 创建入口。
3. Agent 基础设计页。
4. Workflow 基础画布、节点拖拽、连线、属性面板。
5. 保存版本、发布、API Key、运行测试。
6. 现有 Docker 构建和访问链路。

### 4.3 开发任务

| 任务 | 说明 | 验收 |
| --- | --- | --- |
| 统一页面路由 | 把应用中心、设计页、运行测试拆成稳定路由 | 刷新页面不丢失当前应用上下文 |
| 补齐加载状态 | 应用列表、版本、运行调用有 loading、empty、error | 不出现误导性的“暂无应用”闪烁 |
| 统一状态模型 | 草稿、已发布、有未发布变更、禁用 | 卡片和详情状态一致 |
| 基础错误提示 | API 错误展示原因和修复建议 | 用户能知道配置缺什么 |

### 4.4 退出标准

1. 本地和 Docker 访问页面一致。
2. 创建 Agent、创建 Workflow、保存、发布、调用均可完成。
3. 前端构建无错误。

## 5. P1：应用中心与设计器成型

### 5.1 目标

让用户可以按 Dify/百炼式应用中心完成不同类型应用创建，并进入对应设计页。

### 5.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 应用中心 | 卡片平铺、创建卡片、筛选、搜索、状态、快捷操作。 |
| 创建应用弹窗 | 空白创建、模板创建入口、DSL 导入入口、类型选择。 |
| Chatflow 设计页 | 开场白、建议问题、Prompt、知识库、聊天调试。 |
| Agent 设计页 | 角色目标、工具/MCP、最大迭代、任务调试。 |
| 文本生成设计页 | 输入变量、生成模板、输出格式、表单化调试。 |
| Workflow 设计页 | 独立画布、节点库、连线、属性面板、变量面板。 |

### 5.3 后端/API

1. `GET /api/aio/admin/apps`
2. `POST /api/aio/admin/apps`
3. `PUT /api/aio/admin/apps/{appId}`
4. `POST /api/aio/admin/apps/{appId}/versions`
5. `POST /api/aio/admin/apps/{appId}/publish`

### 5.4 验收

1. 新用户能在 3 步内创建 Chatflow 应用。
2. 不同 Agent 类型进入不同设计页，而不是共用一张大表单。
3. Workflow 画布空间足够，不能嵌在应用中心主列表里。
4. 应用卡片能进入设计、API、运行日志。

## 6. P2：API 使用体验

### 6.1 目标

让开发者在控制台内直接完成 API Key 创建、复制示例、调用应用、查看响应。

### 6.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 应用 API 文档页 | App ID、发布版本、输入 schema、curl/JS/Java/Python 示例。 |
| API Key 页面 | 创建、scope、过期时间、限流、禁用、轮换。 |
| 开发者文档中心 | Chat、Run、Wait Task、Trace、Knowledge、Webhook 文档。 |
| Webhook 测试 | 签名说明、测试发送、最近回调记录。 |

### 6.3 业务规则

1. API Key 明文只展示一次。
2. API Key 必须绑定租户、空间和 scope。
3. 示例代码自动带入 `app_id`，Key 使用占位符。
4. 未发布应用的 API 页显示“请先发布”。
5. Workflow 文档必须展示 `blocking`、`streaming`、`async` 三种调用方式。

### 6.4 验收

1. 开发者复制 curl 后只替换 API Key 即可调用成功。
2. API Key scope 不足时，运行日志能显示明确失败原因。
3. OpenAPI 可下载。

## 7. P3：知识库管理

### 7.1 目标

完成从创建知识库、上传文档、解析索引、检索测试到应用挂载的闭环。

### 7.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 知识库列表 | 数据集卡片、状态、文档数、分段数、最近索引状态。 |
| 创建知识库向导 | 基础信息、Embedding、分段策略、检索策略、权限。 |
| 文档管理 | 上传、URL、文本、API 写入记录、解析/索引状态、失败重试。 |
| 分段管理 | 分段列表、metadata、启用/禁用、编辑后重新 embedding。 |
| 检索测试 | TopK、阈值、检索模式、重排、命中高亮、复制 API 示例。 |
| 挂载应用 | 查看被哪些 Agent/Workflow 引用，控制挂载权限。 |

### 7.3 后端/API

1. `GET /api/aio/admin/datasets`
2. `POST /api/aio/admin/datasets`
3. `POST /api/aio/admin/datasets/{datasetId}/documents`
4. `GET /api/aio/admin/datasets/{datasetId}/documents`
5. `POST /api/aio/admin/documents/{documentId}/reindex`
6. `POST /api/aio/admin/datasets/{datasetId}/retrieve-test`
7. `POST /v1/datasets/{datasetId}/documents`
8. `POST /v1/datasets/{datasetId}/retrieve`

### 7.4 验收

1. 上传文档后可看到 pending、parsing、indexing、indexed、failed 状态。
2. 失败文档可以重试。
3. 检索测试返回分段、score、来源。
4. Agent 调试时能看到知识命中片段。

## 8. P4：发布检查与版本控制

### 8.1 目标

保证 Agent 和 Workflow 发布前可控，避免缺模型、缺变量、断线流程、坏 schema 上线。

### 8.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 发布检查抽屉 | 阻断错误、警告、建议、定位到字段或节点。 |
| 版本列表 | 版本号、发布人、发布时间、说明、状态。 |
| 版本差异 | 对比当前草稿和线上版本。 |
| 回滚确认 | 展示回滚影响范围和审计说明。 |

### 8.3 检查器

| 类型 | 检查项 |
| --- | --- |
| Agent | Provider 可用、Prompt 非空、变量存在、工具 schema、知识库状态、敏感字段。 |
| Workflow | Start 唯一、End 可达、DAG 无环、节点连通、端口匹配、必填配置、变量存在、User 节点恢复分支。 |
| 通用 | 权限、API scope、测试用例、版本说明、依赖是否被禁用。 |

### 8.4 验收

1. 有阻断错误时发布按钮不可用。
2. 点击错误能定位到对应节点或字段。
3. 已发布版本不可变。
4. 回滚只切换 `published_version_id`，不修改历史版本。

## 9. P5：运行观测

### 9.1 目标

让运营、开发和应用管理员能定位“哪次运行、哪个版本、哪个节点、为什么失败”。

### 9.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 全局 Run 列表 | 应用、版本、状态、触发方式、耗时、token、API Key、时间筛选。 |
| 应用 Run 列表 | 当前应用的运行记录和失败率。 |
| Run 详情 | 输入、输出、状态、错误、metadata、重跑、导出 JSON。 |
| Agent Trace | 对话、Prompt 脱敏视图、知识命中、模型调用、工具/MCP 调用。 |
| Workflow Trace | 画布节点状态、节点输入输出、连线条件、等待任务。 |

### 9.3 数据要求

1. 每次运行必须有 `run_id`。
2. 每个 LLM、Tool、Retrieval、Workflow Node 都必须写 Trace。
3. Trace 必须记录输入、输出、状态、耗时、错误、token。
4. 敏感字段必须脱敏。
5. 运行必须绑定 `app_version_id`。

### 9.4 验收

1. Workflow 失败时能在画布上看到失败节点。
2. Agent 失败时能看到是模型、工具、知识库还是权限错误。
3. 任意 Run 可以导出脱敏 JSON 给开发排查。

## 10. P6：Human-in-the-loop 与任务中心

### 10.1 目标

让 Workflow 可以暂停等待用户确认、填写表单或外部系统回填，再继续执行。

### 10.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 任务中心 | pending、submitted、rejected、cancelled、expired 筛选。 |
| 任务详情 | 确认动作、表单渲染、上下文、关联 Run、节点 Trace。 |
| 匿名提交页 | 只访问单个 wait task，不暴露应用和 Trace。 |
| Webhook 配置 | run、wait_task 事件订阅、签名、测试。 |

### 10.3 业务规则

1. 提交等待任务必须幂等。
2. 已结束任务不可重复提交。
3. User Confirm 必须配置确认、拒绝、超时处理。
4. User Form 必须配置 JSON Schema。
5. 匿名 token 只允许访问单个任务。

### 10.4 验收

1. Workflow 运行到确认节点返回 `waiting` 和 `wait_task`。
2. 控制台提交后流程继续运行。
3. 重复提交不会重复执行业务动作。
4. Webhook 能收到 `wait_task.created` 和 `run.succeeded`。

## 11. P7：SaaS 运营能力

### 11.1 目标

让 Aio 从私有化工具升级为可运营的 SaaS 服务。

### 11.2 页面

| 页面 | 必做能力 |
| --- | --- |
| 组织与权限 | 租户、空间、成员、角色、邀请、禁用。 |
| 用量与计费 | 调用量、token、知识库存储、向量数、套餐、额度。 |
| 审计日志 | 登录、发布、密钥、权限、工具、知识库变更。 |
| 系统设置 | SaaS 租户设置；私有化部署、License、外部依赖状态。 |

### 11.3 业务规则

1. 所有列表接口必须按租户和空间过滤。
2. API Key 不能跨租户使用。
3. 用量达到阈值时提示，超过额度时按套餐策略限流。
4. 审计日志不可修改，不展示敏感值明文。

### 11.4 验收

1. 切换空间后资源列表同步变化。
2. 不同租户数据不可互相访问。
3. API Key 过期、scope 不足、额度不足均有明确错误。

## 12. P8：Tool、MCP 与 Skill 增强

### 12.1 目标

让 Agent 的能力可扩展、可复用、可治理。

### 12.2 页面

| 页面 | 必做能力 |
| --- | --- |
| HTTP Tool | URL、方法、Header、Body、schema、测试、白名单。 |
| MCP Server | HTTP/SSE/stdio、连接测试、同步工具、启用/禁用。 |
| Skill | Prompt 片段、工具组合、知识库组合、应用到 Agent。 |

### 12.3 业务规则

1. SaaS 默认禁用 stdio MCP 和不安全内网地址。
2. Tool 密钥不明文回显。
3. Skill 修改不自动影响已发布应用，必须重新应用并发布。
4. 被已发布应用引用的 Tool/MCP/Skill 不允许直接删除。

### 12.4 验收

1. Agent 能调用 HTTP Tool。
2. Agent 能调用 SSE/HTTP MCP 工具。
3. Skill 能应用到 Agent 草稿并随版本发布。

## 13. 当前实现对齐度

| 能力 | 当前状态 | 下一步 |
| --- | --- | --- |
| 应用中心 | 已有科技蓝卡片平铺、创建入口、Hash 路由、加载/空/错误态、统一状态标签 | 补快捷操作、模板/DSL 完整流程 |
| Agent 设计 | 已有基础三类型设计页 | 补完整字段、调试记录、测试用例 |
| Workflow 画布 | 已有基础拖拽、连线和设计器路由 | 补变量面板、节点调试、校验器 |
| 发布 | 已有基础发布 | 补发布检查、版本差异、回滚 |
| API Key / 调用 | 已有基础能力和应用 API 文档页，支持 scope 展示、调用示例、Workflow wait task/trace 示例 | 补独立 API Key 管理页、OpenAPI 下载、Webhook 测试 |
| 知识库 | 后端/文档已有设计 | 补完整 UI 和 Worker 状态展示 |
| 观测 | 已有 Run/Trace 基础对象、后台观测 API、全局/应用运行观测页面和 Trace 时间线 | 补画布级 Trace、Agent 日志脱敏视图、筛选与导出 |
| SaaS | 数据模型有租户/空间方向 | 补组织、权限、用量、审计页面 |

### 13.1 P0 基线整理落地记录

2026-04-29 已完成 P0 第一轮：

1. 应用中心支持 `#/apps` 路由。
2. 应用设计器支持 `#/apps/{appId}/agent` 和 `#/apps/{appId}/workflow` 路由。
3. 刷新设计器页面后可恢复当前应用上下文。
4. 应用列表补齐 loading、empty、error 和筛选无结果状态。
5. 创建、发布、生成 Key、试运行补齐按钮 busy 状态。
6. 应用卡片和详情页使用统一状态标签：草稿、已发布、有未发布变更、已禁用、已归档。
7. 前端构建通过，并已重新构建 Docker 容器验证 `http://localhost:8080/#/apps`。

### 13.2 P2 API 使用体验落地记录

2026-04-29 已完成 P2 第一轮：

1. 新增应用 API 文档路由：`#/apps/{appId}/api`。
2. Agent 和 Workflow 设计页新增“API 文档”入口，可从设计页直接进入集成说明。
3. API 文档页展示 Base URL、App ID、鉴权方式、Key Scope 和 Runtime API Key。
4. 支持在 API 文档页直接生成应用 Runtime Key，并自动带入所有示例代码。
5. Agent 文档展示 `/v1/apps/{appId}/chat` 调用说明和 curl、JavaScript、Java、Python 示例。
6. Workflow 文档展示 `/v1/apps/{appId}/run` 调用说明和 blocking、streaming、async 调用提示。
7. Workflow 文档补充 wait task 提交和 Run Trace 查询示例。
8. 所有 Endpoint 和代码示例支持一键复制。
9. 未发布应用会在 API 文档页展示“请先发布”的提示。
10. 前端构建通过，并已在 Vite 页面验证 Agent/Workflow API 文档路由和复制按钮。

### 13.3 P5 运行观测落地记录

2026-04-29 已完成 P5 第一轮：

1. 新增后台运行观测接口：`GET /api/aio/admin/runs`。
2. 支持按应用筛选运行记录：`GET /api/aio/admin/runs?appId={appId}`。
3. 新增 Run 详情接口：`GET /api/aio/admin/runs/{runId}`。
4. 新增后台 Trace 查询接口：`GET /api/aio/admin/runs/{runId}/traces`。
5. 观测接口按 `tenantId` 和 `workspaceId` 过滤，避免跨空间读取。
6. 新增全局运行观测路由：`#/observability/runs`。
7. 新增应用内运行观测路由：`#/apps/{appId}/runs`。
8. 运行观测页展示 Run 总数、成功数、等待数、失败数和平均耗时。
9. Run 详情展示应用、版本、状态、耗时、token、wait task、输入、输出和错误信息。
10. Trace 时间线展示步骤类型、名称、状态、耗时、输入、输出和错误信息。
11. 应用设计页新增“运行观测”入口，侧边栏新增全局“运行观测”入口。
12. 前端构建和后端测试均已通过。

### 13.4 P4 发布检查落地记录

2026-04-29 已完成 P4 第一轮：

1. 新增后台发布检查接口：`POST /api/aio/admin/apps/{appId}/validate`。
2. 新增 `AppValidationService`，统一返回 `passed`、阻断错误、警告、建议和可定位的 issue 列表。
3. Agent 发布检查覆盖应用类型一致性、System Prompt、Chat Model、Provider 绑定建议、知识库挂载建议和明文密钥疑似阻断。
4. Workflow 发布检查覆盖节点存在性、Start 唯一、End 可达、DAG 无环、节点连通性、连线端点、节点必填配置、User Confirm 动作、变量引用和明文密钥疑似阻断。
5. 后端 `publish` 强制执行发布检查，直接调用发布 API 也不能绕过阻断错误。
6. 应用设计页新增“发布检查”按钮，可在发布前打开发布检查抽屉。
7. 发布按钮会先执行发布检查；存在阻断错误时停止发布并展示检查结果。
8. 发布检查抽屉展示阻断错误、警告、建议统计，并按 severity 展示 code、标题、详情和 target。
9. 前端构建、后端测试和编辑器诊断均已通过。

## 14. 每阶段交付要求

每个阶段完成时必须同时交付：

1. 页面功能。
2. 后端 API 或 mock 到真实 API 的替换计划。
3. 数据模型或 migration。
4. 权限和租户隔离检查。
5. 空状态、错误态、加载态。
6. 最少一条手工验收路径。
7. 构建验证。
8. 必要时更新设计文档。

## 15. 推荐开发顺序

如果只能选择最短路径，建议按以下顺序：

1. P0：稳定当前基线。
2. P2：先补 API 文档页，让应用能被真正集成。
3. P5：补 Run/Trace 观测，方便后续开发排障。
4. P4：补发布检查，避免 Workflow 复杂后不可控。
5. P3：补知识库完整管理。
6. P6：补任务中心和 Webhook。
7. P7：补 SaaS 组织、用量、审计。
8. P8：补 Tool、MCP、Skill 增强。

这个顺序优先保证“创建应用 -> 发布 -> API 调用 -> 观测排障”的产品主闭环。