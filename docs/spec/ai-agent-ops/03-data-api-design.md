# Aio 数据模型与 API 设计

## 1. 命名约定

本文按独立服务设计数据模型，建议直接使用普通业务表名：

1. 租户和空间：`tenants`、`workspaces`
2. 应用：`ai_apps`、`ai_app_versions`
3. 工具和 MCP：`ai_tools`、`mcp_servers`
4. 知识库：`kb_datasets`、`kb_documents`、`kb_chunks`
5. 运行时：`ai_runs`、`ai_traces`、`ai_wait_tasks`

Joget 只作为外部调用方，通过 `/v1` 开放 API 调用已发布应用、提交等待任务、接收 webhook，不直接访问数据库。

## 2. 核心数据模型

### 2.1 租户与空间

`tenant`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 租户 ID |
| name | varchar | 租户名称 |
| code | varchar | 租户编码 |
| plan | varchar | 套餐，私有化默认 private |
| status | varchar | active、disabled |

`workspace`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 空间 ID |
| tenant_id | varchar | 租户 ID |
| name | varchar | 空间名称 |
| status | varchar | active、archived |

### 2.2 Provider

`model_provider_account`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 主键 |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID，可为空表示租户级 |
| name | varchar | 名称 |
| provider_type | varchar | openai_compatible、azure_openai、dashscope、local |
| base_url | varchar | API 地址 |
| api_key | text | 密钥，需加密存储 |
| default_chat_model | varchar | 默认聊天模型 |
| default_embedding_model | varchar | 默认 Embedding 模型 |
| config_json | json/text | 额外配置 |
| status | varchar | active、disabled |

第一版只需要真正实现 `openai_compatible`。

### 2.3 App 与版本

`ai_app`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 应用 ID |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID |
| name | varchar | 应用名称 |
| type | varchar | agent、workflow |
| description | text | 描述 |
| visibility | varchar | private、workspace、public_api |
| status | varchar | draft、published、archived |
| published_version_id | varchar | 当前发布版本 |

`ai_app_version`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 版本 ID |
| app_id | varchar | 应用 ID |
| version_no | int | 版本号 |
| type | varchar | agent、workflow |
| definition_json | json/text | 完整运行定义 |
| publish_status | varchar | draft、published、disabled |
| published_at | datetime | 发布时间 |
| published_by | varchar | 发布人 |

版本发布后不可变。编辑草稿时生成或覆盖 draft 版本。

### 2.4 Agent 定义

Agent 定义建议保存在 `ai_app_version.definition_json`，减少表膨胀。

示例：

```json
{
  "type": "agent",
  "model": {
    "providerAccountId": "provider_001",
    "chatModel": "gpt-4.1-mini",
    "temperature": 0.3,
    "maxTokens": 4096,
    "timeoutMs": 60000
  },
  "prompt": {
    "system": "你是企业内部知识助手。",
    "variables": [
      {"name": "user_name", "type": "string", "required": false}
    ]
  },
  "knowledge": [
    {"datasetId": "kb_001", "topK": 5, "scoreThreshold": 0.45}
  ],
  "tools": [
    {"toolId": "tool_001", "required": false}
  ],
  "mcpServers": [
    {"serverId": "mcp_001", "enabledTools": ["search_ticket"]}
  ],
  "memory": {
    "enabled": true,
    "windowMessages": 10
  },
  "output": {
    "format": "text"
  }
}
```

### 2.5 Workflow 定义

Workflow 定义同样保存在 `definition_json`。

```json
{
  "type": "workflow",
  "inputs": [
    {"name": "question", "type": "string", "required": true}
  ],
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "config": {}
    },
    {
      "id": "retrieve",
      "type": "knowledge_retrieval",
      "config": {"datasetId": "kb_001", "query": "{{inputs.question}}", "topK": 5}
    },
    {
      "id": "answer",
      "type": "llm",
      "config": {"prompt": "基于资料回答：{{retrieve.chunks}}"}
    },
    {
      "id": "confirm",
      "type": "user_confirm",
      "config": {
        "title": "确认是否创建跟进任务",
        "description": "{{answer.text}}",
        "assignee": {"type": "external", "id": "{{inputs.operator_id}}"},
        "actions": [
          {"key": "approve", "label": "确认创建"},
          {"key": "reject", "label": "暂不创建"}
        ],
        "expiresInSeconds": 86400
      }
    },
    {
      "id": "end",
      "type": "end",
      "config": {"output": "{{answer.text}}"}
    }
  ],
  "edges": [
    {"from": "start", "to": "retrieve"},
    {"from": "retrieve", "to": "answer"},
    {"from": "answer", "to": "confirm"},
    {"from": "confirm", "to": "end", "condition": "{{confirm.action == 'approve'}}"}
  ]
}
```

