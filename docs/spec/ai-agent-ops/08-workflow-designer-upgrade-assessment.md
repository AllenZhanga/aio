# Workflow 设计器现状评估与改造方案

日期：2026-04-30

> 决策更新：Workflow 设计器底层已决定直接采用 `@xyflow/react` 重构。完整实施规划见 [09-workflow-designer-xyflow-development-plan.md](./09-workflow-designer-xyflow-development-plan.md)。本文保留为现状评估和需求依据。

## 1. 结论摘要

当前 Workflow 设计器是一个自研轻量 React 组件，不是 React Flow、X6、LogicFlow 这类专业流程画布库。它使用普通 DOM 节点、SVG 路径、CSS 绝对定位和 Pointer 事件实现节点拖拽与连线。

当前实现适合 MVP 演示，但距离可长期演进的流程引擎设计器还有明显差距。要满足成熟流程编排必备能力，至少需要补齐以下方向：

1. 节点 UI 全中文化，英文类型只保留在 DSL 和内部字段，不直接展示给最终用户。
2. 画布支持横向/纵向滚动、平移、缩放、小地图和更大工作区。
3. 连线交互支持“拖线连接”和“点击 + 插入/新增节点”两种方式。
4. 建立统一变量模型，支持流程级变量、节点输出变量、系统变量、环境变量和图形化变量选择器。
5. 每类节点有独立属性表单，但所有节点都具备统一的输入映射、输出定义和运行状态区域。
6. 前后端共享节点规格，发布前做 DAG、端口、必填配置、变量引用、Schema 和权限校验。

建议分两步推进：短期可以在当前自研组件上补齐中文名称、基础滚动、+ 新增节点和变量选择器；中长期建议迁移到 `@xyflow/react`（React Flow）或同等级专业画布库，降低平移缩放、边插入、选择框、小地图、键盘快捷键和复杂端口维护成本。

## 2. 当前使用的组件与实现方式

### 2.1 前端实现

当前 Workflow 设计器主要由以下文件组成：

| 文件 | 作用 |
| --- | --- |
| `apps/web/src/components/WorkflowDesigner.tsx` | 渲染节点库、画布、SVG 连线、节点卡片、右侧属性面板和 Workflow JSON 预览。 |
| `apps/web/src/components/useWorkflowDesignerPage.ts` | 管理节点、连线、选中状态、拖拽状态、连线状态、增删改节点和连线。 |
| `apps/web/src/types.ts` | 定义 `WorkflowNodeType`、`WorkflowNode`、`WorkflowEdge`、`WorkflowDesignerProps` 等类型。 |
| `apps/web/src/appDefinitions.ts` | 将前端节点和连线转换为发布用的 `definition_json`。 |
| `apps/web/src/app-center.css` | 定义 `.workflowCanvas`、`.workflowNode`、`.edgeLayer`、`.port` 等画布样式。 |

关键实现方式：

1. 节点是绝对定位的 HTML 元素，位置来自 `node.x`、`node.y`。
2. 连线是 SVG `<path>`，通过贝塞尔曲线连接节点右端口和左端口。
3. 拖拽通过 `onPointerDown`、`onPointerMove`、`onPointerUp` 自行处理。
4. 节点类型和配置项写死在前端 `nodeMeta`、`defaultNodeConfig`、`nodeConfigKeys` 中。
5. 右侧属性面板主要是通用 `textarea`，没有按节点类型结构化渲染。

### 2.2 不是第三方流程画布

当前依赖中只有 `react`、`react-dom`、`lucide-react` 等基础库，没有引入：

1. `@xyflow/react` / React Flow。
2. AntV X6。
3. LogicFlow。
4. JointJS。
5. BPMN.js。

所以“画板不能左右滑动”不是第三方组件不支持，而是当前自研画布没有实现滚动、平移和缩放能力，并且 CSS 使用了 `overflow: hidden`，拖拽逻辑也把节点坐标限制在固定范围内。

## 3. 现状差距

