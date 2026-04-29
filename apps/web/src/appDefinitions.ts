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
    inputs: [
      { name: "question", type: "string", required: true },
      { name: "operator_id", type: "string", required: false },
    ],
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      config: node.config,
    })),
    edges: edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
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
