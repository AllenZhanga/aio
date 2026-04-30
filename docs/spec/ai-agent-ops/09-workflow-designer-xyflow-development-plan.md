# Workflow 设计器 Xyflow 重构开发规划

日期：2026-04-30

## 1. 决策结论

Workflow 设计器底层直接替换为 `@xyflow/react`，不再继续扩展当前自研 DOM + SVG 画布。

这次重构的目标不是“把现有画布照搬到 Xyflow”，而是借迁移机会把 Workflow 设计器升级为平台级能力：

1. 专业画布：天然支持平移、缩放、滚轮、选择、MiniMap、Controls、Background、Handle、Edge 和 Edge Label。
2. 中文体验：节点库、节点卡片、属性面板只面向用户展示中文名称；英文类型仅作为 DSL 内部字段。
3. 快速编排：支持拖线连接、节点出口 `+` 新增、连线中点 `+` 插入、拖线到空白处新增。
4. 变量体系：建立 `inputs`、`vars`、`nodes`、`sys`、`env`、`metadata` 的统一变量命名空间和图形化变量选择器。
5. 输入输出：所有节点都有统一“输入映射 / 配置 / 输出定义 / 高级设置”，同时保留不同节点的个性化属性。
6. 可发布校验：前后端共同基于 NodeSpec 校验节点配置、端口、DAG、变量引用和依赖权限。
7. 草稿隔离：设计器默认修改草稿版本，只有发布成功后才切换线上运行版本。
8. 能力优先：当前仍处于开发阶段，不做历史 Workflow 迁移或适配，直接按目标能力重建画布、DSL、变量、运行时和发布检查闭环。

## 2. 范围边界

### 2.1 本次重构必须完成

| 模块 | 必须能力 |
| --- | --- |
| 画布底层 | 使用 `@xyflow/react` 替换当前自研画布，支持平移、缩放、滚轮、MiniMap、Controls、Background。 |
| 节点展示 | 所有节点展示中文名称，隐藏内部 ID 和英文类型。 |
| 节点库 | 按分类展示节点，支持点击新增、拖拽到画布新增。 |
| 连线 | 支持 Handle 连接、连线选中、连线条件编辑、连线中点 `+` 插入节点。 |
| 快捷新增 | 支持节点出口 `+` 新增后继节点，自动建立连线。 |
| 属性面板 | 节点属性按“基础 / 输入 / 配置 / 输出 / 调试 / 高级”分区。 |
| 变量选择 | 输入框支持插入变量，变量树按可见范围过滤。 |
| DSL | 直接保存新的 Workflow DSL，不保留历史 DSL 迁移和恢复逻辑。 |
| 草稿发布 | 默认保存草稿，线上 Runtime 只读取已发布版本；发布时把草稿固化为不可变版本。 |
| 后端运行 | Runtime 直接按新变量命名空间、节点输入输出和流程变量执行。 |
| 发布检查 | 强化 Workflow 校验，覆盖变量引用、节点必填项、端口和连通性。 |

### 2.2 本次可延后

| 能力 | 延后原因 |
| --- | --- |
| 多人实时协作 | 需要协同协议、冲突处理、光标和锁定机制。 |
| 子流程 / 组件封装 | 需要定义复用节点、入参出参和版本管理。 |
| 循环节点真实执行 | 当前运行时以 DAG 为主，循环需要步数、退出条件和观测模型。 |
| 高级表达式语言 | 第一版继续使用模板表达式和简单条件，后续再引入安全表达式引擎。 |
| 自动布局高级算法 | 第一版可做简单左右布局；复杂布局后续引入 dagre/elk。 |
| 节点插件市场 | 先用内置 NodeSpec 注册表，后续再外部化。 |

## 3. 目标用户体验

### 3.1 设计页面结构

```text
顶部工具栏：返回 / 应用名 / 保存状态 / 撤销 / 重做 / 变量 / 校验 / 试运行 / 发布
左侧节点库：基础 / AI / 知识 / 工具 / 控制 / 人工 / 输出
中间 Xyflow 画布：Background / Nodes / Edges / MiniMap / Controls
右侧属性面板：节点属性 / 连线属性 / 变量引用 / Workflow JSON 高级预览
底部抽屉：运行日志 / Trace / 校验问题 / 测试用例
```

### 3.2 节点卡片体验

节点卡片只展示用户能理解的信息：

1. 中文图标与中文名称，例如“开始”“大模型”“知识检索”。
2. 输入摘要，例如“输入：question”。
3. 输出摘要，例如“输出：text、usage”。
4. 状态标签，例如“未配置”“已配置”“运行成功”“运行失败”。
5. 左侧输入 Handle、右侧输出 Handle；条件节点可展示多个命名输出 Handle。
6. 选中时显示节点出口 `+`。
7. Hover 时显示更多动作：复制、禁用、删除、单步调试。

不展示：

1. `llm`、`knowledge_retrieval` 这类英文 type。
2. 内部节点 ID。
3. 原始 JSON。

这些内容统一放到右侧“高级”折叠区。

### 3.3 连接与新增体验