| 需求 | 当前状态 | 差距判断 |
| --- | --- | --- |
| 节点只显示中文名称 | 节点主标题可中文，但节点库仍显示英文 `Start`、`LLM`、`Agent`，节点卡片还显示 `node.id` | 需要 UI 全中文化，英文定义隐藏到高级/调试区域。 |
| 画布左右滑动 | 不支持，画布 `overflow: hidden`，坐标按容器计算且有硬边界 | 需要实现 viewport/world 坐标、滚动/平移/缩放。 |
| 连线 + 新增节点 | 支持端口拖线连已有节点，不支持边上或节点出口的 `+` 快捷新增 | 需要新增 edge insertion 和 source quick add 交互。 |
| 变量传递与流程级变量 | 后端有 `inputs`、`metadata`、节点 id 输出上下文；前端没有变量面板 | 需要统一变量命名空间、Schema、变量选择器和引用校验。 |
| 每个节点不同属性 | 当前按类型列出少量 key，且大多是 `textarea` | 需要 NodeSpec + JSON Schema 驱动的结构化属性表单。 |
| 所有节点输入输出区域 | 节点卡片和属性面板没有统一输入/输出模型 | 需要每个节点都有输入映射、输出定义、端口和变量暴露。 |
| 流程发布检查 | 已有基础发布检查入口，但 Workflow 设计期校验不足 | 需要变量、端口、DAG、节点配置、依赖权限等完整校验。 |

## 4. 节点中文化改造

### 4.1 显示原则

1. 画布节点只显示中文名称，例如“开始”“大模型”“智能体”“知识检索”“人工确认”“结束”。
2. 节点库也只显示中文名称和中文说明。
3. 节点英文类型如 `llm`、`knowledge_retrieval` 只保留在 DSL、调试 JSON、高级信息或开发者视图中。
4. 节点 id 默认不在卡片上展示；可在右侧属性面板“高级”区域展示并允许复制。
5. 用户可以编辑节点展示名，但不能直接改内部 type。

### 4.2 节点名称建议

| 内部类型 | 中文显示名 | 分类 |
| --- | --- | --- |
| `start` | 开始 | 基础 |
| `end` | 结束 | 基础 |
| `variable` | 变量赋值 | 基础 |
| `llm` | 大模型 | AI |
| `agent` | 智能体 | AI |
| `knowledge_retrieval` | 知识检索 | 知识 |
| `tool` | 工具调用 | 工具 |
| `http_request` | HTTP 请求 | 工具 |
| `condition` | 条件分支 | 控制 |
| `code` | 代码执行 | 控制 |
| `user_confirm` | 人工确认 | 人工 |
| `user_form` | 人工表单 | 人工 |

### 4.3 代码改造点

1. 将 `nodeMeta.name` 从英文改为中文。
2. 增加 `nodeMeta.typeLabel` 或 `nodeMeta.internalType` 只用于开发视图。
3. 节点卡片移除 `node.id` 展示，改为展示输入/输出摘要。
4. 属性面板增加“高级信息”折叠区，展示节点 ID、内部类型、原始 JSON。

## 5. 画布滚动、平移和缩放改造

### 5.1 当前不能左右滑动的原因

1. `.workflowCanvas` 使用 `overflow: hidden`，内容超出后被裁剪。
2. 节点坐标直接相对于可视容器计算，没有区分 viewport 和 world 坐标。
3. 拖拽时 x 坐标被限制在约 18 到 1260 的范围内，y 坐标被限制在约 18 到 720 的范围内。
4. SVG 连线层宽高是 `100%`，只覆盖可视容器，不覆盖更大的画布世界。
5. 没有平移状态、缩放比例、滚动条、小地图、自动扩展画布等概念。

### 5.2 自研组件短期方案

如果继续沿用当前自研组件，至少要改造成两层结构：

```text
workflowViewport：负责滚动、平移、缩放、裁剪
└─ workflowWorld：固定或动态尺寸的大画布，例如 3200 x 2000
   ├─ edgeLayer：SVG 连线层，尺寸跟随 world
   └─ nodeLayer：节点层，使用 world 坐标定位
```

必改内容：

1. 外层 `workflowViewport` 改为 `overflow: auto`，允许水平和垂直滚动。
2. 内层 `workflowWorld` 设置足够大的宽高，后续可根据节点边界动态扩展。
3. 指针坐标转换时加入 `scrollLeft`、`scrollTop` 和 `zoom`。
4. 移除固定坐标边界，改为按 world 尺寸或自动扩展约束。
5. SVG 连线层使用 world 尺寸，不再只覆盖可视容器。
6. 增加画布空白拖拽平移、鼠标滚轮缩放、工具栏缩放比例和重置视图。

### 5.3 中长期推荐方案

