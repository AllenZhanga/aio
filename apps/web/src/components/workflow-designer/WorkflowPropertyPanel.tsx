import { Braces, Edit3, PanelRight, Trash2, X } from "lucide-react";
import type { WorkflowDesignerProps } from "../../types";
import { Field } from "../ui";
import { NodeConfigFields } from "./NodeConfigFields";
import { NodeInputMappings } from "./NodeInputMappings";
import { NodeOutputSection } from "./NodeOutputSection";
import { NodeRuntimeSection } from "./NodeRuntimeSection";
import { WorkflowConfigInput } from "./WorkflowConfigInput";
import { nodeSpec } from "./nodeSpecs";
import { availableVariablesForNode } from "./workflowVariables";

export function WorkflowPropertyPanel({
  workflow,
  onClose,
}: {
  workflow: WorkflowDesignerProps;
  onClose: () => void;
}) {
  if (workflow.selectedNode) {
    const node = workflow.selectedNode;
    const spec = nodeSpec(node.type);
    return (
      <section className="workflowPropertyPanel" aria-label="节点属性弹窗">
        <header className="propertyPanelHeader">
          <div className="propertyPanelTitle">
            <span className={`dot ${spec.accent}`} />
            <div>
              <input
                className="propertyTitleInput"
                value={node.label || spec.displayName}
                onChange={(event) => workflow.updateNode(node.id, { label: event.target.value })}
              />
              <input
                className="propertyDescInput"
                value={node.description || ""}
                onChange={(event) => workflow.updateNode(node.id, { description: event.target.value })}
                placeholder={`${spec.displayName} · 双击画布节点可编辑名称和描述`}
              />
            </div>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="关闭属性"><X size={17} /></button>
        </header>
        <div className="propertyPanelBody">
          <section className="propertySection ioSection">
            <div className="propertySectionTitle"><Braces size={15} /><strong>输入</strong></div>
            <NodeInputMappings node={node} workflow={workflow} />
          </section>

          <section className="propertySection">
            <div className="propertySectionTitle"><PanelRight size={15} /><strong>{spec.displayName}配置</strong></div>
            <NodeConfigFields
              node={node}
              nodes={workflow.nodes}
              edges={workflow.edges}
              modelOptions={workflow.modelOptions}
              apps={workflow.apps}
              datasets={workflow.datasets}
              tools={workflow.tools}
              updateNodeConfig={workflow.updateNodeConfig}
            />
          </section>

          <NodeOutputSection node={node} workflow={workflow} />
          <NodeRuntimeSection node={node} workflow={workflow} />

          <details className="advancedNodeDetails propertyAdvanced">
            <summary><Edit3 size={14} /> 高级信息</summary>
            <Field label="节点 ID"><input value={node.id} readOnly /></Field>
            <Field label="内部类型"><input value={node.type} readOnly /></Field>
            <Field label="原始配置 JSON"><textarea value={JSON.stringify({ inputs: node.inputs, config: node.config, outputs: node.outputs, runtime: node.runtime }, null, 2)} readOnly /></Field>
          </details>

          <button className="dangerBtn" disabled={node.id === "start" || node.id === "end"} onClick={() => workflow.removeNode(node.id)}>
            <Trash2 size={16} /> 删除节点
          </button>
        </div>
      </section>
    );
  }

  if (workflow.selectedEdge) {
    const edge = workflow.selectedEdge;
    const variables = availableVariablesForNode({
      currentNodeId: edge.to,
      nodes: workflow.nodes,
      edges: workflow.edges,
    });
    return (
      <section className="workflowPropertyPanel edgePropertyPanel" aria-label="连线属性弹窗">
        <header className="propertyPanelHeader">
          <div className="propertyPanelTitle">
            <span className="dot blue" />
            <div>
              <h3>连线属性</h3>
              <p>{edge.from} → {edge.to}</p>
            </div>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="关闭属性"><X size={17} /></button>
        </header>
        <div className="propertyPanelBody">
          <section className="propertySection">
            <div className="propertySectionTitle"><PanelRight size={15} /><strong>条件</strong></div>
            <WorkflowConfigInput
              label="条件表达式"
              hint="为空表示默认通过；可插入上游节点、流程输入和系统变量。"
              mode="variable"
              value={edge.condition || ""}
              variables={variables}
              placeholder="{{nodes.confirm.action == 'approve'}}"
              onChange={(value) => workflow.updateEdge(edge.id, value)}
            />
          </section>
          <button className="dangerBtn" onClick={() => workflow.removeEdge(edge.id)}><Trash2 size={16} /> 删除连线</button>
        </div>
      </section>
    );
  }

  return null;
}