1. 从输出 Handle 拖到输入 Handle：创建连线。
2. 从输出 Handle 拖到空白画布：弹出节点选择器，选择后创建节点并连线。
3. 点击节点出口 `+`：选择节点，自动在右侧新增并连线。
4. Hover 连线中点 `+`：插入节点，把 `A -> B` 改为 `A -> N -> B`。
5. 点击连线：右侧属性面板编辑条件表达式、标签、优先级。
6. 删除节点：自动删除相关连线，并触发变量引用校验。

### 3.4 变量引用体验

所有可输入表达式的字段右侧都有“插入变量”：

```text
流程输入
  inputs.question        用户问题 string
  inputs.operator_id     操作人 string
流程变量
  vars.customerId        客户 ID string
  vars.priority          优先级 string
上游节点输出
  nodes.retrieve.chunks  知识片段 array
  nodes.answer.text      大模型输出 string
系统变量
  sys.runId              当前运行 ID
  sys.appId              当前应用 ID
环境变量
  env.API_BASE_URL       API 地址 secret/string
```

选择变量后自动插入 `{{nodes.answer.text}}`。变量树只展示当前节点可引用的上游变量，避免引用下游节点。

### 3.5 草稿与发布交互

设计器进入后默认编辑草稿，不直接改线上版本。

界面需要明确展示三类状态：

1. 草稿保存状态：`未保存`、`保存中`、`已保存`、`保存失败`。
2. 发布差异状态：`无未发布修改`、`有未发布修改`、`草稿校验失败`。
3. 线上版本状态：当前线上版本号、发布时间、发布人、运行中版本 ID。

推荐交互：

1. 用户在画布、属性面板、变量面板中的所有修改都自动保存到草稿。
2. 顶部工具栏展示“草稿已保存 · 有未发布修改”。
3. 点击“试运行”默认使用草稿定义，仅用于设计期验证，不影响线上调用。
4. 点击“发布”先执行发布检查；检查通过后弹出发布确认，展示变更摘要、校验结果和即将发布的版本号。
5. 发布成功后，线上 Runtime 才切换到新发布版本；草稿状态变为“无未发布修改”。
6. API Key、体验页、外部 Runtime 调用默认只使用 `publishedVersionId` 指向的线上版本。
7. 如果草稿与线上版本不同，体验页应提示“线上版本不是当前草稿”；设计器内试运行才使用草稿。

## 4. 技术架构

### 4.1 依赖变更

前端新增依赖：

1. `@xyflow/react`：核心画布库。

可选依赖，第一版先不引入：

1. `dagre` 或 `elkjs`：自动布局。
2. `zod`：前端表单和 DSL schema 校验。
3. `react-hook-form`：复杂表单管理。

第一版建议只新增 `@xyflow/react`，避免一次性引入过多框架。

### 4.2 前端目录规划

建议把 Workflow 设计器拆成专属目录，避免继续堆在单个组件文件中：

```text
apps/web/src/components/workflow-designer/
  WorkflowDesigner.tsx                 设计器入口，组合布局
  WorkflowCanvas.tsx                   Xyflow 画布容器
  WorkflowNodeCard.tsx                 自定义节点组件
  WorkflowEdge.tsx                     自定义连线组件，支持中点 +
  NodePalette.tsx                      左侧节点库
  NodeAddMenu.tsx                      新增/插入节点选择器
  WorkflowInspector.tsx                右侧属性面板总入口
  NodeInspector.tsx                    节点属性面板
  EdgeInspector.tsx                    连线属性面板
  VariablePanel.tsx                    变量树和插入器
  VariablePicker.tsx                   输入框变量选择浮层
  WorkflowToolbar.tsx                  顶部操作栏
  WorkflowValidationPanel.tsx          校验问题展示
  WorkflowPublishPanel.tsx             草稿差异、发布确认、版本摘要
  WorkflowDraftStatus.tsx              草稿保存状态和未发布修改提示
  nodeSpecs.ts                         NodeSpec 注册表
  nodeRegistry.ts                      节点类型插件注册和查找
  nodeConfigRenderers.tsx              节点配置字段渲染器和自定义配置面板入口
  workflowDsl.ts                       新 DSL 序列化、恢复、默认模板
  workflowDraftApi.ts                  草稿保存、恢复、校验、发布 API 封装
  workflowGraph.ts                     图操作：新增、插入、删除、可达性、上游变量
  workflowValidation.ts                前端轻量校验
  workflowTypes.ts                     画布和 DSL 类型
```

为了减少调用方改动，可以保留现有入口文件 `apps/web/src/components/WorkflowDesigner.tsx`，让它 re-export 新目录入口。

### 4.3 前端状态模型

Xyflow 内部使用 `nodes` 和 `edges`：

```ts
WorkflowFlowNode = Node<WorkflowNodeData>;
WorkflowFlowEdge = Edge<WorkflowEdgeData>;
```

业务层保留自己的 Workflow 草稿状态：

```ts
WorkflowDraft = {
  version: 1;
  inputs: WorkflowInputDefinition[];
  variables: WorkflowVariableDefinition[];
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  ui: {
    nodes: WorkflowNodeUi[];
    viewport: { x: number; y: number; zoom: number };
  };
};
```

