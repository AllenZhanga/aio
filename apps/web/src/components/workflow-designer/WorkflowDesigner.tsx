import "@xyflow/react/dist/style.css";
import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  Background,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { MousePointer2, PanelRight, Plus, X } from "lucide-react";
import type { AgentMode, WorkflowDesignerProps, WorkflowEdge as AppWorkflowEdge, WorkflowNode, WorkflowNodeType } from "../../types";
import { Field } from "../ui";
import { NodeAddMenu, type NodeAddMenuState } from "./NodeAddMenu";
import { NodeConfigFields } from "./NodeConfigFields";
import { WorkflowEdge, type WorkflowEdgeData } from "./WorkflowEdge";
import { WorkflowNodeCard, type WorkflowNodeData } from "./WorkflowNodeCard";
import { createWorkflowNode, nodePlugin } from "./nodeRegistry";
import { nodeCategoryLabels, nodeSpec, nodeSpecs } from "./nodeSpecs";

export const nodeMeta: Record<WorkflowNodeType, { name: string; description: string; accent: string }> = Object.fromEntries(
  (Object.keys(nodeSpecs) as WorkflowNodeType[]).map((type) => {
    const spec = nodeSpec(type);
    return [type, { name: spec.displayName, description: spec.description, accent: spec.accent }];
  }),
) as Record<WorkflowNodeType, { name: string; description: string; accent: string }>;

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
      description: "{{nodes.answer.text}}",
      actions: [
        { key: "approve", label: "确认" },
        { key: "reject", label: "拒绝" },
      ],
      expiresInSeconds: 86400,
    },
  },
  { id: "end", type: "end", label: "结束", x: 940, y: 180, config: { output: "{{nodes.answer.text}}" } },
];

export const defaultEdges: AppWorkflowEdge[] = [
  { id: "edge_start_answer", from: "start", to: "answer" },
  { id: "edge_answer_confirm", from: "answer", to: "confirm" },
  { id: "edge_confirm_end", from: "confirm", to: "end", condition: "{{nodes.confirm.action == 'approve'}}" },
];

const nodeTypes = { workflowNode: WorkflowNodeCard };
const edgeTypes = { workflowEdge: WorkflowEdge };
const categoryOrder = ["basic", "ai", "knowledge", "tool", "control", "human", "output"] as const;

export function WorkflowDesigner(props: WorkflowDesignerProps) {
  return (
    <ReactFlowProvider>
      <WorkflowDesignerContent {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowDesignerContent(props: WorkflowDesignerProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [addMenu, setAddMenu] = useState<NodeAddMenuState | null>(null);

  const flowNodes = useMemo<Node<WorkflowNodeData>[]>(
    () => props.nodes.map((node) => ({
      id: node.id,
      type: "workflowNode",
      position: { x: node.x, y: node.y },
      data: {
        nodeId: node.id,
        type: node.type,
        label: node.label,
        selected: props.selectedNode?.id === node.id,
        onAddAfter: (nodeId, clientX, clientY) => openAddMenu({ sourceId: nodeId, clientX, clientY }),
      },
    })),
    [props.nodes, props.selectedNode?.id],
  );

  const flowEdges = useMemo<Edge<WorkflowEdgeData>[]>(
    () => props.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      sourceHandle: "main",
      targetHandle: "input",
      type: "workflowEdge",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" },
      data: {
        condition: edge.condition,
        onInsert: (edgeId, clientX, clientY) => openAddMenu({ edgeId, clientX, clientY }),
      },
    })),
    [props.edges],
  );

  function openAddMenu({ sourceId, edgeId, clientX, clientY }: { sourceId?: string; edgeId?: string; clientX: number; clientY: number }) {
    const rect = canvasRef.current?.getBoundingClientRect();
    setAddMenu({
      sourceId,
      edgeId,
      x: Math.max(12, clientX - (rect?.left || 0)),
      y: Math.max(12, clientY - (rect?.top || 0)),
    });
  }

  function createNodeFromMenu(type: WorkflowNodeType) {
    if (!addMenu) return;
    if (addMenu.edgeId) {
      const edge = props.edges.find((item) => item.id === addMenu.edgeId);
      const from = props.nodes.find((item) => item.id === edge?.from);
      const to = props.nodes.find((item) => item.id === edge?.to);
      props.addNode(type, {
        connectFrom: edge?.from,
        connectTo: edge?.to,
        replaceEdgeId: edge?.id,
        position: {
          x: from && to ? (from.x + to.x) / 2 : 260,
          y: from && to ? (from.y + to.y) / 2 + 110 : 220,
        },
      });
    } else {
      const source = props.nodes.find((item) => item.id === addMenu.sourceId);
      props.addNode(type, {
        connectFrom: addMenu.sourceId,
        position: {
          x: source ? source.x + 300 : 180,
          y: source ? source.y : 220,
        },
      });
    }
    setAddMenu(null);
  }

  function onNodesChange(changes: NodeChange<Node<WorkflowNodeData>>[]) {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        props.updateNode(change.id, { x: change.position.x, y: change.position.y });
      }
      if (change.type === "select" && change.selected) {
        props.selectNode(change.id);
      }
    }
  }

  function onConnect(connection: Connection) {
    if (connection.source && connection.target) {
      props.connectNodes(connection.source, connection.target);
    }
  }

  return (
    <div className="workflowLayout xyflowDesigner">
      <aside className="nodePalette designCard">
        <h3>节点</h3>
        {categoryOrder.map((category) => {
          const specs = (Object.keys(nodeSpecs) as WorkflowNodeType[]).map((type) => nodeSpecs[type]).filter((spec) => spec.category === category);
          if (!specs.length) return null;
          return (
            <section className="paletteGroup" key={category}>
              <span>{nodeCategoryLabels[category]}</span>
              {specs.map((spec) => (
                <button className="paletteItem" key={spec.type} onClick={() => props.addNode(spec.type)}>
                  <span className={`dot ${spec.accent}`} />
                  <strong>{spec.displayName}</strong>
                  <small>{spec.description}</small>
                  <Plus size={14} />
                </button>
              ))}
            </section>
          );
        })}
        <p className="gestureTip"><MousePointer2 size={15} /> 画布支持拖拽平移、滚轮缩放、连线和节点/连线上的 + 快捷新增。</p>
      </aside>
      <div className="workflowCanvas xyflowCanvas" ref={canvasRef}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onNodeClick={(_event: ReactMouseEvent, node: Node<WorkflowNodeData>) => props.selectNode(node.id)}
          onEdgeClick={(_event: ReactMouseEvent, edge: Edge<WorkflowEdgeData>) => props.selectEdge(edge.id)}
          onPaneClick={() => setAddMenu(null)}
          fitView
          fitViewOptions={{ padding: 0.24 }}
          connectionLineType={ConnectionLineType.Bezier}
          defaultEdgeOptions={{ type: "workflowEdge", markerEnd: { type: MarkerType.ArrowClosed, color: "#2563eb" } }}
        >
          <Background color="#c8d4e7" gap={26} />
          <MiniMap pannable zoomable className="workflowMiniMap" />
          <Controls position="bottom-left" />
        </ReactFlow>
        {addMenu && <NodeAddMenu state={addMenu} onPick={createNodeFromMenu} onClose={() => setAddMenu(null)} />}
      </div>
      <WorkflowInspector {...props} />
    </div>
  );
}