成熟流程设计器建议迁移到 `@xyflow/react`。它天然提供：

1. 平移、缩放、滚轮、触控板交互。
2. 节点、边、Handle、Marker、Edge Label。
3. MiniMap、Controls、Background。
4. 选择、框选、删除、键盘快捷键。
5. 边上插入按钮、连接校验、节点拖放。
6. 大画布性能和视口坐标转换。

迁移成本主要是把当前 `WorkflowNode`、`WorkflowEdge` 转换成 React Flow 的 `Node`、`Edge`，并自定义节点卡片、边组件和属性面板。后端 DSL 不需要因为画布库变化而大改。

## 6. 连线与 + 新增节点改造

### 6.1 目标交互

需要同时支持两种创建流程方式：

1. 拖线连接：从一个节点输出端口拖到另一个节点输入端口，生成连线。
2. `+` 快捷新增：不手动画线，点击节点出口或连线中点的 `+`，选择节点类型后自动创建节点并补齐连线。

### 6.2 节点出口 + 新增

交互规则：

1. 当节点被选中或鼠标悬停时，在输出端口旁展示 `+`。
2. 点击 `+` 打开节点选择浮层，按“AI / 知识 / 工具 / 控制 / 人工 / 输出”分类展示。
3. 选择节点类型后，在当前节点右侧创建新节点。
4. 自动创建 `当前节点 -> 新节点` 的连线。
5. 如果当前节点已有默认后继，可提示“插入到现有连线中”或“新增分支”。

### 6.3 连线中点 + 插入

交互规则：

1. 连线 hover 时在中点展示 `+`。
2. 点击 `+` 选择节点类型。
3. 创建新节点 `N` 后，将原连线 `A -> B` 替换成 `A -> N` 和 `N -> B`。
4. 原连线条件默认挂到 `A -> N`，也可以按节点类型提示用户确认。
5. 插入节点后自动选中新节点并打开属性面板。

### 6.4 拖线到空白处新增

交互规则：

1. 从节点输出端口拖线到画布空白处释放。
2. 在释放位置打开节点选择浮层。
3. 选择节点类型后在释放位置创建节点，并自动连线。
4. 用户取消时不创建连线。

## 7. 变量传递和图形化引用

### 7.1 当前后端变量现状

当前后端 Workflow 运行上下文大致是：

```text
context.inputs      请求输入
context.metadata    请求元数据
context.<nodeId>    每个已执行节点的输出
```

示例：

```text
{{inputs.question}}
{{answer.text}}
{{confirm.action}}
```

这可以运行简单流程，但存在几个问题：

1. 没有流程级变量命名空间，变量节点输出只能挂在节点 id 下。
2. 节点输出缺少 Schema，前端无法知道后续节点可引用哪些字段。
3. 前端没有变量树、自动补全、引用插入和引用校验。
4. 节点 id 一旦变化，引用表达式会失效。
5. 无法区分用户输入、流程变量、节点输出、系统变量、环境变量。

### 7.2 目标变量模型

建议升级为统一命名空间：

```text
inputs.xxx          流程输入变量
vars.xxx            流程级变量，可由变量节点或节点输出映射写入
nodes.nodeId.xxx    节点输出变量
sys.xxx             系统变量，例如 runId、appId、tenantId、workspaceId、userId
env.xxx             环境变量或密钥引用，只允许受控展示和使用
metadata.xxx        调用元数据
```

推荐引用语法：

```text
{{inputs.question}}
{{vars.customerId}}
{{nodes.retrieve.chunks}}
{{nodes.answer.text}}
{{sys.runId}}
{{env.API_BASE_URL}}
```

变量语法规则：

1. 新设计器统一生成 `{{nodes.answer.text}}` 这类命名空间语法。
2. 节点输出必须通过 `nodes.nodeId.field` 引用。
3. 发布检查发现未定义命名空间、节点或字段时直接阻断。

### 7.3 流程级变量存储

`definition_json` 需要增加流程变量声明：

```json
{
  "variables": [
    { "name": "customerId", "type": "string", "default": "", "description": "客户 ID" },
    { "name": "priority", "type": "string", "default": "normal", "description": "优先级" }
  ]
}
```

运行时初始化：

