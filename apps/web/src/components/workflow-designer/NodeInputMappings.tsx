import { Braces, ChevronDown, Info, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkflowDesignerProps, WorkflowNode, WorkflowNodeInput } from "../../types";
import { availableVariablesForNode, type WorkflowVariableGroup, type WorkflowVariableOption } from "./workflowVariables";

const inputTypes: WorkflowNodeInput["type"][] = ["string", "number", "boolean", "object", "array"];

const groupLabels: Record<WorkflowVariableGroup, string> = {
  input: "输入变量",
  inputs: "用户变量",
  vars: "应用变量",
  sys: "系统变量",
  nodes: "节点变量",
  metadata: "调用元数据",
};

export function NodeInputMappings({
  node,
  workflow,
}: {
  node: WorkflowNode;
  workflow: WorkflowDesignerProps;
}) {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const variables = useMemo(
    () => availableVariablesForNode({ currentNodeId: node.id, nodes: workflow.nodes, edges: workflow.edges }),
    [node.id, workflow.nodes, workflow.edges],
  );
  const rows = node.inputs || [];

  return (
    <div className="nodeInputMappings">
      <div className="nodeInputHeader">
        <span>变量名</span>
        <span>变量值</span>
        <button type="button" onClick={() => workflow.addNodeInput(node.id)} aria-label="新增输入变量"><Plus size={16} /></button>
      </div>
      <div className="nodeInputRows">
        {rows.map((input, index) => (
          <div className="nodeInputRow" key={`${input.name}_${index}`}>
            <input
              value={input.name}
              placeholder="输入参数名"
              onChange={(event) => workflow.updateNodeInput(node.id, index, { name: event.target.value })}
            />
            <div className="nodeInputValueCell">
              <select
                value={input.type}
                onChange={(event) => workflow.updateNodeInput(node.id, index, { type: event.target.value as WorkflowNodeInput["type"] })}
              >
                {inputTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <input
                value={input.value}
                placeholder="输入或引用参数值"
                onChange={(event) => workflow.updateNodeInput(node.id, index, { value: event.target.value })}
              />
              <button type="button" onClick={() => setOpenRow(openRow === index ? null : index)} aria-label="引用变量">
                <Braces size={15} />
              </button>
              {openRow === index && (
                <InputVariableMenu
                  variables={variables}
                  onClose={() => setOpenRow(null)}
                  onPick={(path) => {
                    workflow.updateNodeInput(node.id, index, { value: `{{${path}}}` });
                    setOpenRow(null);
                  }}
                />
              )}
            </div>
            <button type="button" className="nodeInputRemove" onClick={() => workflow.removeNodeInput(node.id, index)} aria-label="删除输入变量">-</button>
          </div>
        ))}
        {!rows.length && (
          <div className="nodeInputEmpty">
            <Info size={14} />
            <span>这个节点暂未定义输入变量。配置区只能引用上游变量；新增输入后可在配置里使用 {`{{input.name}}`}。</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InputVariableMenu({
  variables,
  onPick,
  onClose,
}: {
  variables: WorkflowVariableOption[];
  onPick: (path: string) => void;
  onClose: () => void;
}) {
  const grouped = variables.reduce<Record<WorkflowVariableGroup, WorkflowVariableOption[]>>(
    (groups, variable) => {
      groups[variable.group].push(variable);
      return groups;
    },
    { input: [], inputs: [], vars: [], sys: [], nodes: [], metadata: [] },
  );

  return (
    <div className="inputVariableMenu">
      <header>
        <strong>引用变量</strong>
        <button type="button" onClick={onClose} aria-label="关闭"><X size={13} /></button>
      </header>
      {Object.entries(grouped).map(([group, items]) => {
        if (!items.length || group === "input") return null;
        return (
          <section key={group}>
            <strong>{groupLabels[group as WorkflowVariableGroup]} <ChevronDown size={13} /></strong>
            {items.map((item) => (
              <button type="button" key={item.path} onClick={() => onPick(item.path)}>
                <span>{item.label}</span>
                <code>{item.path}</code>
                <em>{item.type}</em>
              </button>
            ))}
          </section>
        );
      })}
      {!variables.length && <p>当前没有可引用变量。</p>}
    </div>
  );
}