推荐原则：

1. Xyflow `nodes` / `edges` 只承担画布展示和交互。
2. `WorkflowDraft` 承担最终保存和发布 DSL。
3. 两者通过 `workflowDsl.ts` 做双向转换。
4. 不把全部业务配置塞进 Xyflow 的 `data`，避免后续迁移困难。

### 4.4 草稿和发布版本数据模型

当前代码里已有 `ai_apps` 和 `ai_app_versions`：

1. `ai_apps.published_version_id` 可以指向线上运行版本。
2. `ai_app_versions.definition_json` 可以保存版本定义。
3. `publish_status` 可以区分版本状态。

但为了满足“默认修改草稿，发布后才影响线上”的产品语义，建议新增独立草稿表，把“可变草稿”和“不可变发布版本”分开：

```sql
create table ai_app_drafts (
  id varchar(64) primary key,
  tenant_id varchar(64) not null references tenants(id),
  workspace_id varchar(64) not null references workspaces(id),
  app_id varchar(64) not null references ai_apps(id),
  base_version_id varchar(64) references ai_app_versions(id),
  definition_json text not null,
  validation_json text,
  revision int not null default 1,
  dirty boolean not null default true,
  autosaved_by varchar(64),
  autosaved_at timestamp with time zone,
  created_at timestamp with time zone not null,
  updated_at timestamp with time zone not null,
  unique (app_id)
);

create index idx_ai_app_drafts_tenant_app on ai_app_drafts(tenant_id, app_id);
```

表职责：

| 表 | 职责 | 是否可变 | Runtime 是否读取 |
| --- | --- | --- | --- |
| `ai_apps` | 应用元数据、状态、当前线上版本指针 `published_version_id` | 可变 | 只读取 `published_version_id` |
| `ai_app_drafts` | 当前编辑中的草稿定义、校验结果、保存状态、基线版本 | 可变 | 设计期试运行可读，线上运行不读 |
| `ai_app_versions` | 发布成功后的不可变版本快照、版本号、发布人、发布时间 | 不可变 | 线上运行只读这里 |

发布流程：

1. 设计器自动保存到 `ai_app_drafts.definition_json`，递增 `revision`，设置 `dirty=true`。
2. 发布时校验 `ai_app_drafts.definition_json`。
3. 校验通过后新建一条 `ai_app_versions`，`version_no = max(version_no) + 1`。
4. 更新 `ai_apps.published_version_id = 新版本 ID`，`status=published`。
5. 更新 `ai_app_drafts.base_version_id = 新版本 ID`，`dirty=false`。
6. Runtime 继续只通过 `ai_apps.published_version_id` 获取线上定义，避免草稿影响线上调用。

建议 API：

| API | 作用 |
| --- | --- |
| `GET /api/aio/admin/apps/{appId}/draft` | 打开设计器时读取当前草稿；没有草稿则基于默认 DSL 创建。 |
| `PUT /api/aio/admin/apps/{appId}/draft` | 自动保存草稿，携带 `revision` 做并发保护。 |
| `POST /api/aio/admin/apps/{appId}/draft/validate` | 校验草稿并保存 `validation_json`。 |
| `POST /api/aio/admin/apps/{appId}/draft/run` | 使用草稿进行设计期试运行，不更新线上版本。 |
| `POST /api/aio/admin/apps/{appId}/publish` | 从草稿发布，生成不可变版本并切换线上指针。 |
| `GET /api/aio/admin/apps/{appId}/versions` | 查看发布历史、回滚或对比。 |

### 4.5 NodeSpec 注册表

每类节点必须有统一规格：

```ts
WorkflowNodeSpec = {
  type: WorkflowNodeType;
  displayName: string;
  category: "basic" | "ai" | "knowledge" | "tool" | "control" | "human" | "output";
  description: string;
  icon: ReactNode;
  accent: string;
  defaultLabel: string;
  defaultInputs: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  outputSchema: WorkflowSchema;
  inputSchema: WorkflowSchema;
  configSchema: WorkflowSchema;
  validate?: (node, graph) => ValidationIssue[];
};
```

NodeSpec 用途：

1. 渲染左侧节点库。
2. 创建节点默认值。
3. 渲染节点卡片摘要。
4. 渲染右侧属性表单。
5. 生成变量选择器中的输出字段。
6. 发布前校验必填项。
7. 后端可对齐同名 NodeSpec 或至少保持字段一致。

### 4.6 节点配置抽象层和扩展机制

每个节点都要根据类型加载不同配置，但不建议用 React 组件继承来做。React 和 TypeScript 更适合“组合 + 注册表 + 策略接口”：

1. 统一外壳：`WorkflowNodeCard`、`NodeInspector`、`BaseConfigSection` 负责节点卡片、通用分区、错误态、输入输出区、高级区。
2. 类型插件：每个节点类型注册一个 `WorkflowNodePlugin`，只描述差异能力。
3. 配置渲染：默认用字段 Schema 渲染；复杂节点可提供自定义 `ConfigPanel` 插槽。
4. 后端执行：同一节点类型在后端有对应 executor/handler，字段名与前端 NodeSpec 对齐。
5. 校验策略：通用校验处理 DAG、端口、变量、必填；节点插件只补充类型专属校验。

