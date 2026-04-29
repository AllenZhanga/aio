# Aio 当前代码核实与修改计划

日期：2026-04-29

## 结论摘要

Aio 当前代码与 README 的大方向一致：已经具备 Spring Boot 后端、React 控制台、应用发布、运行时 API、API Key、Run/Trace、等待任务、工具、知识库和基础多租户字段。

但它仍是早期 MVP。README 中部分表述偏“目标态”，代码当前更准确的状态如下：

| 能力 | 当前判断 | 主要依据 | 风险 |
| --- | --- | --- | --- |
| 多租户 | 已实现基础逻辑隔离，但需补强 scope 校验 | 所有核心表有 `tenant_id`，空间级表有 `workspace_id`；Console Token 会覆盖 Admin Header；运行入口校验 app scope | Runtime 查询 Run/WaitTask/知识库时部分路径只校验 tenant，API Key workspace/app scope 不够完整 |
| 工作流 | 后端可运行轻量 DAG，前端可拖拽搭建基础流程 | 后端支持 start、llm、agent、http_request、condition、knowledge_retrieval、user_confirm、user_form、variable、code、end 等节点 | 前端调色板只暴露 start/llm/tool/user_confirm/condition/end，配置项也偏原始 textarea |
| API 能力 | 基础 API 完整，API Key 可控性中等 | API Key 哈希存储、明文只创建时返回、支持过期/吊销、调用更新 lastUsedAt，Run/Trace 可查询 | 缺少每次 API 调用日志表；管理端 API Key 列表/创建需更严格按 workspace 和角色约束 |
| 知识库 | 支持文本/文件上传、分块、入库、检索测试，但不是实向量库 | 文档保存到 DB，chunk 存 `kb_chunks`，检索为关键词匹配评分 | Qdrant/pgvector 未接入，embedding_provider 字段目前未参与索引 |
| UI/交互 | 7/10 | 控制台完整、导航清楚、状态反馈较好，工作流画布可用 | 节点丰富度、复杂配置易用性、移动端/大画布体验仍需提升 |

## README 偏差

需要避免把当前 MVP 描述成完整生产态：

1. “知识库索引/向量库”应明确当前是轻量 chunk 索引和关键词检索，Qdrant/pgvector 是部署依赖和演进方向，不是已完成的真实向量检索。
2. “Workflow 节点覆盖 LLM、Agent、HTTP、条件、知识检索、用户确认、用户表单”在后端成立，但前端搭建界面未完整暴露。
3. “Runtime observability 支持 API keys, usage summaries, audit events”目前是聚合摘要和派生审计事件，不是完整调用日志与审计日志存储。
4. “API Key scope”需要补强读取类 runtime API 和知识库 runtime API 的 workspace/app 约束。

## 修改计划

### P0：补强 API Key scope 和多租户隔离

- Runtime `GET /v1/runs/{runId}`、`GET /v1/runs/{runId}/traces`、等待任务读取/提交/取消/生成 token 必须校验 API Key 的 workspace/app scope。
- Runtime knowledge API 必须校验 dataset 归属在 API Key workspace scope 内；app-scoped key 不能越权访问其他 workspace 的 dataset。
- Admin API Key 列表按当前 workspace 过滤，管理员可以看租户下所有 key，成员只看当前 workspace 或自己可访问 workspace 的 key。
- 创建 API Key 时，成员只能为当前 workspace 创建 key；若绑定 appId，必须校验 app 属于同一 tenant/workspace。

### P1：补齐工作流搭建 UI 的节点覆盖

- 前端 `WorkflowNodeType` 与后端运行时对齐，至少暴露 `agent`、`http_request`、`knowledge_retrieval`、`user_form`、`variable`、`code`。
- 为新增节点提供默认配置和 inspector 配置项。
- 保持当前轻量画布，不引入新库，先提升可搭建范围。

### P1：校准 README

- 在 README 和 README.zh-CN 中明确 MVP 边界：当前知识库是轻量索引，不是已接入真实向量库。
- 把 observability/API Key 管理描述为当前可用能力和后续增强项，避免生产态误导。

### P2：后续建议

- 增加 `api_call_logs` 或 `runtime_api_calls` 表，记录 apiKeyId、path、status、latency、runId、error。
- 接入真实 embedding provider 和 Qdrant/pgvector，chunk 写入向量库并按 tenant/workspace/dataset filter 检索。
- 工作流 Inspector 从 textarea 升级为按节点类型的结构化表单。
- 增加后端集成测试覆盖租户越权、API Key scope、知识库检索和等待任务恢复。

## 本次执行范围

本次直接执行 P0、P1 的低风险部分和 README 校准：

1. [x] 补强 RuntimeService 和 RuntimeKnowledgeController 的 scope 校验。
2. [x] 补强 AdminIdentityController/IdentityService 的 API Key workspace/app 管理约束。
3. [x] 扩展前端工作流节点调色板与配置项。
4. [x] 更新 README 和 README.zh-CN 的 MVP 真实性描述。
5. [x] 运行后端测试和前端构建验证。

## 本次执行结果

- Runtime `Run`、`Trace`、`WaitTask` 读取和提交路径已经校验 API Key 的 workspace/app scope。
- Runtime 知识库文档写入和检索已经校验 dataset workspace scope。
- Agent 和 Workflow 运行时引用知识库时，会阻止跨 workspace dataset 引用。
- Workflow `tool` 节点从 no-op 补为实际调用当前 workspace 内 active Tool。
- API Key 管理端列表、创建、吊销增加 workspace/角色约束；成员只能操作当前 workspace，管理员可查看租户级 Key。
- 工作流前端节点扩展到 Agent、HTTP、Knowledge、Form、Variable、Code 等后端支持的节点族。
- README 已明确知识库当前是轻量索引，尚未接入真实向量库。