1. `vars` 由 `definition.variables` 的默认值初始化。
2. Start 节点把请求输入写入 `inputs`。
3. Variable 节点或任意节点的输出映射可以写入 `vars`。
4. 等待任务暂停时必须持久化完整 `context`，恢复时继续使用同一份 `vars`。
5. Run 输出可以选择 `end.outputs` 或完整上下文摘要。

### 7.4 节点输入映射

每个节点都应有统一输入区域，支持三种输入方式：

| 输入方式 | 说明 |
| --- | --- |
| 固定值 | 用户直接输入字符串、数字、布尔值或 JSON。 |
| 引用变量 | 从变量树选择，例如 `{{inputs.question}}`。 |
| 表达式 | 使用条件或模板表达式，例如 `{{vars.level == 'high'}}`。 |

节点 DSL 建议增加 `inputs` 字段：

```json
{
  "id": "answer",
  "type": "llm",
  "inputs": {
    "prompt": "{{inputs.question}}",
    "context": "{{nodes.retrieve.chunks}}"
  },
  "config": {
    "providerAccountId": "provider_xxx",
    "chatModel": "qwen-plus"
  }
}
```

### 7.5 节点输出定义

每个节点都应声明输出 Schema，供后续节点引用：

| 节点 | 默认输出 |
| --- | --- |
| 开始 | `inputs` |
| 大模型 | `text`、`usage`、`raw` |
| 知识检索 | `chunks[]`、`query` |
| 工具调用 | `status`、`body`、`headers`、`latencyMs` |
| 条件分支 | `matched` |
| 人工确认 | `action`、`submittedBy`、`comment` |
| 人工表单 | `values`、`submittedBy` |
| 变量赋值 | 用户定义的变量键值 |
| 结束 | `outputs` |

同时支持输出映射：

```json
{
  "outputs": {
    "answerText": "{{nodes.answer.text}}",
    "customerId": "{{vars.customerId}}"
  }
}
```

### 7.6 图形化变量选择器

右侧属性面板和所有文本/表达式输入框都应支持变量插入：

1. 输入框右侧增加“插入变量”按钮。
2. 点击后打开变量选择器，按分类展示：流程输入、流程变量、上游节点输出、系统变量、环境变量。
3. 变量树只展示当前节点可见的上游变量，避免引用下游节点。
4. 选择变量后自动插入 `{{...}}`。
5. Hover 变量显示类型、说明、来源节点、示例值。
6. 发布检查校验所有引用是否存在、类型是否匹配。
7. 对密钥类 `env` 变量只显示名称，不展示真实值。

## 8. 节点属性、输入输出和 NodeSpec

### 8.1 为什么需要 NodeSpec

当前节点属性散落在前端函数中，后端也有自己的执行逻辑。随着节点变多，会出现以下问题：

1. 前端显示字段和后端实际需要字段不一致。
2. 节点输出字段无法被变量选择器感知。
3. 发布检查无法通用化。
4. 新增节点要同时改多个地方，容易遗漏。

建议建立统一 NodeSpec 注册表，前后端共享或由后端输出给前端。

### 8.2 NodeSpec 建议结构

```json
{
  "type": "llm",
  "displayName": "大模型",
  "category": "AI",
  "description": "调用大语言模型生成文本",
  "inputsSchema": {
    "type": "object",
    "properties": {
      "prompt": { "type": "string", "title": "提示词" },
      "context": { "type": "string", "title": "上下文" }
    },
    "required": ["prompt"]
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "providerAccountId": { "type": "string", "title": "模型供应商" },
      "chatModel": { "type": "string", "title": "模型" },
      "temperature": { "type": "number", "title": "温度" }
    }
  },
  "outputsSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "title": "生成文本" },
      "usage": { "type": "object", "title": "Token 用量" }
    }
  }
}
```

### 8.3 属性面板统一结构

每个节点右侧属性面板建议分为：

1. 基础：节点名称、说明、启用状态。
2. 输入：输入映射、变量引用、固定值和表达式。
3. 配置：该节点类型独有的属性，例如模型、知识库、HTTP 方法。
4. 输出：默认输出字段、用户自定义输出映射、写入流程变量。
5. 调试：单节点测试、最近输入输出、错误信息。
6. 高级：节点 ID、内部类型、超时、重试、缓存、原始 JSON。

### 8.4 节点卡片统一展示

节点卡片不应展示英文定义和内部 ID，建议展示：