用户表单节点示例：

```json
{
  "id": "collect_customer_info",
  "type": "user_form",
  "config": {
    "title": "补充客户跟进信息",
    "assignee": {"type": "external", "id": "{{inputs.operator_id}}"},
    "formSchema": {
      "type": "object",
      "required": ["budget", "contact_time"],
      "properties": {
        "budget": {"type": "string", "title": "预算"},
        "contact_time": {"type": "string", "title": "预计联系时间", "format": "date-time"},
        "remark": {"type": "string", "title": "备注"}
      }
    },
    "uiSchema": {
      "budget": {"ui:placeholder": "例如 20 万"},
      "remark": {"ui:widget": "textarea"}
    },
    "expiresInSeconds": 86400
  }
}
```

### 2.6 工具与 MCP

`ai_tool`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 工具 ID |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID |
| name | varchar | 工具名 |
| type | varchar | http、builtin、mcp |
| description | text | 工具描述，供模型选择 |
| input_schema | json/text | JSON Schema |
| config_json | json/text | URL、Header、鉴权、MCP tool name 等 |
| status | varchar | active、disabled |

`mcp_server`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | MCP Server ID |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID |
| name | varchar | 名称 |
| transport | varchar | sse、http、stdio |
| endpoint | varchar | SSE/HTTP 地址 |
| command_config | json/text | stdio 命令配置，SaaS 默认禁用 |
| auth_config | json/text | 鉴权配置 |
| status | varchar | active、disabled |

### 2.7 知识库

`kb_dataset`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 数据集 ID |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID |
| name | varchar | 名称 |
| description | text | 描述 |
| embedding_provider_id | varchar | Embedding Provider |
| embedding_model | varchar | Embedding 模型 |
| chunk_strategy | varchar | fixed、heading、semantic |
| status | varchar | active、archived |

`kb_document`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 文档 ID |
| dataset_id | varchar | 数据集 ID |
| name | varchar | 文档名 |
| source_type | varchar | upload、url、api、text |
| object_key | varchar | 原文对象存储路径 |
| parse_status | varchar | pending、running、success、failed |
| index_status | varchar | pending、running、success、failed |
| error_message | text | 失败原因 |

`kb_chunk`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 分段 ID |
| dataset_id | varchar | 数据集 ID |
| document_id | varchar | 文档 ID |
| chunk_no | int | 分段序号 |
| content | text | 分段内容 |
| token_count | int | token 数 |
| metadata_json | json/text | 页码、标题、来源等 |
| vector_id | varchar | 向量库 ID |

### 2.8 Run 与 Trace

`ai_run`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | Run ID |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID |
| app_id | varchar | 应用 ID |
| app_version_id | varchar | 版本 ID |
| run_type | varchar | agent、workflow、knowledge_api |
| input_json | json/text | 输入 |
| output_json | json/text | 输出 |
| status | varchar | running、waiting、success、failed、cancelled、expired |
| current_wait_task_id | varchar | 当前等待任务 ID |
| resume_count | int | 已恢复次数 |
| total_tokens | int | 总 token |
| cost_amount | decimal | 成本，可选 |
| latency_ms | int | 耗时 |
| error_message | text | 错误 |

`ai_trace`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | Trace ID |
| run_id | varchar | Run ID |
| parent_trace_id | varchar | 父 Trace |
| type | varchar | llm、tool、retrieval、workflow_node、mcp |
| name | varchar | 步骤名 |
| input_json | json/text | 输入 |
| output_json | json/text | 输出 |
| status | varchar | success、failed |
| latency_ms | int | 耗时 |
| token_json | json/text | token 详情 |
| error_message | text | 错误 |