推荐抽象：

```ts
type WorkflowNodePlugin = {
  type: WorkflowNodeType;
  spec: WorkflowNodeSpec;
  createDefaultNode: (context: CreateNodeContext) => WorkflowNodeDefinition;
  normalizeConfig?: (config: unknown) => Record<string, unknown>;
  validateConfig?: (node: WorkflowNodeDefinition, graph: WorkflowDraft) => ValidationIssue[];
  renderConfig?: React.ComponentType<NodeConfigPanelProps>;
  renderSummary?: React.ComponentType<NodeSummaryProps>;
  buildRuntimeInputs?: (node: WorkflowNodeDefinition) => Record<string, unknown>;
};
```

默认渲染流程：

1. `NodeInspector` 根据 `node.type` 从 `nodeRegistry` 找到插件。
2. 先渲染通用“基础 / 输入 / 输出 / 高级”。
3. “配置”分区优先使用插件的 `renderConfig`。
4. 如果没有 `renderConfig`，则使用 `spec.configSchema` 和 `nodeConfigRenderers.tsx` 自动渲染字段。
5. 保存时统一写回 `node.config`，不让不同节点组件直接改全局状态结构。

这种方式比继承更适合扩展：

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 类继承 `BaseNode extends ...` | 不推荐 | React 函数组件和 hooks 不适合类继承；继承层级深后难组合输入、输出、校验、调试等横切能力。 |
| 组件组合 + 插槽 | 推荐 | 通用能力在外壳，差异能力通过 `renderConfig`、`renderSummary` 插入。 |
| NodeSpec + 字段 Schema | 推荐 | 大多数节点无需写专属面板，新增字段只改配置。 |
| 节点插件注册表 | 推荐 | 新增节点只新增插件、后端 executor 和校验映射，扩展边界清晰。 |

新增节点开发约定：

1. 新增 `nodes/<type>/plugin.tsx`，导出 `WorkflowNodePlugin`。
2. 在 `nodeRegistry.ts` 注册插件。
3. 提供 `displayName`、`inputSchema`、`configSchema`、`outputSchema`、默认配置。
4. 若 Schema 表单无法满足，再提供自定义 `renderConfig`。
5. 后端新增同名 executor 和校验规则。
6. 补充前端序列化/恢复测试、后端发布校验和运行测试。

## 5. 目标 DSL 设计

### 5.1 顶层结构

```json
{
  "type": "workflow",
  "version": 1,
  "inputs": [
    { "name": "question", "type": "string", "required": true, "description": "用户问题" },
    { "name": "operator_id", "type": "string", "required": false, "description": "操作人" }
  ],
  "variables": [
    { "name": "customerId", "type": "string", "default": "", "description": "客户 ID" }
  ],
  "nodes": [],
  "edges": [],
  "ui": {
    "nodes": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

### 5.2 节点结构

```json
{
  "id": "answer",
  "type": "llm",
  "label": "生成回复",
  "enabled": true,
  "inputs": {
    "prompt": "{{inputs.question}}",
    "context": "{{nodes.retrieve.chunks}}"
  },
  "config": {
    "providerAccountId": "provider_xxx",
    "chatModel": "qwen-plus",
    "temperature": 0.3
  },
  "outputs": {
    "text": "{{node.text}}"
  },
  "runtime": {
    "timeoutSeconds": 60,
    "retry": { "maxAttempts": 0 }
  }
}
```

说明：

1. `inputs` 是节点入参映射，支持固定值、变量引用和表达式。
2. `config` 是节点类型独有配置。
3. `outputs` 是输出映射，可把节点原始输出整理成稳定字段。
4. `runtime` 是通用高级配置。
5. 该结构作为唯一 DSL：节点创建、保存、恢复、发布和运行都以该结构为准。

### 5.3 连线结构

```json
{
  "id": "edge_answer_end",
  "from": "answer",
  "to": "end",
  "sourceHandle": "success",
  "targetHandle": "input",
  "label": "成功",
  "condition": "{{nodes.confirm.action == 'approve'}}",
  "priority": 0
}
```

说明：

1. `sourceHandle` / `targetHandle` 对应 Xyflow Handle。
2. 第一版只有单输入端口；条件节点可有多个输出端口。
3. `condition` 使用统一表达式语法。
4. `priority` 用于多条可选边时的执行顺序。

## 6. 变量与运行上下文

### 6.1 新运行上下文

后端 Runtime 建议升级为：

```json
{
  "inputs": {},
  "vars": {},
  "nodes": {},
  "sys": {},
  "env": {},
  "metadata": {}
}
```

写入规则：

1. Start 初始化 `inputs`、`metadata`、`vars`、`sys`。
2. 每个节点执行前先解析 `node.inputs`。
3. 节点执行结果写入 `nodes[nodeId]`。
4. 节点输出映射可以写入 `nodes[nodeId]` 的稳定字段。
5. Variable 节点或任意节点的“写入流程变量”配置可以更新 `vars`。
6. End 节点根据 `outputs` 或 `config.output` 生成最终响应。
7. Wait Task 暂停时持久化完整上下文，恢复时继续执行。

### 6.2 变量引用语法

新 Workflow 统一使用命名空间变量引用：

```text
{{inputs.question}}
{{nodes.answer.text}}
{{nodes.confirm.action}}
{{vars.customerId}}
```

规则：

1. 所有节点输出必须通过 `nodes.nodeId.field` 引用。
2. 流程级变量必须通过 `vars.name` 引用。
3. 系统变量必须通过 `sys.name` 引用。
4. 环境变量必须通过 `env.name` 引用。
5. 发布检查发现未定义根命名空间、未定义节点或未定义字段时直接阻断。

### 6.3 图形化变量选择器

变量选择器数据来源：

1. `definition.inputs`。
2. `definition.variables`。
3. 当前节点所有上游节点的 `outputSchema`。
4. 系统内置变量 `sys`。
5. 当前 workspace 可用的环境变量/密钥引用 `env`。
6. 节点调试样例输出。

变量可见性：

1. 只显示当前节点上游变量。
2. Start 节点只显示 `inputs`、`metadata`、`sys`、`env`。
3. 条件分支中的下游节点只能看到对应路径上游变量；第一版可简化为 DAG 上所有可达前驱。
4. 删除节点或断开连线后，引用该节点输出的字段要出现校验错误。

## 7. Xyflow 画布实现方案

### 7.1 React Flow Provider

设计器入口包裹：

```tsx
<ReactFlowProvider>
  <WorkflowDesigner />
