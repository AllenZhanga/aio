import { Braces, FileJson, Type } from "lucide-react";
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
        <div className="outputFormatSwitch" role="tablist" aria-label="输出格式">
          <button
            type="button"
            className={output.format === "text" ? "active" : ""}
            title="文本"
            aria-label="文本"
            onClick={() => workflow.updateNodeOutput(node.id, { format: "text" })}
          >
            <Type size={13} />
            <span>文本</span>
          </button>
          <button
            type="button"
            className={output.format === "json" ? "active" : ""}
            title="JSON"
            aria-label="JSON"
            onClick={() => workflow.updateNodeOutput(node.id, { format: "json" })}
          >
            <FileJson size={13} />
            <span>JSON</span>
          </button>
        </div>
        <WorkflowConfigInput
          label="输出值"
          mode={output.format === "json" ? "json" : "plain"}
          value={output.value}
          variables={variables}
          placeholder={output.format === "json" ? "{\"answer\":\"{{nodes.answer.text}}\"}" : "{{nodes.answer.text}}"}
          hideModeToolbar
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
