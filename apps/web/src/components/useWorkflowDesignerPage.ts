import { useMemo, useRef, useState, type PointerEvent } from "react";
import { buildWorkflowDefinition } from "../appDefinitions";
import type {
  ConnectState,
  DragState,
  WorkflowAddNodeOptions,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeInput,
  WorkflowNodeOutput,
  WorkflowNodeRuntime,
  WorkflowNodeType,
} from "../types";
import {
  defaultEdges,
  defaultNodeConfig,
  defaultNodes,
  newWorkflowNode,
  nodeMeta,
  parseConfigValue,
  restoreWorkflowDefinition,
} from "./WorkflowDesigner";

export function useWorkflowDesignerPage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(defaultNodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(defaultEdges);
  const [selectedNodeId, setSelectedNodeId] = useState("answer");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((item) => item.id === selectedNodeId),
    [nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => edges.find((item) => item.id === selectedEdgeId),
    [edges, selectedEdgeId],
  );
  const workflowDefinition = useMemo(
    () => buildWorkflowDefinition(nodes, edges),
    [nodes, edges],
  );

  function resetWorkflowCanvas() {
    setNodes(
      defaultNodes.map((item) => ({ ...item, inputs: item.inputs?.map((input) => ({ ...input })), config: { ...item.config } })),
    );
    setEdges(defaultEdges.map((item) => ({ ...item })));
    setSelectedNodeId("answer");
    setSelectedEdgeId("");
  }

  function restoreWorkflowCanvas(definition: Record<string, any>) {
    const restored = restoreWorkflowDefinition(definition);
    setNodes(restored.nodes);
    setEdges(restored.edges);
    setSelectedNodeId(
      restored.nodes.find((node) => node.type === "llm")?.id ||
        restored.nodes[0]?.id ||
        "",
    );
    setSelectedEdgeId("");
  }

  function addNode(type: WorkflowNodeType, options: WorkflowAddNodeOptions = {}) {
    if (type === "start" && nodes.some((node) => node.type === "start")) return;
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const index = nodes.length;
    const nextNode = newWorkflowNode(
      type,
      id,
      options.position?.x ?? 130 + (index % 4) * 230,
      options.position?.y ?? 340 + Math.floor(index / 4) * 132,
    );
    nextNode.label = nodeMeta[type].name;
    nextNode.config = defaultNodeConfig(type);
    setNodes((current) => [...current, nextNode]);
    setEdges((current) => {
      const withoutReplaced = options.replaceEdgeId
        ? current.filter((edge) => edge.id !== options.replaceEdgeId)
        : current;
      const additions: WorkflowEdge[] = [];
      if (options.connectFrom) {
        additions.push({ id: `edge_${options.connectFrom}_${id}_${Date.now()}`, from: options.connectFrom, to: id });
      }
      if (options.connectTo) {
        additions.push({ id: `edge_${id}_${options.connectTo}_${Date.now()}`, from: id, to: options.connectTo });
      }
      return [...withoutReplaced, ...additions];
    });
    setSelectedNodeId(id);
    setSelectedEdgeId("");
  }

  function connectNodes(from: string, to: string) {
    if (from === to) return;
    if (nodes.find((node) => node.id === from)?.type === "end") return;
    if (nodes.find((node) => node.id === to)?.type === "start") return;
    const edgeId = `edge_${from}_${to}_${Date.now()}`;
    setEdges((current) => {
      if (current.some((edge) => edge.from === from && edge.to === to)) return current;
      return [
        ...current,
        { id: edgeId, from, to },
      ];
    });
    setSelectedEdgeId(edgeId);
    setSelectedNodeId("");
  }

  function removeNode(nodeId: string) {
    if (nodeId === "start" || nodeId === "end") return;
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) =>
      current.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
    );
    setSelectedNodeId("start");
  }

  function updateNode(nodeId: string, patch: Partial<WorkflowNode>) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, ...patch } : node,
      ),
    );
  }

  function updateNodeConfig(nodeId: string, key: string, value: string) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              config: { ...node.config, [key]: parseConfigValue(key, value) },
            }
          : node,
      ),
    );
  }

  function updateNodeOutput(nodeId: string, patch: Partial<WorkflowNodeOutput>) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, outputs: { format: "text", value: "", ...(node.outputs || {}), ...patch } }
          : node,
      ),
    );
  }

  function updateNodeRuntime(nodeId: string, patch: Partial<WorkflowNodeRuntime>) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              runtime: {
                timeoutSeconds: node.runtime?.timeoutSeconds ?? 60,
                ...patch,
                retry: patch.retry || node.runtime?.retry || { maxAttempts: 0 },
              },
            }
          : node,
      ),
    );
  }

  function updateNodeInput(nodeId: string, index: number, patch: Partial<WorkflowNodeInput>) {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== nodeId) return node;
        const inputs = [...(node.inputs || [])];
        inputs[index] = { ...inputs[index], ...patch };
        return { ...node, inputs };
      }),
    );
  }

  function addNodeInput(nodeId: string) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, inputs: [...(node.inputs || []), { name: "", type: "string", value: "" }] }
          : node,
      ),
    );
  }

  function removeNodeInput(nodeId: string, index: number) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? { ...node, inputs: (node.inputs || []).filter((_, itemIndex) => itemIndex !== index) }
          : node,
      ),
    );
  }

  function updateEdge(edgeId: string, condition: string) {
    setEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? { ...edge, condition: condition || undefined }
          : edge,
      ),
    );
  }

  function removeEdge(edgeId: string) {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setSelectedEdgeId("");
  }

  function canvasPoint(event: PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left || 0),
      y: event.clientY - (rect?.top || 0),
    };
  }

  function startDrag(event: PointerEvent, node: WorkflowNode) {
    const point = canvasPoint(event);
    setDragging({
      nodeId: node.id,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
    });
    setSelectedNodeId(node.id);
    setSelectedEdgeId("");
  }

  function startConnect(event: PointerEvent, node: WorkflowNode) {
    event.stopPropagation();
    const point = canvasPoint(event);
    setConnecting({ from: node.id, x: point.x, y: point.y });
  }

  function finishConnect(event: PointerEvent, targetId: string) {
    event.stopPropagation();
    if (!connecting || connecting.from === targetId) return;
    if (
      !edges.some(
        (edge) => edge.from === connecting.from && edge.to === targetId,
      )
    ) {
      setEdges((current) => [
        ...current,
        {
          id: `edge_${connecting.from}_${targetId}_${Date.now()}`,
          from: connecting.from,
          to: targetId,
        },
      ]);
    }
    setConnecting(null);
  }

  function moveOnCanvas(event: PointerEvent) {
    const point = canvasPoint(event);
    if (dragging) {
      updateNode(dragging.nodeId, {
        x: Math.max(18, Math.min(1260, point.x - dragging.offsetX)),
        y: Math.max(18, Math.min(720, point.y - dragging.offsetY)),
      });
    }
    if (connecting) setConnecting({ ...connecting, x: point.x, y: point.y });
  }

  function stopCanvasInteraction() {
    setDragging(null);
    setConnecting(null);
  }

  return {
    workflowDefinition,
    resetWorkflowCanvas,
    restoreWorkflowCanvas,
    workflowProps: {
      canvasRef,
      nodes,
      edges,
      connecting,
      selectedNode,
      selectedEdge,
      workflowDefinition,
      addNode,
      connectNodes,
      removeNode,
      removeEdge,
      updateEdge,
      updateNode,
      updateNodeInput,
      addNodeInput,
      removeNodeInput,
      updateNodeConfig,
      updateNodeOutput,
      updateNodeRuntime,
      startDrag,
      startConnect,
      finishConnect,
      moveOnCanvas,
      stopCanvasInteraction,
      autoLayout,
      selectNode: (nodeId: string) => {
        setSelectedNodeId(nodeId);
        setSelectedEdgeId("");
      },
      selectEdge: (edgeId: string) => {
        setSelectedEdgeId(edgeId);
        setSelectedNodeId("");
      },
    },
  };

  function autoLayout() {
    const depths = new Map<string, number>();
    const queue = ["start"];
    depths.set("start", 0);
    while (queue.length) {
      const current = queue.shift()!;
      const currentDepth = depths.get(current) || 0;
      for (const edge of edges.filter((item) => item.from === current)) {
        const nextDepth = currentDepth + 1;
        if ((depths.get(edge.to) ?? -1) < nextDepth) {
          depths.set(edge.to, nextDepth);
          queue.push(edge.to);
        }
      }
    }
    const grouped = new Map<number, WorkflowNode[]>();
    for (const node of nodes) {
      const depth = depths.get(node.id) ?? 0;
      grouped.set(depth, [...(grouped.get(depth) || []), node]);
    }
    setNodes((current) =>
      current.map((node) => {
        const depth = depths.get(node.id) ?? 0;
        const peers = grouped.get(depth) || [];
        const row = peers.findIndex((item) => item.id === node.id);
        return { ...node, x: 80 + depth * 300, y: 120 + Math.max(0, row) * 170 };
      }),
    );
  }
}