</ReactFlowProvider>
```

画布中使用：

1. `ReactFlow`。
2. `Background`。
3. `Controls`。
4. `MiniMap`。
5. `Panel`。
6. `useReactFlow()`。
7. `useNodesState()` / `useEdgesState()` 或业务 reducer。

### 7.2 自定义节点

注册节点类型：

```ts
const nodeTypes = {
  workflowNode: WorkflowNodeCard,
};
```

所有业务节点使用同一个 `workflowNode` 组件，内部按 `data.type` 读取 NodeSpec 渲染。这样新增节点类型不需要注册新的 React Flow node type。

节点 `data` 建议包含：

```ts
{
  nodeId: string;
  type: WorkflowNodeType;
  label: string;
  status?: "idle" | "invalid" | "running" | "success" | "failed" | "waiting";
  inputSummary: string[];
  outputSummary: string[];
  issues: ValidationIssue[];
}
```

### 7.3 自定义连线

注册边类型：

```ts
const edgeTypes = {
  workflowEdge: WorkflowEdge,
};
```

`WorkflowEdge` 基于 Xyflow 的 `BaseEdge`、`EdgeLabelRenderer` 实现：

1. 贝塞尔线。
2. 箭头 marker。
3. hover 高亮。
4. 中点 `+` 按钮。
5. 条件标签。
6. 点击选中。

### 7.4 连接校验

`isValidConnection` 规则：

1. source 和 target 不能相同。
2. 只能 source Handle 连 target Handle。
3. target 节点不能是 Start。
4. source 节点不能是 End。
5. 第一版不允许形成环。
6. 同一 sourceHandle 到同一 targetHandle 不重复连线。
7. 条件节点可有多条分支；普通节点默认只允许一条主后继，用户可明确创建分支。

### 7.5 坐标和视图保存

保存草稿时写入：

```json
"ui": {
  "nodes": [
    { "id": "answer", "label": "生成回复", "x": 360, "y": 130 }
  ],
  "viewport": { "x": -120, "y": -40, "zoom": 0.9 }
}
```

恢复时：

1. 先从 DSL 生成 Xyflow nodes/edges。
2. 使用 `ui.nodes` 恢复位置。
3. 使用 `setViewport()` 恢复视图。
4. 缺失坐标时用简单自动布局生成默认坐标。

## 8. 节点体系规划

### 8.1 第一批节点

| 分类 | 节点 | 必填配置 | 默认输出 |
| --- | --- | --- | --- |
| 基础 | 开始 | 输入变量定义 | `inputs` |
| 基础 | 变量赋值 | 变量写入规则 | 用户定义字段 |
| AI | 大模型 | prompt 或输入映射 prompt | `text`、`usage`、`raw` |
| AI | 智能体 | appId 或 query | `answer`、`outputs` |
| 知识 | 知识检索 | datasetId、query | `chunks`、`query` |
| 工具 | 工具调用 | toolId、input | `output`、`latencyMs` |
| 工具 | HTTP 请求 | url、method | `status`、`body`、`headers` |
| 控制 | 条件分支 | expression | `matched` |
| 控制 | 代码执行 | language、code | `result` |
| 人工 | 人工确认 | title、actions、expiresInSeconds | `action`、`submittedBy` |
| 人工 | 人工表单 | title、formSchema | `values`、`submittedBy` |
| 输出 | 结束 | output 映射 | `outputs` |

### 8.2 端口规则

| 节点 | 输入端口 | 输出端口 |
| --- | --- | --- |
| 开始 | 无 | `main` |
| 结束 | `input` | 无 |
| 条件分支 | `input` | `true`、`false`、`else` |
| 人工确认 | `input` | `approve`、`reject`、`timeout` |
| 人工表单 | `input` | `submit`、`timeout` |
| 其他普通节点 | `input` | `main` |

第一版可以 UI 展示多个端口，但运行时仍按 `edges` 和 `condition` 选择下一节点。后续再把命名端口和运行策略完全绑定。

## 9. 属性面板规划

### 9.1 通用分区

每个节点都采用统一分区：

1. 基础：节点名称、说明、启用状态。
2. 输入：输入映射表，支持固定值、变量引用和表达式。
3. 配置：节点专属配置表单。
4. 输出：输出字段、写入流程变量、示例输出。
5. 调试：单节点试运行、最近一次输入输出。
6. 高级：节点 ID、内部类型、超时、重试、缓存、原始 JSON。

### 9.2 配置表单策略

第一版不引入 JSON Schema 表单库，先用自定义表单渲染：

1. `Field` + `input/select/textarea`。
2. NodeSpec 定义字段数组。
3. 字段支持 `text`、`number`、`select`、`json`、`variableExpr`、`datasetSelect`、`providerSelect`、`toolSelect`。
4. 复杂 JSON 字段保留 textarea + 格式化按钮。

后续如果字段复杂度上升，再引入 JSON Schema Form。

## 10. 后端改造规划

### 10.1 RuntimeService

需要改造点：

1. `newWorkflowContext()` 初始化 `vars`、`nodes`、`sys`。
2. `executeWorkflow()` 按目标 DSL 执行 `node.inputs`、`node.outputs`、`runtime`。
3. `executeWorkflowNode()` 接收解析后的节点入参，而不是直接读 `config`。
4. 节点执行结果写入 `context.nodes[nodeId]`。
5. `resolvePath()` 严格解析 `inputs.xxx`、`nodes.xxx`、`vars.xxx`、`sys.xxx`、`env.xxx`、`metadata.xxx`。
6. Wait Task 的 `contextJson` 保存完整运行上下文。
7. End 节点使用 `outputs` 生成最终返回结果。
8. Trace 记录节点实际输入、节点原始输出、输出映射后结果。

### 10.2 AppValidationService

当前已有基础 Workflow 校验，需要增强：

1. 校验目标 DSL 的 `type`、`version`、`inputs`、`variables`、`nodes`、`edges`、`ui` 顶层结构。
2. 校验 `inputs` 和 `variables` 名称合法且不重复。
3. 校验节点 `inputs`、`config`、`outputs` 必填项。
4. 校验 `sourceHandle` / `targetHandle` 是否符合 NodeSpec 端口规则。
5. 校验所有变量引用根：`inputs`、`vars`、`nodes`、`sys`、`env`、`metadata`。
6. 校验 `nodes.xxx` 引用的节点存在，且尽量只引用上游节点。
7. 校验输出字段是否存在于上游节点 `outputSchema`。
8. 发现未定义命名空间、节点或字段时阻断发布。
9. 条件节点必须有分支或兜底分支。
10. 人工确认/表单必须配置恢复分支或明确结束策略。

### 10.3 NodeSpec 后端对齐

短期可以前后端各自维护 NodeSpec，但必须保持字段一致。中期建议后端提供：

```text
GET /api/aio/admin/workflow/node-specs
```

返回节点规格，前端动态渲染节点库和属性表单。

第一版为了开发效率，可以先前端静态 NodeSpec + 后端校验服务同步实现。

### 10.4 AppDraftService 和发布隔离

需要新增 `AppDraftService` 或在 `AppService` 中拆出草稿能力：

1. `getOrCreateDraft(appId)`：打开设计器时返回当前草稿；无草稿则创建默认 Workflow DSL。
2. `saveDraft(appId, definitionJson, revision)`：保存草稿，做 `revision` 并发校验，避免多窗口覆盖。
3. `validateDraft(appId)`：校验草稿并保存校验报告。
4. `runDraft(appId, inputs)`：使用草稿试运行，写入设计期运行记录或标记 `run_source=draft`。
5. `publishDraft(appId, userId)`：校验草稿，生成不可变版本，更新 `ai_apps.published_version_id`。
6. `rollbackToVersion(appId, versionId)`：可选，把某个已发布版本复制为新草稿，由用户再发布。

Runtime 必须遵守：

1. 外部调用只读取 `ai_apps.published_version_id` 对应的 `ai_app_versions.definition_json`。
2. 草稿试运行必须走单独入口，不能覆盖 `published_version_id`。
3. 运行记录需要保存 `app_version_id`；草稿试运行可额外保存 `draft_revision`，便于回溯。

## 11. 前端实施步骤

### 阶段 0：准备与隔离

目标：不破坏现有 Agent 设计、发布、体验链路。

1. 安装 `@xyflow/react`。
2. 新建 `workflow-designer` 目录。
3. 保留现有 `WorkflowDesigner.tsx` 作为导出壳。
4. 增加 `workflowTypes.ts`、`nodeSpecs.ts`、`nodeRegistry.ts`、`workflowDsl.ts`、`workflowDraftApi.ts`。
5. 建立目标 DSL 默认模板、序列化、恢复、草稿保存和校验样例。
6. 后端增加 `ai_app_drafts` 表和草稿 API。

验收：前端构建通过，默认 Workflow 模板能打开、自动保存到草稿，且不影响线上版本。

### 阶段 1：Xyflow 画布替换

目标：先把底层画布换掉。

1. 实现 `WorkflowCanvas.tsx`。
2. 接入 `ReactFlowProvider`、`ReactFlow`、`Background`、`Controls`、`MiniMap`。
3. 实现 `WorkflowNodeCard.tsx`。
4. 实现默认 Workflow 模板到 Xyflow 的转换。
5. 支持节点拖动、视图缩放、平移和位置保存。
6. 支持选中节点/连线，同步到右侧属性面板。

验收：默认 Start -> LLM -> 人工确认 -> End 能正常展示、拖动、缩放和平移。

### 阶段 2：中文节点库和新增节点

目标：完成可用编排。

1. 实现 `NodePalette.tsx`。
2. 按分类展示中文节点。
3. 支持点击节点库新增节点。
4. 支持拖拽节点库到画布新增节点。
5. 支持节点默认配置。
6. 节点卡片隐藏内部 ID 和英文 type。

验收：所有当前支持的节点都能以中文从节点库新增。

### 阶段 3：连线与 `+` 插入

目标：满足高效编排核心体验。

1. 实现 `WorkflowEdge.tsx`。
2. 支持连线 hover 中点 `+`。
3. 实现 `NodeAddMenu.tsx`。
4. 节点出口显示 `+`。
5. 点击节点出口 `+` 新增后继节点并自动连线。
6. 点击连线中点 `+` 插入节点并替换连线。
7. 拖线到空白处弹出新增菜单。
8. 加入连接校验，避免自连、重复边和环。

验收：用户可以不手动画线，仅通过 `+` 完成 Start -> 大模型 -> 结束。

### 阶段 4：属性面板重构

目标：从 textarea 升级到结构化表单。

1. 实现 `WorkflowInspector.tsx`。
2. 实现 `NodeInspector.tsx`。
3. 实现 `EdgeInspector.tsx`。
4. 实现 `nodeConfigRenderers.tsx`，按字段 Schema 渲染不同节点配置。
5. 支持节点插件自定义 `renderConfig`，覆盖复杂配置面板。
6. 每个节点显示基础、输入、配置、输出、高级分区。
7. 连线显示条件表达式、标签、优先级。
8. 高级区展示节点 ID、内部类型、原始 JSON。
9. 配置变更实时更新 DSL 草稿。

验收：大模型、知识检索、HTTP、人工确认、结束节点都可通过结构化表单配置。

### 阶段 5：变量管理与变量选择器

目标：变量传递可视化。

1. DSL 增加 `variables`。
2. 实现流程输入变量管理。
3. 实现流程变量管理。
4. 实现 `VariablePanel.tsx`。
5. 实现 `VariablePicker.tsx`。
6. 输入字段支持插入变量。
7. 根据图上游关系生成可引用变量树。
8. 引用不存在时在属性面板和校验面板提示。

验收：可以在大模型 Prompt 中图形化选择 `{{inputs.question}}` 和 `{{nodes.retrieve.chunks}}`。

### 阶段 6：发布检查与调试闭环

目标：发布前发现明显错误。

1. 前端实时轻量校验。
2. 发布前调用后端草稿校验 API。
3. 校验问题支持点击定位到节点或连线。
4. 节点卡片显示错误状态。
5. 属性面板显示当前节点相关问题。
6. 实现草稿试运行，明确区分“草稿试运行”和“线上体验”。
7. 试运行后把 Trace 状态回显到画布。
8. 发布面板展示草稿差异、校验结果、发布版本号和确认操作。

验收：缺 prompt、断线、变量不存在、无 End、环路等问题均可阻断或提示；发布后线上版本才切换。

### 阶段 7：后端 Runtime

目标：让新 DSL 真实运行。

1. Runtime 读取目标 DSL 的 `node.inputs`。
2. Runtime 写入 `context.nodes`。
3. Runtime 支持 `vars`。
4. Runtime 使用统一变量引用和条件表达式语法。
5. Trace 输出包含节点入参和输出映射。
6. Wait Task 暂停/恢复保持完整运行上下文。
7. 后端测试覆盖目标 DSL 的节点输入、输出、变量和暂停恢复链路。

验收：Workflow 能通过 API 运行，大模型、变量、人工确认、结束输出链路正常。

## 12. 测试计划

### 12.1 前端测试重点

1. 默认 DSL 恢复为 Xyflow nodes/edges。
2. 目标 DSL 序列化后可再次恢复。
3. 节点新增、删除、复制、插入。
4. 连线创建、删除、插入节点。
5. 坐标和 viewport 保存恢复。
6. 变量树只展示上游变量。
7. 属性面板修改后 DSL 正确更新。
8. 校验问题能定位节点/连线。
9. 草稿自动保存、刷新后恢复、发布后清除未发布修改提示。
10. 不同节点类型能通过 NodeSpec 或自定义 `renderConfig` 加载不同配置面板。

### 12.2 后端测试重点

1. 目标 DSL 的 `inputs`、`vars`、`nodes` 可解析。
2. 统一变量引用和条件表达式可解析。
3. 节点输出能被下游引用。
4. Variable 节点能写入 `vars`。
5. End 节点输出映射正确。
6. Wait Task 暂停和恢复后上下文不丢失。
7. 发布检查能识别变量不存在、环路、断线和必填缺失。
8. 草稿保存不会改变 `published_version_id`。
9. 发布草稿会生成新的不可变版本并切换线上指针。
10. 外部 Runtime 调用只读取已发布版本，草稿试运行只走草稿入口。

### 12.3 手工验收场景

1. 新建 Workflow，只用 `+` 从开始节点一路创建到结束节点。
2. 创建“开始 -> 知识检索 -> 大模型 -> 人工确认 -> 结束”。
3. 在大模型 Prompt 中通过变量选择器插入知识检索输出。
4. 插入一个变量赋值节点，把大模型输出写入 `vars.answerText`。
5. 删除知识检索节点后，变量引用校验立刻报错。
6. 发布检查阻断错误流程。
7. 发布后使用 Runtime Key 调用并查看 Trace。
8. 修改草稿但不发布，再用 Runtime Key 调用，确认线上结果仍来自已发布版本。
9. 点击草稿试运行，确认使用当前画布配置并标记为设计期运行。

## 13. 风险与规避

| 风险 | 影响 | 规避 |
| --- | --- | --- |
| 一次性改动过大 | 影响现有发布和体验功能 | 新目录并行开发，稳定后切换现有入口。 |
| 新 DSL 与 Runtime 实现不一致 | 设计可发布但运行失败 | DSL、NodeSpec、发布校验和 Runtime 同步开发，并增加端到端回归测试。 |
| 变量模型过复杂 | 开发周期拉长 | 先做命名空间和变量选择器第一版，类型推断逐步增强。 |
| NodeSpec 前后端不一致 | 表单可保存但后端不能运行 | 每个节点新增/修改都同步更新 NodeSpec 和后端校验。 |
| 草稿误影响线上 | 未发布修改被外部调用使用 | Runtime 只读取 `published_version_id`；草稿试运行走独立入口并增加测试。 |
| 节点扩展方式失控 | 新节点需要复制大量组件代码 | 使用 `WorkflowNodePlugin`、NodeSpec、通用配置渲染器和自定义插槽，禁止为每类节点复制整套 Inspector。 |
| Xyflow 样式冲突 | UI 不统一 | 统一封装节点、边、Controls 样式，避免直接使用默认视觉。 |
| 条件分支语义不清 | 运行路径和 UI 分支不一致 | 第一版明确：边条件决定运行，命名端口主要用于可视化。 |

## 14. 建议开发顺序

推荐顺序：

1. 依赖和目录隔离。
2. 草稿表、草稿 API 和线上版本读取边界。
3. Xyflow 画布替换。
4. 中文节点卡片和节点库。
5. 连线和 `+` 新增/插入。
6. 新 DSL 序列化与恢复。
7. NodeSpec、节点插件和属性面板结构化。
8. 变量选择器。
9. 发布检查增强。
10. Runtime。
11. Trace 回显和最终体验打磨。

不建议先做复杂变量或后端 Runtime，再换画布。画布底层会影响节点 ID、边 ID、坐标、端口和 DSL 结构，应优先稳定。

## 15. 里程碑

| 里程碑 | 目标 | 交付物 |
| --- | --- | --- |
| M1 | 草稿和 Xyflow 基础画布可用 | 可打开默认 Workflow，支持拖拽、缩放、平移、保存位置，并自动保存草稿。 |
| M2 | 编排交互完整 | 节点库、拖线、节点出口 `+`、边中点 `+` 可用。 |
| M3 | 新 DSL、节点插件和属性面板 | 结构化表单、节点类型差异配置、草稿保存恢复可用。 |
| M4 | 变量图形化 | 流程变量、变量树、变量插入、引用校验可用。 |
| M5 | Runtime 和发布闭环 | Runtime、草稿试运行、发布检查、线上版本切换、Trace 回显可用。 |

## 16. 最小可交付版本定义

最小可交付版本必须满足：

1. 使用 `@xyflow/react` 作为唯一画布底层。
2. 新建和恢复 Workflow 都使用 Xyflow 展示。
3. 画布可左右/上下平移和缩放。
4. 节点全部中文展示。
5. 支持 `+` 新增和插入节点。
6. 支持基础变量选择器。
7. 支持所有节点的输入/输出区域。
8. 发布检查能阻断明显错误。
9. 草稿保存不会影响线上 Runtime，发布后才切换线上版本。
10. 不同节点类型通过 NodeSpec/插件加载不同配置，新增节点不需要复制整套设计器。
11. 新建 Workflow 的设计、保存、发布、试运行和 Trace 链路闭环。
12. 前端构建和后端测试通过。
