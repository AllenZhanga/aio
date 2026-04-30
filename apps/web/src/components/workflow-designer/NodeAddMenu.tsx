import { Search, X } from "lucide-react";
import type { WorkflowNodeType } from "../../types";
import { nodeCategoryLabels, nodeSpecs } from "./nodeSpecs";

export type NodeAddMenuState = {
  x: number;
  y: number;
  sourceId?: string;
  edgeId?: string;
};

const categoryOrder = ["basic", "ai", "knowledge", "tool", "control", "human", "output"] as const;

export function NodeAddMenu({
  state,
  excludedTypes = ["start"],
  onPick,
  onClose,
}: {
  state: NodeAddMenuState;
  excludedTypes?: WorkflowNodeType[];
  onPick: (type: WorkflowNodeType) => void;
  onClose: () => void;
}) {
  return (
    <div className="nodeAddMenu" style={{ left: state.x, top: state.y }}>
      <header>
        <span><Search size={14} /> 选择节点</span>
        <button className="ghostTinyBtn" onClick={onClose} aria-label="关闭"><X size={13} /></button>
      </header>
      {categoryOrder.map((category) => {
        const specs = (Object.keys(nodeSpecs) as WorkflowNodeType[])
          .filter((type) => !excludedTypes.includes(type))
          .map((type) => nodeSpecs[type])
          .filter((spec) => spec.category === category);
        if (!specs.length) return null;
        return (
          <section key={category}>
            <strong>{nodeCategoryLabels[category]}</strong>
            <div>
              {specs.map((spec) => (
                <button key={spec.type} type="button" onClick={() => onPick(spec.type)}>
                  <span className={`dot ${spec.accent}`} />
                  <span>{spec.displayName}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
