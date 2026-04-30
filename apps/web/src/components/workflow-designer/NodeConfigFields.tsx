import type { WorkflowEdge, ModelOption, WorkflowNode } from "../../types";
import { Field } from "../ui";
import { WorkflowConfigInput } from "./WorkflowConfigInput";
import { nodePlugin } from "./nodeRegistry";
import type { WorkflowConfigField } from "./nodeSpecs";
import { availableVariablesForNode, type WorkflowVariableOption } from "./workflowVariables";

export function NodeConfigFields({
  node,
  nodes,
  edges,
  modelOptions = [],
  updateNodeConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  modelOptions?: ModelOption[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  const plugin = nodePlugin(node.type);
  const variables = availableVariablesForNode({ currentNodeId: node.id, nodes, edges, includeCurrentInputs: true });
  if (node.type === "llm") {
    return <LlmConfigFields node={node} variables={variables} modelOptions={modelOptions} updateNodeConfig={updateNodeConfig} />;
  }
  if (plugin.renderConfig) {
    const CustomConfig = plugin.renderConfig;
    return <CustomConfig node={node} nodes={nodes} edges={edges} variables={variables} updateNodeConfig={updateNodeConfig} />;
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
          variables={variables}
          onChange={(value) => updateNodeConfig(node.id, field.key, value)}
        />
      ))}
    </>
  );
}

function LlmConfigFields({
  node,
  variables,
  modelOptions,
  updateNodeConfig,
}: {
  node: WorkflowNode;
  variables: WorkflowVariableOption[];
  modelOptions: ModelOption[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  const providerId = configValueToString(node.config.providerAccountId);
  const providerModels = modelOptions.filter((option) => option.providerId === providerId);
  const models = providerModels.length ? providerModels.map((option) => option.model) : modelOptions.map((option) => option.model);
  return (
    <div className="llmConfigFields">
      <div className="formGrid two compactGrid">
        <Field label="模型供应商">
          <select
            value={providerId}
            onChange={(event) => {
              const nextProvider = event.target.value;
              const firstModel = modelOptions.find((option) => option.providerId === nextProvider)?.model || "";
              updateNodeConfig(node.id, "providerAccountId", nextProvider);
              updateNodeConfig(node.id, "chatModel", firstModel);
            }}
          >
            <option value="">请选择供应商</option>
            {modelOptions.map((option) => (
              <option key={option.providerId} value={option.providerId}>{option.providerName}</option>
            ))}
          </select>
        </Field>
        <Field label="模型">
          <select value={configValueToString(node.config.chatModel)} onChange={(event) => updateNodeConfig(node.id, "chatModel", event.target.value)}>
            <option value="">请选择模型</option>
            {models.map((model) => <option key={model} value={model}>{model}</option>)}
          </select>
        </Field>
      </div>
      <ConfigField
        field={{ key: "systemPrompt", label: "系统提示词", kind: "textarea", hint: "定义模型角色、约束和输出边界。" }}
        value={configValueToString(node.config.systemPrompt)}
        variables={variables}
        onChange={(value) => updateNodeConfig(node.id, "systemPrompt", value)}
      />
      <ConfigField
        field={{ key: "userPrompt", label: "用户提示词", kind: "variableExpr", hint: "建议引用输入区定义的变量，例如 {{input.prompt}}。" }}
        value={configValueToString(node.config.userPrompt)}
        variables={variables}
        onChange={(value) => updateNodeConfig(node.id, "userPrompt", value)}
      />
      <ConfigField
        field={{ key: "temperature", label: "创造性", kind: "number", hint: "建议 0 到 1，数值越高输出越发散。" }}
        value={configValueToString(node.config.temperature)}
        variables={variables}
        onChange={(value) => updateNodeConfig(node.id, "temperature", value)}
      />
    </div>
  );
}

function ConfigField({
  field,
  value,
  variables,
  onChange,
}: {
  field: WorkflowConfigField;
  value: string;
  variables: WorkflowVariableOption[];
  onChange: (value: string) => void;
}) {
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
  if (field.kind === "variableExpr") {
    return (
      <WorkflowConfigInput
        label={field.label}
        hint={field.hint || "支持 {{inputs.question}}、{{nodes.nodeId.field}} 等变量引用"}
        mode="variable"
        value={value}
        placeholder={field.placeholder}
        variables={variables}
        allowVariables
        onChange={onChange}
      />
    );
  }
  if (field.kind === "json") {
    return (
      <WorkflowConfigInput
        label={field.label}
        mode="json"
        value={value}
        placeholder={field.placeholder}
        hint={field.hint || "JSON 配置支持格式化对象和数组，后续会接入 Schema 表单。"}
        variables={variables}
        allowVariables
        onChange={onChange}
      />
    );
  }
  if (field.kind === "textarea") {
    return (
      <WorkflowConfigInput
        label={field.label}
        mode="markdown"
        value={value}
        placeholder={field.placeholder}
        hint={field.hint || "支持 Markdown、富文本和变量混排，当前以 Markdown 编辑器形态展示。"}
        variables={variables}
        allowVariables
        onChange={onChange}
      />
    );
  }
  return (
    <WorkflowConfigInput
      label={field.label}
      hint={field.hint}
      mode="plain"
      value={value}
      placeholder={field.placeholder}
      variables={variables}
      allowVariables={field.key === "url"}
      onChange={onChange}
    />
  );
}

function configValueToString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
