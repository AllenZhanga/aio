import type { ComponentType } from "react";
import type { WorkflowNode, WorkflowNodeType } from "../../types";
import { nodeSpecs, type WorkflowNodeSpec } from "./nodeSpecs";

export type NodeConfigPanelProps = {
  node: WorkflowNode;
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
      config: { ...spec.defaultConfig },
    }),
  };
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
