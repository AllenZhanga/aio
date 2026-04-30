import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import type { WorkflowNodeType } from "../../types";
import { nodeSpec } from "./nodeSpecs";

export type WorkflowNodeData = {
  nodeId: string;
  type: WorkflowNodeType;
  label: string;
  selected?: boolean;
  onAddAfter?: (nodeId: string, clientX: number, clientY: number) => void;
};

export function WorkflowNodeCard({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowNodeData;
  const spec = nodeSpec(nodeData.type);
  const canReceive = nodeData.type !== "start";
  const canConnectOut = nodeData.type !== "end";
  return (
    <article className={`workflowNode xyflowNode ${nodeData.type} ${selected || nodeData.selected ? "selected" : ""}`}>
      {canReceive && <Handle className="xyHandle in" type="target" position={Position.Left} id="input" />}
      <div className="nodeHead">
        <span className={`dot ${spec.accent}`} />
        <strong>{nodeData.label || spec.displayName}</strong>
      </div>
      <p>{spec.description}</p>
      <div className="nodeIoSummary">
        <span>输入 {spec.inputSummary.length || "无"}</span>
        <span>输出 {spec.outputSummary.join("、") || "无"}</span>
      </div>
      {canConnectOut && (
        <>
          <Handle className="xyHandle out" type="source" position={Position.Right} id="main" />
          <button
            className="nodeQuickAdd"
            type="button"
            aria-label="新增后继节点"
            onClick={(event) => {
              event.stopPropagation();
              nodeData.onAddAfter?.(nodeData.nodeId, event.clientX, event.clientY);
            }}
          >
            <Plus size={13} />
          </button>
        </>
      )}
    </article>
  );
}
