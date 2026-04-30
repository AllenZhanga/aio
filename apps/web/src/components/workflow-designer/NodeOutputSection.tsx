import { Braces } from "lucide-react";
import type { WorkflowDesignerProps, WorkflowNode } from "../../types";
import { WorkflowConfigInput } from "./WorkflowConfigInput";
import { availableVariablesForNode } from "./workflowVariables";

export function NodeOutputSection({ node, workflow }: { node: WorkflowNode; workflow: WorkflowDesignerProps }) {
  const output = node.outputs || { format: "text" as const, value: defaultOutputValue(node) };
  const variables = availableVariablesForNode({ currentNodeId: node.id, nodes: workflow.nodes, edges: workflow.edges, includeCurrentInputs: true });
  return (
    <section className="propertySection ioSection">
      <div className="propertySectionTitle"><Braces size={15} /><strong>输出</strong></div>
      <div className="workflowOutputEditor">
        <div className="segmentedControl compact">
          <button className={output.format === "text" ? "active" : ""} onClick={() => workflow.updateNodeOutput(node.id, { format: "text" })}>文本</button>
          <button className={output.format === "json" ? "active" : ""} onClick={() => workflow.updateNodeOutput(node.id, { format: "json" })}>JSON</button>
        </div>
        <WorkflowConfigInput
          label="输出值"
          mode={output.format === "json" ? "json" : "variable"}
          value={output.value}
          variables={variables}
          placeholder={output.format === "json" ? "{\"answer\":\"{{nodes.answer.text}}\"}" : "{{nodes.answer.text}}"}
          onChange={(value) => workflow.updateNodeOutput(node.id, { value })}
        />
      </div>
    </section>
  );
}

function defaultOutputValue(node: WorkflowNode) {
  if (node.type === "llm") return "{{nodes.self.text}}";
  if (node.type === "end") return "{{input.output}}";
  return "";
}
