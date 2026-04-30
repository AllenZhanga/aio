import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

export type WorkflowEdgeData = {
  condition?: string;
  onInsert?: (edgeId: string, clientX: number, clientY: number) => void;
};

export function WorkflowEdge(props: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const data = props.data as WorkflowEdgeData | undefined;
  return (
    <>
      <BaseEdge path={edgePath} markerEnd={props.markerEnd} className={`edgePath ${props.selected ? "selected" : ""}`} />
      <EdgeLabelRenderer>
        <div
          className="edgeInsertWrap"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          {data?.condition && <span className="edgeConditionLabel">{data.condition}</span>}
          <button
            className="edgeInsertBtn"
            type="button"
            aria-label="在连线上插入节点"
            onClick={(event) => {
              event.stopPropagation();
              data?.onInsert?.(props.id, event.clientX, event.clientY);
            }}
          >
            <Plus size={13} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
