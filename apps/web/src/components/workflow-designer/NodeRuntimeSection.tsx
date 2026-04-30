import { AlertTriangle } from "lucide-react";
import type { WorkflowDesignerProps, WorkflowNode } from "../../types";
import { Field } from "../ui";

export function NodeRuntimeSection({ node, workflow }: { node: WorkflowNode; workflow: WorkflowDesignerProps }) {
  const runtime = node.runtime || { timeoutSeconds: 60, retry: { maxAttempts: 0 } };
  return (
    <section className="propertySection runtimeSection">
      <div className="propertySectionTitle"><AlertTriangle size={15} /><strong>异常处理</strong></div>
      <div className="formGrid two compactGrid">
        <Field label="重试次数">
          <input
            type="number"
            min="0"
            max="5"
            value={runtime.retry.maxAttempts}
            onChange={(event) => workflow.updateNodeRuntime(node.id, { retry: { maxAttempts: Number(event.target.value) } })}
          />
        </Field>
        <Field label="超时时间（秒）">
          <input
            type="number"
            min="1"
            value={runtime.timeoutSeconds}
            onChange={(event) => workflow.updateNodeRuntime(node.id, { timeoutSeconds: Number(event.target.value) })}
          />
        </Field>
      </div>
    </section>
  );
}
