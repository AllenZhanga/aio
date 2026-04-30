import type { AgentDraft, WorkflowEdge, WorkflowNode } from "./types";

export function buildAgentDefinition(draft: AgentDraft) {
  return {
    type: "agent",
    agentMode: draft.mode,
    model: {
      providerAccountId: draft.providerAccountId,
      chatModel: draft.model,
      temperature: draft.temperature,
      maxTokens: 1024,
    },
    prompt: { system: draft.system },
    knowledge: draft.knowledgeDatasetIds.map((datasetId) => ({
      datasetId,
      topK: draft.knowledgeTopK,
      scoreThreshold: draft.knowledgeScoreThreshold,
    })),
    tools: [],
    memory: { enabled: true, windowMessages: 10 },
    output: { format: "text" },
    ui: { opening: draft.opening, toolPlan: draft.toolPlan },
  };
}

export function buildWorkflowDefinition(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
) {
  return {
    type: "workflow",
    version: 1,
    inputs: [
      { name: "question", type: "string", required: true },
      { name: "operator_id", type: "string", required: false },
    ],
    variables: [],
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      enabled: true,
      inputs: node.inputs || [],
      config: node.config,
      outputs: node.outputs || {},
      runtime: node.runtime || { timeoutSeconds: 60, retry: { maxAttempts: 0 } },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      sourceHandle: "main",
      targetHandle: "input",
      priority: 0,
      ...(edge.condition ? { condition: edge.condition } : {}),
    })),
    ui: {
      nodes: nodes.map((node) => ({
        id: node.id,
        label: node.label,
        x: node.x,
        y: node.y,
      })),
    },
  };
}
