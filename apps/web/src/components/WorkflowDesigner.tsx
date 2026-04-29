import { MousePointer2, PanelRight, Plus, X } from "lucide-react";
import type { AgentMode, WorkflowDesignerProps, WorkflowEdge, WorkflowNode, WorkflowNodeType } from "../types";
import { Field } from "./ui";

export const nodeMeta: Record<WorkflowNodeType, { name: string; description: string; accent: string }> = {
  start: { name: "Start", description: "流程入口", accent: "green" },
  llm: { name: "LLM", description: "模型推理", accent: "blue" },
  agent: { name: "Agent", description: "智能体调用", accent: "blue" },
  tool: { name: "Tool", description: "工具调用", accent: "amber" },
  http_request: { name: "HTTP", description: "HTTP 请求", accent: "amber" },
  knowledge_retrieval: { name: "Knowledge", description: "知识检索", accent: "green" },
  user_confirm: { name: "Confirm", description: "人工确认", accent: "red" },
  user_form: { name: "Form", description: "人工表单", accent: "red" },
  condition: { name: "Branch", description: "条件分支", accent: "violet" },
  variable: { name: "Variable", description: "变量赋值", accent: "slate" },
  code: { name: "Code", description: "代码节点", accent: "violet" },
  end: { name: "End", description: "流程结束", accent: "slate" },
};

export const defaultNodes: WorkflowNode[] = [
  { id: "start", type: "start", label: "开始", x: 72, y: 180, config: {} },
  { id: "answer", type: "llm", label: "生成回复", x: 360, y: 130, config: { prompt: "请基于输入给出处理建议：{{inputs.question}}" } },
  {
    id: "confirm",
    type: "user_confirm",
    label: "人工确认",
    x: 650,
    y: 180,
    config: {
      title: "确认处理方案",
      description: "{{answer.text}}",
      actions: [
        { key: "approve", label: "确认" },
        { key: "reject", label: "拒绝" },
      ],
      expiresInSeconds: 86400,
    },
  },
  { id: "end", type: "end", label: "结束", x: 940, y: 180, config: { output: "{{answer.text}}" } },
];

export const defaultEdges: WorkflowEdge[] = [
  { id: "edge_start_answer", from: "start", to: "answer" },
  { id: "edge_answer_confirm", from: "answer", to: "confirm" },
  { id: "edge_confirm_end", from: "confirm", to: "end", condition: "{{confirm.action == 'approve'}}" },
];

const nodeSize = { width: 218, height: 92 };

export function WorkflowDesigner(props: WorkflowDesignerProps) {
  return (
    <div className="workflowLayout">
      <aside className="nodePalette designCard">
        <h3>节点</h3>
        {(Object.keys(nodeMeta) as WorkflowNodeType[]).map((type) => (
          <button className="paletteItem" key={type} onClick={() => props.addNode(type)}>
            <span className={`dot ${nodeMeta[type].accent}`} />
            <strong>{nodeMeta[type].name}</strong>
            <small>{nodeMeta[type].description}</small>
            <Plus size={14} />
          </button>
        ))}
        <p className="gestureTip"><MousePointer2 size={15} /> 拖动节点移动，从右侧端口拖到另一节点左侧端口连线。</p>
      </aside>
      <div className="workflowCanvas" ref={props.canvasRef} onPointerMove={props.moveOnCanvas} onPointerUp={props.stopCanvasInteraction} onPointerLeave={props.stopCanvasInteraction}>
        <svg className="edgeLayer" width="100%" height="100%">
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#2563eb" />
            </marker>
          </defs>
          {props.edges.map((edge) => {
            const from = props.nodes.find((node) => node.id === edge.from);
            const to = props.nodes.find((node) => node.id === edge.to);
            if (!from || !to) return null;
            return (
              <path
                key={edge.id}
                className="edgePath"
                d={edgePath(from.x + nodeSize.width, from.y + nodeSize.height / 2, to.x, to.y + nodeSize.height / 2)}
                markerEnd="url(#arrow)"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  props.selectEdge(edge.id);
                }}
              />
            );
          })}
          {props.connecting && <path className="edgePath draft" d={edgePath(nodeOutX(props.nodes, props.connecting.from), nodeOutY(props.nodes, props.connecting.from), props.connecting.x, props.connecting.y)} />}
        </svg>
        {props.nodes.map((node) => (
          <article className={`workflowNode ${node.type} ${props.selectedNode?.id === node.id ? "selected" : ""}`} style={{ transform: `translate(${node.x}px, ${node.y}px)` }} key={node.id} onPointerDown={(event) => props.startDrag(event, node)}>
            <button className="port in" aria-label="连接入口" onPointerUp={(event) => props.finishConnect(event, node.id)} />
            <div className="nodeHead" onPointerDown={() => props.selectNode(node.id)}>
              <span className={`dot ${nodeMeta[node.type].accent}`} />
              <strong>{node.label}</strong>
            </div>
            <p>{nodeMeta[node.type].description}</p>
            <small>{node.id}</small>
            <button className="port out" aria-label="连接出口" onPointerDown={(event) => props.startConnect(event, node)} />
          </article>
        ))}
      </div>
      <aside className="inspector designCard">
        <div className="sectionTitle"><PanelRight size={18} /><h3>属性</h3></div>
        {props.selectedNode && (
          <div className="inspectorStack">
            <Field label="节点名称">
              <input value={props.selectedNode.label} onChange={(event) => props.updateNode(props.selectedNode!.id, { label: event.target.value })} />
            </Field>
            <Field label="节点 ID"><input value={props.selectedNode.id} readOnly /></Field>
            {nodeConfigKeys(props.selectedNode.type).map((key) => (
              <Field key={key} label={key}>
                <textarea value={configValueToString(props.selectedNode?.config[key])} onChange={(event) => props.updateNodeConfig(props.selectedNode!.id, key, event.target.value)} />
              </Field>
            ))}
            <button className="dangerBtn" disabled={props.selectedNode.id === "start" || props.selectedNode.id === "end"} onClick={() => props.removeNode(props.selectedNode!.id)}>
              <X size={16} /> 删除节点
            </button>
          </div>
        )}
        {props.selectedEdge && (
          <div className="inspectorStack">
            <Field label="连线"><input value={`${props.selectedEdge.from} → ${props.selectedEdge.to}`} readOnly /></Field>
            <Field label="条件表达式">
              <textarea value={props.selectedEdge.condition || ""} onChange={(event) => props.updateEdge(props.selectedEdge!.id, event.target.value)} placeholder="{{confirm.action == 'approve'}}" />
            </Field>
            <button className="dangerBtn" onClick={() => props.removeEdge(props.selectedEdge!.id)}><X size={16} /> 删除连线</button>
          </div>
        )}
        {!props.selectedNode && !props.selectedEdge && <p className="mutedText">选择节点或连线后编辑属性。</p>}
        <div className="definitionPreview">
          <h3>Workflow JSON</h3>
          <pre>{JSON.stringify(props.workflowDefinition, null, 2)}</pre>
        </div>
      </aside>
    </div>
  );
}