1. 中文节点名。
2. 节点类型中文短标签。
3. 输入摘要，例如“输入 2”。
4. 输出摘要，例如“输出 text”。
5. 运行状态，例如等待、运行中、成功、失败。
6. 左侧输入端口、右侧输出端口；条件节点可有多个命名输出端口。

## 9. 后端流程引擎改造

### 9.1 DSL 升级

建议直接升级为新的目标 DSL：

```json
{
  "type": "workflow",
  "version": 1,
  "inputs": [],
  "variables": [],
  "nodes": [
    {
      "id": "answer",
      "type": "llm",
      "label": "大模型",
      "inputs": {},
      "config": {},
      "outputs": {}
    }
  ],
  "edges": [],
  "ui": {
    "nodes": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

### 9.2 执行上下文

运行时上下文建议改为：

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

执行流程：

1. Start 初始化 `inputs`、`vars`、`sys`、`metadata`。
2. 每个节点先解析 `node.inputs`，形成实际入参。
3. 节点执行后将结果写入 `nodes[nodeId]`。
4. 如节点配置了输出映射或变量写入，则更新 `vars`。
5. End 节点根据输出映射生成最终响应。
6. 等待任务暂停时持久化完整上下文，提交后继续执行。

### 9.3 发布检查服务

需要新增或强化 Workflow 发布检查：

1. Start 唯一，End 至少一个可达。
2. 所有启用节点从 Start 可达。
3. 无非法环路；第一版保持 DAG。
4. 连线只允许输出端口连输入端口。
5. 条件分支必须有明确条件和兜底分支。
6. 节点必填配置完整。
7. 所有变量引用存在，且只引用可见上游变量。
8. 输入输出 Schema 合法，变量类型匹配。
9. Provider、知识库、工具、API Key、环境变量权限可用。
10. 人工确认/表单有恢复策略和超时策略。

## 10. 分阶段实施计划

### P0：快速修正当前体验

目标：低风险改造，让当前设计器更接近可用。

1. 节点库、节点卡片、属性面板全部中文化。
2. 节点卡片隐藏内部 ID 和英文类型。
3. 画布改为可水平/垂直滚动的大工作区。
4. 移除固定坐标上限，节点可拖到更远区域。
5. 增加节点出口 `+` 新增节点并自动连线。
6. 增加连线中点 `+` 插入节点。
7. 属性面板加入基础“变量参考”列表，先展示 `inputs` 和已存在节点输出。

### P1：变量和输入输出体系

目标：让变量传递变成可视化、可校验能力。

1. DSL 增加 `variables`、`node.inputs`、`node.outputs`。
2. 后端上下文增加 `vars`、`nodes`、`sys` 命名空间。
3. 前端增加流程变量管理面板。
4. 输入框增加变量选择器和变量插入按钮。
5. 每个节点属性面板统一增加“输入”和“输出”区域。
6. 发布检查校验变量引用存在性。
7. 统一变量引用语法，并在发布检查中阻断无效引用。

### P2：节点规格和结构化属性

目标：把节点从散落代码升级为规格驱动。

1. 建立 NodeSpec 注册表。
2. 使用 Schema 渲染不同节点的配置表单。
3. 建立节点输出 Schema，驱动变量选择器。
4. 增加节点级单步调试和样例输入输出。
5. 后端发布检查基于 NodeSpec 校验必填项和依赖。

### P3：专业画布迁移

目标：降低复杂画布长期维护成本。

1. 引入 `@xyflow/react`。
2. 保留现有 DSL，仅替换画布实现层。
3. 自定义中文节点组件、边组件、边上 `+` 插入组件。
4. 使用内置 Background、Controls、MiniMap、Selection。
5. 保存和恢复 viewport、节点位置、节点折叠状态。
6. 支持框选、复制粘贴、撤销重做、快捷键。

## 11. 推荐优先级

如果目标是快速满足当前反馈，优先做 P0 + P1 的一部分：

1. 中文化节点显示。
2. 画布可滚动。
3. `+` 新增/插入节点。
4. 变量选择器第一版。
5. 节点输入/输出区域第一版。

如果目标是把 Workflow 做成平台核心能力，建议直接规划 P1 + P2，并尽早启动 P3 画布迁移。流程设计器越往后做，画布交互、变量引用、节点配置、校验和运行观测会越耦合，早期建立统一 DSL 和 NodeSpec 可以避免后续大规模返工。