### 2.9 等待任务

`ai_wait_task`

用于承载流程运行中的用户确认、用户输入表单、外部系统回填等暂停点。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | varchar | 等待任务 ID |
| tenant_id | varchar | 租户 ID |
| workspace_id | varchar | 空间 ID |
| app_id | varchar | 应用 ID |
| app_version_id | varchar | 应用版本 ID |
| run_id | varchar | Run ID |
| trace_id | varchar | 对应节点 Trace ID |
| node_id | varchar | 等待节点 ID |
| node_type | varchar | user_confirm、user_form、external_callback |
| title | varchar | 展示标题 |
| description | text | 展示说明 |
| assignee_type | varchar | user、role、external、anonymous_token |
| assignee_id | varchar | 处理人、角色或外部主体 ID |
| form_schema_json | json/text | 表单 JSON Schema |
| ui_schema_json | json/text | 表单 UI Schema |
| action_schema_json | json/text | 可选动作定义 |
| default_values_json | json/text | 表单默认值 |
| context_json | json/text | 上下文，供外部渲染使用 |
| submit_result_json | json/text | 用户提交结果 |
| status | varchar | pending、submitted、rejected、cancelled、expired |
| submit_token_hash | varchar | 提交 token 哈希，匿名或外链场景使用 |
| idempotency_key | varchar | 最近一次提交幂等键 |
| expires_at | datetime | 过期时间 |
| submitted_at | datetime | 提交时间 |
| submitted_by | varchar | 提交人 |

等待任务设计原则：

1. `run` 只表示整体运行状态，`wait_task` 表示具体等待点。
2. 一个 `run` 可以多次进入 `waiting`，但同一时刻默认只有一个 active `wait_task`。
3. 外部系统提交等待任务必须幂等。
4. 提交后不可修改，如需更正应由流程生成新的等待任务。
5. 匿名链接只允许访问单个等待任务，不允许访问完整运行日志。

## 3. 管理 API

统一前缀：`/api/aio/admin`

### 3.1 App

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/apps` | 查询应用列表 |
| POST | `/apps` | 创建应用 |
| GET | `/apps/{appId}` | 获取应用详情 |
| PUT | `/apps/{appId}` | 更新应用基础信息 |
| POST | `/apps/{appId}/versions` | 保存草稿版本 |
| POST | `/apps/{appId}/publish` | 发布版本 |
| POST | `/apps/{appId}/archive` | 归档应用 |

### 3.2 Provider

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/providers` | 查询模型供应商 |
| POST | `/providers` | 创建供应商 |
| PUT | `/providers/{providerId}` | 更新供应商 |
| POST | `/providers/{providerId}/test` | 测试连接 |

### 3.3 Tool 与 MCP

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/tools` | 查询工具 |
| POST | `/tools` | 创建工具 |
| PUT | `/tools/{toolId}` | 更新工具 |
| POST | `/tools/{toolId}/test` | 测试工具 |
| GET | `/mcp-servers` | 查询 MCP Server |
| POST | `/mcp-servers` | 创建 MCP Server |
| POST | `/mcp-servers/{serverId}/sync-tools` | 同步 MCP 工具列表 |

### 3.4 知识库

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/datasets` | 查询知识库 |
| POST | `/datasets` | 创建知识库 |
| GET | `/datasets/{datasetId}` | 详情 |
| POST | `/datasets/{datasetId}/documents` | 上传或导入文档 |
| GET | `/datasets/{datasetId}/documents` | 文档列表 |
| POST | `/documents/{documentId}/reindex` | 重新解析索引 |
| POST | `/datasets/{datasetId}/retrieve-test` | 检索测试 |

## 4. 对外运行 API

统一前缀：`/v1`

鉴权方式：

```http
Authorization: Bearer sk-xxxx
```

### 4.1 Agent Chat

`POST /v1/apps/{appId}/chat`

请求：

```json
{
  "conversation_id": "optional-conv-id",
  "inputs": {
    "user_name": "张三"
  },
  "query": "帮我查一下售后政策",
  "stream": true
}
```