export function restoreWorkflowDefinition(definition: Record<string, any>): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const uiNodes = Array.isArray(definition.ui?.nodes) ? definition.ui.nodes : [];
  const nodes = Array.isArray(definition.nodes) && definition.nodes.length
    ? definition.nodes.map((item: Record<string, any>, index: number) => {
        const type = normalizeNodeType(item.type);
        const ui = uiNodes.find((candidate: Record<string, any>) => candidate.id === item.id) || {};
        return {
          id: String(item.id || `${type}_${index}`),
          type,
          label: String(ui.label || nodeMeta[type].name),
          x: Number(ui.x ?? 72 + index * 260),
          y: Number(ui.y ?? 160 + (index % 2) * 100),
          config: typeof item.config === "object" && item.config ? item.config : {},
        } as WorkflowNode;
      })
    : defaultNodes.map((item) => ({ ...item, config: { ...item.config } }));
  const edges = Array.isArray(definition.edges)
    ? definition.edges.map((item: Record<string, any>, index: number) => ({
        id: `edge_${String(item.from)}_${String(item.to)}_${index}`,
        from: String(item.from),
        to: String(item.to),
        condition: item.condition ? String(item.condition) : undefined,
      }))
    : defaultEdges.map((item) => ({ ...item }));
  return { nodes, edges };
}

export function parseConfigValue(key: string, value: string): unknown {
  const trimmed = value.trim();
  if (["topK", "scoreThreshold", "expiresInSeconds"].includes(key) && trimmed !== "") {
    const numeric = Number(trimmed);
    return Number.isNaN(numeric) ? value : numeric;
  }
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function normalizeAgentMode(mode: unknown): AgentMode {
  return mode === "agent" ? "agent" : "agent";
}

export function defaultNodeConfig(type: WorkflowNodeType): Record<string, unknown> {
  if (type === "llm") return { prompt: "请根据上下文处理：{{inputs.question}}" };
  if (type === "agent") return { query: "{{inputs.question}}" };
  if (type === "tool") return { toolId: "", input: "{{inputs}}" };
  if (type === "http_request") return { url: "https://example.com/webhook", method: "POST", body: "{{inputs}}" };
  if (type === "knowledge_retrieval") return { datasetId: "", query: "{{inputs.question}}", topK: 5, scoreThreshold: 0 };
  if (type === "user_confirm") return { title: "等待人工确认", description: "{{answer.text}}", actions: [{ key: "approve", label: "确认" }, { key: "reject", label: "拒绝" }] };
  if (type === "user_form") return { title: "补充信息", description: "{{answer.text}}", formSchema: { type: "object", properties: { comment: { type: "string", title: "备注" } } } };
  if (type === "condition") return { expression: "{{confirm.action == 'approve'}}" };
  if (type === "variable") return { result: "{{inputs.question}}" };
  if (type === "code") return { language: "javascript", code: "return inputs;" };
  if (type === "end") return { output: "{{answer.text}}" };
  return {};
}

function configValueToString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function normalizeNodeType(type: unknown): WorkflowNodeType {
  return type === "start" || type === "llm" || type === "agent" || type === "tool" || type === "http_request" || type === "knowledge_retrieval" || type === "user_confirm" || type === "user_form" || type === "condition" || type === "variable" || type === "code" || type === "end" ? type : "llm";
}

function nodeConfigKeys(type: WorkflowNodeType) {
  if (type === "llm") return ["prompt"];
  if (type === "agent") return ["query"];
  if (type === "tool") return ["toolId", "input"];
  if (type === "http_request") return ["url", "method", "body"];
  if (type === "knowledge_retrieval") return ["datasetId", "query", "topK", "scoreThreshold"];
  if (type === "user_confirm") return ["title", "description"];
  if (type === "user_form") return ["title", "description", "formSchema"];
  if (type === "condition") return ["expression"];
  if (type === "variable") return ["result"];
  if (type === "code") return ["language", "code"];
  if (type === "end") return ["output"];
  return [];
}

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const distance = Math.max(70, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`;
}

function nodeOutX(nodes: WorkflowNode[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  return (node?.x || 0) + nodeSize.width;
}

function nodeOutY(nodes: WorkflowNode[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  return (node?.y || 0) + nodeSize.height / 2;
}
