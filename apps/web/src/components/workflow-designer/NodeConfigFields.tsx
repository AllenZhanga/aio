import type { WorkflowNode } from "../../types";
import { Field } from "../ui";
import { nodePlugin } from "./nodeRegistry";
import type { WorkflowConfigField } from "./nodeSpecs";

export function NodeConfigFields({
  node,
  updateNodeConfig,
}: {
  node: WorkflowNode;
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  const plugin = nodePlugin(node.type);
  if (plugin.renderConfig) {
    const CustomConfig = plugin.renderConfig;
    return <CustomConfig node={node} updateNodeConfig={updateNodeConfig} />;
  }
  if (!plugin.spec.configFields.length) {
    return <p className="mutedText">该节点暂无专属配置。</p>;
  }
  return (
    <>
      {plugin.spec.configFields.map((field) => (
        <ConfigField
          key={field.key}
          field={field}
          value={configValueToString(node.config[field.key])}
          onChange={(value) => updateNodeConfig(node.id, field.key, value)}
        />
      ))}
    </>
  );
}

function ConfigField({ field, value, onChange }: { field: WorkflowConfigField; value: string; onChange: (value: string) => void }) {
  if (field.kind === "select") {
    return (
      <Field label={field.label} hint={field.hint}>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {(field.options || []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </Field>
    );
  }
  if (field.kind === "number") {
    return (
      <Field label={field.label} hint={field.hint}>
        <input type="number" value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  if (field.kind === "textarea" || field.kind === "json" || field.kind === "variableExpr") {
    return (
      <Field label={field.label} hint={field.hint || (field.kind === "variableExpr" ? "支持 {{inputs.question}}、{{nodes.nodeId.field}} 等变量引用" : undefined)}>
        <textarea value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
      </Field>
    );
  }
  return (
    <Field label={field.label} hint={field.hint}>
      <input value={value} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function configValueToString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