响应：

```json
{
  "run_id": "run_001",
  "conversation_id": "conv_001",
  "answer": "根据知识库资料...",
  "usage": {
    "prompt_tokens": 1200,
    "completion_tokens": 300,
    "total_tokens": 1500
  }
}
```

流式响应建议使用 SSE。

### 4.2 Workflow Run

`POST /v1/apps/{appId}/run`

请求：

```json
{
  "inputs": {
    "question": "这个客户应该怎么跟进？",
    "operator_id": "user_001"
  },
  "response_mode": "blocking",
  "callback_url": "https://example.com/aio/webhook",
  "metadata": {
    "external_biz_id": "crm_task_123"
  }
}
```

同步完成响应：

```json
{
  "run_id": "run_002",
  "status": "success",
  "outputs": {
    "answer": "建议先确认预算和上线时间。"
  }
}
```

等待用户输入响应：

```json
{
  "run_id": "run_003",
  "status": "waiting",
  "wait_task": {
    "id": "wait_001",
    "type": "user_confirm",
    "title": "确认是否创建跟进任务",
    "description": "建议为客户创建下周一的跟进任务。",
    "actions": [
      {"key": "approve", "label": "确认创建"},
      {"key": "reject", "label": "暂不创建"}
    ],
    "expires_at": "2026-04-30T10:00:00+08:00"
  }
}
```

`response_mode` 建议支持：

| 值 | 说明 |
| --- | --- |
| `blocking` | 尽量同步执行，遇到等待任务时立即返回 `waiting` |
| `streaming` | SSE 返回节点进度，遇到等待任务时发送 `wait_task.created` 事件 |
| `async` | 立即返回 `run_id`，后续通过查询 API 或 webhook 获取结果 |

### 4.3 Run 查询 API

`GET /v1/runs/{runId}`

响应：

```json
{
  "run_id": "run_003",
  "app_id": "app_001",
  "status": "waiting",
  "current_wait_task_id": "wait_001",
  "outputs": null,
  "created_at": "2026-04-29T10:00:00+08:00",
  "updated_at": "2026-04-29T10:01:00+08:00"
}
```

`GET /v1/runs/{runId}/traces`

用于外部系统查询节点级运行记录。默认只返回调用方有权限查看的脱敏数据。

### 4.4 等待任务 API

#### 4.4.1 查询等待任务

`GET /v1/wait-tasks/{waitTaskId}`

响应：

```json
{
  "id": "wait_001",
  "run_id": "run_003",
  "status": "pending",
  "type": "user_form",
  "title": "补充客户跟进信息",
  "description": "请补充客户预算和预计联系时间。",
  "form_schema": {
    "type": "object",
    "required": ["budget", "contact_time"],
    "properties": {
      "budget": {"type": "string", "title": "预算"},
      "contact_time": {"type": "string", "title": "预计联系时间", "format": "date-time"},
      "remark": {"type": "string", "title": "备注"}
    }
  },
  "ui_schema": {
    "remark": {"ui:widget": "textarea"}
  },
  "default_values": {},
  "context": {
    "customer_name": "上海某某科技有限公司"
  },
  "expires_at": "2026-04-30T10:00:00+08:00"
}
```

#### 4.4.2 提交确认结果

`POST /v1/wait-tasks/{waitTaskId}/submit`

请求头：

```http
Idempotency-Key: 8e4b1a1c-6d4f-4fd8-a2ef-42d0a5b39c11
```

请求：

```json
{
  "action": "approve",
  "comment": "确认创建任务",
  "submitted_by": {
    "type": "external_user",
    "id": "user_001",
    "name": "张三"
  }
}
```

响应：

```json
{
  "wait_task_id": "wait_001",
  "run_id": "run_003",
  "wait_task_status": "submitted",
  "run_status": "running"
}
```

如果流程继续执行后又遇到新的等待节点，可以直接返回新的 `wait_task`：

```json
{
  "wait_task_id": "wait_001",
  "run_id": "run_003",
  "wait_task_status": "submitted",
  "run_status": "waiting",
  "next_wait_task": {
    "id": "wait_002",
    "type": "user_form",
    "title": "补充审批意见"
  }
}
```

