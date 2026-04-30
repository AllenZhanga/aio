import type { ComponentType } from "react";
import type { WorkflowEdge, WorkflowNode, WorkflowNodeInput, WorkflowNodeType } from "../../types";
import { nodeSpecs, type WorkflowNodeSpec } from "./nodeSpecs";
import type { WorkflowVariableOption } from "./workflowVariables";

export type NodeConfigPanelProps = {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: WorkflowVariableOption[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
};

export type NodeSummaryProps = {
  node: WorkflowNode;
};

export type WorkflowNodePlugin = {
  type: WorkflowNodeType;
  spec: WorkflowNodeSpec;
  createDefaultNode: (context: { id: string; x: number; y: number }) => WorkflowNode;
  renderConfig?: ComponentType<NodeConfigPanelProps>;
  renderSummary?: ComponentType<NodeSummaryProps>;
};

function createPlugin(type: WorkflowNodeType): WorkflowNodePlugin {
  const spec = nodeSpecs[type];
  return {
    type,
    spec,
    createDefaultNode: ({ id, x, y }) => ({
      id,
      type,
      label: spec.defaultLabel,
      x,
      y,
      inputs: defaultNodeInputs(type),
      outputs: defaultNodeOutput(type),
      runtime: { timeoutSeconds: 60, retry: { maxAttempts: 0 } },
      config: { ...spec.defaultConfig },
    }),
  };
}

function defaultNodeOutput(type: WorkflowNodeType) {
  if (type === "llm") return { format: "text" as const, value: "{{nodes.self.text}}" };
  if (type === "end") return { format: "text" as const, value: "{{input.output}}" };
  return undefined;
}

export function defaultNodeInputs(type: WorkflowNodeType): WorkflowNodeInput[] {
  return nodeSpecs[type].inputSummary.map((name) => ({
    name,
    type: "string",
    value: defaultInputValue(type, name),
  }));
}

function defaultInputValue(type: WorkflowNodeType, name: string) {
  if (type === "start") return "";
  if (name === "query" || name === "prompt" || name === "input" || name === "output") return "{{inputs.question}}";
  if (name === "description") return "{{nodes.answer.text}}";
  if (name === "expression") return "{{nodes.confirm.action}}";
  return "";
}

export const workflowNodePlugins = Object.fromEntries(
  (Object.keys(nodeSpecs) as WorkflowNodeType[]).map((type) => [type, createPlugin(type)]),
) as Record<WorkflowNodeType, WorkflowNodePlugin>;

export function nodePlugin(type: WorkflowNodeType) {
  return workflowNodePlugins[type];
}

export function createWorkflowNode(type: WorkflowNodeType, context: { id: string; x: number; y: number }) {
  return nodePlugin(type).createDefaultNode(context);
}