function WorkflowInspector(props: WorkflowDesignerProps) {
  return (
    <aside className="inspector designCard">
      <div className="sectionTitle"><PanelRight size={18} /><h3>属性</h3></div>
      {props.selectedNode && (
        <div className="inspectorStack">
          <Field label="节点名称">
            <input value={props.selectedNode.label} onChange={(event) => props.updateNode(props.selectedNode!.id, { label: event.target.value })} />
          </Field>
          <div className="nodeTypeBanner">
            <span className={`dot ${nodeSpec(props.selectedNode.type).accent}`} />
            <strong>{nodeSpec(props.selectedNode.type).displayName}</strong>
            <small>{nodeSpec(props.selectedNode.type).description}</small>
          </div>
          <h4>输入</h4>
          <p className="mutedText">{nodePlugin(props.selectedNode.type).spec.inputSummary.join("、") || "无输入"}</p>
          <h4>配置</h4>
          <NodeConfigFields node={props.selectedNode} updateNodeConfig={props.updateNodeConfig} />
          <h4>输出</h4>
          <p className="mutedText">{nodePlugin(props.selectedNode.type).spec.outputSummary.join("、") || "无输出"}</p>
          <details className="advancedNodeDetails">
            <summary>高级</summary>
            <Field label="节点 ID"><input value={props.selectedNode.id} readOnly /></Field>
            <Field label="内部类型"><input value={props.selectedNode.type} readOnly /></Field>
          </details>
          <button className="dangerBtn" disabled={props.selectedNode.id === "start" || props.selectedNode.id === "end"} onClick={() => props.removeNode(props.selectedNode!.id)}>
            <X size={16} /> 删除节点
          </button>
        </div>
      )}
      {props.selectedEdge && (
        <div className="inspectorStack">
          <Field label="连线"><input value={`${props.selectedEdge.from} → ${props.selectedEdge.to}`} readOnly /></Field>
          <Field label="条件表达式">
            <textarea value={props.selectedEdge.condition || ""} onChange={(event) => props.updateEdge(props.selectedEdge!.id, event.target.value)} placeholder="{{nodes.confirm.action == 'approve'}}" />
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
  );
}

export function restoreWorkflowDefinition(definition: Record<string, any>): { nodes: WorkflowNode[]; edges: AppWorkflowEdge[] } {
  const uiNodes = Array.isArray(definition.ui?.nodes) ? definition.ui.nodes : [];
  const nodes = Array.isArray(definition.nodes) && definition.nodes.length
    ? definition.nodes.map((item: Record<string, any>, index: number) => {
        const type = normalizeNodeType(item.type);
        const ui = uiNodes.find((candidate: Record<string, any>) => candidate.id === item.id) || {};
        return {
          id: String(item.id || `${type}_${index}`),
          type,
          label: String(item.label || ui.label || nodeSpec(type).defaultLabel),
          x: Number(ui.x ?? item.x ?? 72 + index * 260),
          y: Number(ui.y ?? item.y ?? 160 + (index % 2) * 100),
          config: typeof item.config === "object" && item.config ? item.config : { ...nodeSpec(type).defaultConfig },
        } as WorkflowNode;
      })
    : defaultNodes.map((item) => ({ ...item, config: { ...item.config } }));
  const edges = Array.isArray(definition.edges)
    ? definition.edges.map((item: Record<string, any>, index: number) => ({
        id: String(item.id || `edge_${String(item.from)}_${String(item.to)}_${index}`),
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
  return { ...nodeSpec(type).defaultConfig };
}

export function newWorkflowNode(type: WorkflowNodeType, id: string, x: number, y: number) {
  return createWorkflowNode(type, { id, x, y });
}

function normalizeNodeType(type: unknown): WorkflowNodeType {
  return type === "start" || type === "llm" || type === "agent" || type === "tool" || type === "http_request" || type === "knowledge_retrieval" || type === "user_confirm" || type === "user_form" || type === "condition" || type === "variable" || type === "code" || type === "end" ? type : "llm";
}