#### 4.4.3 提交表单结果

`POST /v1/wait-tasks/{waitTaskId}/submit`

请求：

```json
{
  "action": "submit",
  "form_data": {
    "budget": "20 万",
    "contact_time": "2026-05-06T10:00:00+08:00",
    "remark": "客户希望先看私有化报价"
  },
  "submitted_by": {
    "type": "external_user",
    "id": "user_001",
    "name": "张三"
  }
}
```

运行时会把结果写入节点输出，例如：

```json
{
  "collect_customer_info": {
    "action": "submit",
    "form_data": {
      "budget": "20 万",
      "contact_time": "2026-05-06T10:00:00+08:00",
      "remark": "客户希望先看私有化报价"
    }
  }
}
```

#### 4.4.4 拒绝或取消等待任务

`POST /v1/wait-tasks/{waitTaskId}/reject`

```json
{
  "reason": "信息不完整，暂不继续",
  "submitted_by": {
    "type": "external_user",
    "id": "user_001"
  }
}
```

`POST /v1/wait-tasks/{waitTaskId}/cancel`

用于系统管理员或外部业务系统取消等待任务。取消后流程按节点配置进入取消分支或整体结束。

#### 4.4.5 匿名提交链接

如果需要把确认或表单发给没有平台账号的用户，平台可以生成一次性提交 token。

`POST /v1/wait-tasks/{waitTaskId}/submit-token`

响应：

```json
{
  "submit_url": "https://aio.example.com/public/wait-tasks/wait_001?token=wt_xxx",
  "expires_at": "2026-04-30T10:00:00+08:00"
}
```

匿名 token 只允许：

1. 查看该等待任务的展示信息。
2. 提交该等待任务。
3. 不允许查看 run trace、应用配置、知识库内容。

### 4.5 Webhook 事件

外部系统可在调用 Workflow Run 时传入 `callback_url`，也可在应用管理中配置固定 webhook。

事件类型：

| 事件 | 说明 |
| --- | --- |
| `run.started` | 运行开始 |
| `run.waiting` | 运行进入等待 |
| `wait_task.created` | 等待任务创建 |
| `wait_task.submitted` | 等待任务已提交 |
| `wait_task.expired` | 等待任务过期 |
| `run.succeeded` | 运行成功 |
| `run.failed` | 运行失败 |
| `run.cancelled` | 运行取消 |

Webhook 请求示例：

```json
{
  "event_id": "evt_001",
  "event_type": "wait_task.created",
  "occurred_at": "2026-04-29T10:01:00+08:00",
  "run_id": "run_003",
  "wait_task_id": "wait_001",
  "app_id": "app_001",
  "metadata": {
    "external_biz_id": "crm_task_123"
  }
}
```

Webhook 必须支持签名：

```http
X-Agent-Ops-Timestamp: 1777447260
X-Agent-Ops-Signature: sha256=xxxx
```

### 4.6 知识库 API

`POST /v1/datasets/{datasetId}/documents`

用于外部系统写入知识。

`POST /v1/datasets/{datasetId}/retrieve`

请求：

```json
{
  "query": "退款政策是什么？",
  "top_k": 5,
  "score_threshold": 0.45
}
```

响应：

```json
{
  "records": [
    {
      "chunk_id": "chunk_001",
      "document_id": "doc_001",
      "content": "退款政策...",
      "score": 0.82,
      "metadata": {
        "page": 3
      }
    }
  ]
}
```

## 5. API 设计原则

1. 管理 API 和运行 API 分离。
2. 外部 API 只访问已发布版本。
3. 所有运行 API 返回 `run_id`。
4. 所有等待用户动作的流程必须返回或可查询 `wait_task`。
5. 等待任务提交 API 必须支持幂等，避免重复确认、重复创建业务数据。
6. 等待任务的展示数据和运行 trace 分权开放，匿名用户只能访问单个等待任务。
7. 所有敏感配置只允许写入，不明文返回。
8. 知识库 API 独立暴露，方便外部业务系统同步知识。
9. 私有化和 SaaS 使用同一套 API，差异由鉴权和配置控制。
