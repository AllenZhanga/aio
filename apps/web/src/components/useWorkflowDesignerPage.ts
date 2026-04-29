import { useMemo, useRef, useState, type PointerEvent } from "react";
import { buildWorkflowDefinition } from "../appDefinitions";
import type {
  ConnectState,
  DragState,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
} from "../types";
import {
  defaultEdges,
  defaultNodeConfig,
  defaultNodes,
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
      defaultNodes.map((item) => ({ ...item, config: { ...item.config } })),
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

  function addNode(type: WorkflowNodeType) {
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const index = nodes.length;
    const nextNode: WorkflowNode = {
      id,
      type,
      label: nodeMeta[type].name,
      x: 130 + (index % 4) * 230,
      y: 340 + Math.floor(index / 4) * 132,
      config: defaultNodeConfig(type),
    };
    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId("");
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
      removeNode,
      removeEdge,
      updateEdge,
      updateNode,
      updateNodeConfig,
      startDrag,
      startConnect,
      finishConnect,
      moveOnCanvas,
      stopCanvasInteraction,
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
}
