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
import { MousePointer2, Plus } from "lucide-react";
import type { AgentMode, WorkflowDesignerProps, WorkflowEdge as AppWorkflowEdge, WorkflowNode, WorkflowNodeType } from "../../types";
import { NodeAddMenu, type NodeAddMenuState } from "./NodeAddMenu";
import { WorkflowPropertyPanel } from "./WorkflowPropertyPanel";
import { WorkflowEdge, type WorkflowEdgeData } from "./WorkflowEdge";
import { WorkflowNodeCard, type WorkflowNodeData } from "./WorkflowNodeCard";
import { createWorkflowNode, defaultNodeInputs } from "./nodeRegistry";
import { nodeCategoryLabels, nodeSpec, nodeSpecs } from "./nodeSpecs";

export const nodeMeta: Record<WorkflowNodeType, { name: string; description: string; accent: string }> = Object.fromEntries(
  (Object.keys(nodeSpecs) as WorkflowNodeType[]).map((type) => {
    const spec = nodeSpec(type);
    return [type, { name: spec.displayName, description: spec.description, accent: spec.accent }];
  }),
) as Record<WorkflowNodeType, { name: string; description: string; accent: string }>;

export const defaultNodes: WorkflowNode[] = [
  { id: "start", type: "start", label: "开始", x: 72, y: 180, config: {} },
  { id: "answer", type: "llm", label: "生成回复", x: 360, y: 130, inputs: [{ name: "prompt", type: "string", value: "{{inputs.question}}" }], outputs: { format: "text", value: "{{nodes.answer.text}}" }, runtime: { timeoutSeconds: 60, retry: { maxAttempts: 0 } }, config: { systemPrompt: "你是工作流中的 LLM 节点。", userPrompt: "请基于输入给出处理建议：{{input.prompt}}", temperature: 0.3 } },
  {
    id: "confirm",
    type: "user_confirm",
    label: "人工确认",
    x: 650,
    y: 180,
    inputs: [{ name: "description", type: "string", value: "{{nodes.answer.text}}" }],
    runtime: { timeoutSeconds: 86400, retry: { maxAttempts: 0 } },
    config: {
      title: "确认处理方案",
      description: "{{input.description}}",
      actions: [
        { key: "approve", label: "确认" },
        { key: "reject", label: "拒绝" },
      ],
      expiresInSeconds: 86400,
    },
  },
  { id: "end", type: "end", label: "结束", x: 940, y: 180, inputs: [{ name: "output", type: "string", value: "{{nodes.answer.text}}" }], outputs: { format: "text", value: "{{input.output}}" }, runtime: { timeoutSeconds: 60, retry: { maxAttempts: 0 } }, config: { output: "{{input.output}}" } },
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
  const [propertyPanelOpen, setPropertyPanelOpen] = useState(false);
  const hasStartNode = props.nodes.some((node) => node.type === "start");

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
    setPropertyPanelOpen(true);
  }

  function onNodesChange(changes: NodeChange<Node<WorkflowNodeData>>[]) {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        props.updateNode(change.id, { x: change.position.x, y: change.position.y });
      }
      if (change.type === "select" && change.selected) {
        props.selectNode(change.id);
        setPropertyPanelOpen(true);
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
                <button
                  className="paletteItem"
                  key={spec.type}
                  disabled={spec.type === "start" && hasStartNode}
                  title={spec.type === "start" && hasStartNode ? "开始节点只能存在一个" : spec.displayName}
                  onClick={() => {
                    props.addNode(spec.type);
                    setPropertyPanelOpen(true);
                  }}
                >
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
          onNodeClick={(_event: ReactMouseEvent, node: Node<WorkflowNodeData>) => {
            props.selectNode(node.id);
            setPropertyPanelOpen(true);
          }}
          onEdgeClick={(_event: ReactMouseEvent, edge: Edge<WorkflowEdgeData>) => {
            props.selectEdge(edge.id);
            setPropertyPanelOpen(true);
          }}
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
        {propertyPanelOpen && (props.selectedNode || props.selectedEdge) && (
          <WorkflowPropertyPanel workflow={props} onClose={() => setPropertyPanelOpen(false)} />
        )}
      </div>
    </div>
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
          inputs: normalizeNodeInputs(item.inputs, type),
          outputs: normalizeNodeOutput(item.outputs, type),
          runtime: normalizeNodeRuntime(item.runtime),
          config: typeof item.config === "object" && item.config ? item.config : { ...nodeSpec(type).defaultConfig },
        } as WorkflowNode;
      })
    : defaultNodes.map((item) => ({ ...item, inputs: item.inputs?.map((input) => ({ ...input })), config: { ...item.config } }));
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

function normalizeNodeOutput(value: unknown, type: WorkflowNodeType) {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const format = record.format === "json" ? "json" : "text";
    return { format, value: typeof record.value === "string" ? record.value : "" };
  }
  if (type === "llm") return { format: "text" as const, value: "{{nodes.self.text}}" };
  if (type === "end") return { format: "text" as const, value: "{{input.output}}" };
  return undefined;
}

function normalizeNodeRuntime(value: unknown) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const retry = record.retry && typeof record.retry === "object" ? record.retry as Record<string, unknown> : {};
  return {
    timeoutSeconds: Number(record.timeoutSeconds ?? 60),
    retry: { maxAttempts: Number(retry.maxAttempts ?? 0) },
  };
}

function normalizeNodeInputs(value: unknown, type: WorkflowNodeType) {
  if (!Array.isArray(value)) return defaultNodeInputs(type);
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        name: typeof record.name === "string" ? record.name : "",
        type: normalizeInputType(record.type),
        value: typeof record.value === "string" ? record.value : "",
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item && !!item.name);
}

function normalizeInputType(type: unknown) {
  return ["string", "number", "boolean", "object", "array"].includes(String(type))
    ? String(type) as "string" | "number" | "boolean" | "object" | "array"
    : "string";
}

export function parseConfigValue(key: string, value: string): unknown {
  const trimmed = value.trim();
  if (["topK", "scoreThreshold", "expiresInSeconds", "temperature"].includes(key) && trimmed !== "") {
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
