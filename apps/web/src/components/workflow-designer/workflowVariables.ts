import type { WorkflowEdge, WorkflowNode } from "../../types";
import { nodeSpec } from "./nodeSpecs";

export type WorkflowVariableGroup = "input" | "sys" | "inputs" | "conversation" | "vars" | "nodes" | "metadata";

export type WorkflowVariableOption = {
  group: WorkflowVariableGroup;
  label: string;
  path: string;
  type: string;
  description: string;
  sourceNodeId?: string;
};

const systemVariables: WorkflowVariableOption[] = [
  { group: "sys", label: "运行 ID", path: "sys.runId", type: "string", description: "当前 Workflow 运行编号" },
  { group: "sys", label: "应用 ID", path: "sys.appId", type: "string", description: "当前应用编号" },
  { group: "sys", label: "租户 ID", path: "sys.tenantId", type: "string", description: "当前租户" },
  { group: "sys", label: "工作空间 ID", path: "sys.workspaceId", type: "string", description: "当前工作空间" },
];

const defaultInputVariables: WorkflowVariableOption[] = [
  { group: "inputs", label: "用户问题", path: "inputs.question", type: "string", description: "调用 Workflow 时传入的问题" },
  { group: "inputs", label: "操作人", path: "inputs.operator_id", type: "string", description: "调用端传入的操作人标识" },
];

const conversationVariables: WorkflowVariableOption[] = [
  { group: "conversation", label: "会话 ID", path: "conversation.id", type: "string", description: "调用端传入的 conversation_id" },
  { group: "conversation", label: "会话摘要", path: "conversation.summary", type: "string", description: "当前会话历史的压缩摘要" },
  { group: "conversation", label: "最近消息", path: "conversation.messages", type: "array", description: "当前会话最近的用户与 AI 消息" },
  { group: "conversation", label: "上一条用户消息", path: "conversation.lastUserMessage", type: "string", description: "当前会话中最近的用户消息" },
  { group: "conversation", label: "上一条 AI 回复", path: "conversation.lastAssistantMessage", type: "string", description: "当前会话中最近的 AI 回复" },
];

const metadataVariables: WorkflowVariableOption[] = [
  { group: "metadata", label: "请求 ID", path: "metadata.requestId", type: "string", description: "调用端请求编号" },
  { group: "metadata", label: "调用来源", path: "metadata.source", type: "string", description: "调用端来源" },
];

export function availableVariablesForNode({
  currentNodeId,
  nodes,
  edges,
  includeCurrentInputs = false,
}: {
  currentNodeId?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  includeCurrentInputs?: boolean;
}): WorkflowVariableOption[] {
  const ancestorIds = currentNodeId ? findAncestorNodeIds(currentNodeId, edges) : new Set<string>();
  const currentNode = currentNodeId ? nodes.find((node) => node.id === currentNodeId) : undefined;
  const upstreamNodeVariables = nodes
    .filter((node) => ancestorIds.has(node.id))
    .flatMap((node) => nodeOutputVariables(node));

  return [
    ...(includeCurrentInputs && currentNode ? nodeInputVariables(currentNode) : []),
    ...systemVariables,
    ...inputVariablesFromStart(nodes),
    ...conversationVariables,
    ...flowVariablesFromGraph(nodes, ancestorIds),
    ...upstreamNodeVariables,
    ...metadataVariables,
  ];
}

function nodeInputVariables(node: WorkflowNode): WorkflowVariableOption[] {
  return (node.inputs || [])
    .filter((input) => input.name.trim())
    .map((input) => ({
      group: "input",
      label: input.name,
      path: `input.${input.name}`,
      type: input.type,
      description: `${node.label} 的本节点输入`,
      sourceNodeId: node.id,
    }));
}

function findAncestorNodeIds(nodeId: string, edges: WorkflowEdge[]) {
  const ancestors = new Set<string>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) || []), edge.from]);
  }

  const visit = (id: string) => {
    for (const parent of incoming.get(id) || []) {
      if (ancestors.has(parent)) continue;
      ancestors.add(parent);
      visit(parent);
    }
  };

  visit(nodeId);
  return ancestors;
}

function nodeOutputVariables(node: WorkflowNode): WorkflowVariableOption[] {
  if (node.type === "start") {
    return inputVariablesFromStart([node]).map((input) => ({
      ...input,
      group: "nodes",
      label: `${node.label}.${input.label}`,
      path: `nodes.${node.id}.${input.path.replace(/^inputs\./, "")}`,
      description: `${node.label} 节点输出`,
      sourceNodeId: node.id,
    }));
  }
  if (node.type === "variable") {
    const variableName = typeof node.config.name === "string" ? node.config.name.trim() : "";
    if (!variableName) return [];
    return [{
      group: "nodes",
      label: `${node.label}.${variableName}`,
      path: `nodes.${node.id}.${variableName}`,
      type: typeof node.config.type === "string" ? node.config.type : "unknown",
      description: `${node.label} 节点输出`,
      sourceNodeId: node.id,
    }];
  }
  return nodeSpec(node.type).outputSummary.map((field) => ({
    group: "nodes",
    label: `${node.label}.${field}`,
    path: `nodes.${node.id}.${field}`,
    type: inferOutputType(field),
    description: `${node.label} 节点输出`,
    sourceNodeId: node.id,
  }));
}

function inputVariablesFromStart(nodes: WorkflowNode[]) {
  const startNode = nodes.find((node) => node.type === "start");
  const configuredInputs = Array.isArray(startNode?.config.inputs) ? startNode?.config.inputs : [];
  const variables = configuredInputs
    .map((item) => normalizeInputDefinition(item))
    .filter((item): item is WorkflowVariableOption => !!item);
  return variables.length ? variables : defaultInputVariables;
}

function flowVariablesFromGraph(nodes: WorkflowNode[], ancestorIds: Set<string>) {
  const configuredVariables = nodes
    .filter((node) => node.type === "variable" && ancestorIds.has(node.id))
    .map((node) => {
      const name = typeof node.config.name === "string"
        ? node.config.name
        : typeof node.config.variableName === "string"
          ? node.config.variableName
          : "";
      if (!name) return null;
      const variable: WorkflowVariableOption = {
        group: "vars" as const,
        label: name,
        path: `vars.${name}`,
        type: typeof node.config.type === "string" ? node.config.type : "unknown",
        description: `${node.label} 写入的流程变量`,
        sourceNodeId: node.id,
      };
      return variable;
    })
    .filter((item): item is WorkflowVariableOption => item !== null);

  return configuredVariables;
}

function normalizeInputDefinition(item: unknown): WorkflowVariableOption | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  if (typeof record.name !== "string" || !record.name) return null;
  return {
    group: "inputs",
    label: typeof record.label === "string" ? record.label : record.name,
    path: `inputs.${record.name}`,
    type: typeof record.type === "string" ? record.type : "unknown",
    description: typeof record.description === "string" ? record.description : "流程输入变量",
  };
}

function inferOutputType(field: string) {
  if (["chunks", "headers", "values", "outputs", "usage", "raw"].includes(field)) return "object";
  if (["status", "latencyMs", "expiresInSeconds"].includes(field)) return "number";
  return "string";
}
