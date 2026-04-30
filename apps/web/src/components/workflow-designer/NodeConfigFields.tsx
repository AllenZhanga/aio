import type { AppRecord, DatasetRecord, ModelOption, ToolRecord, WorkflowEdge, WorkflowNode } from "../../types";
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
  apps = [],
  datasets = [],
  tools = [],
  updateNodeConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  modelOptions?: ModelOption[];
  apps?: AppRecord[];
  datasets?: DatasetRecord[];
  tools?: ToolRecord[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  const plugin = nodePlugin(node.type);
  const variables = availableVariablesForNode({ currentNodeId: node.id, nodes, edges, includeCurrentInputs: true });
  if (node.type === "llm") {
    return <LlmConfigFields node={node} variables={variables} modelOptions={modelOptions} updateNodeConfig={updateNodeConfig} />;
  }
  if (node.type === "agent") {
    return <AgentNodeConfigFields node={node} apps={apps} updateNodeConfig={updateNodeConfig} />;
  }
  if (node.type === "knowledge_retrieval") {
    return <KnowledgeNodeConfigFields node={node} datasets={datasets} updateNodeConfig={updateNodeConfig} />;
  }
  if (node.type === "tool") {
    return <ToolNodeConfigFields node={node} variables={variables} tools={tools} updateNodeConfig={updateNodeConfig} />;
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

function AgentNodeConfigFields({
  node,
  apps,
  updateNodeConfig,
}: {
  node: WorkflowNode;
  apps: AppRecord[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  const agentApps = apps.filter((app) => app.type === "agent" && app.status !== "archived");
  return (
    <div className="nodeSpecificFields">
      <Field label="智能体应用" hint="选择已创建的 Agent，运行时会把输入区的 query 交给该智能体。">
        <select value={configValueToString(node.config.appId)} onChange={(event) => updateNodeConfig(node.id, "appId", event.target.value)}>
          <option value="">请选择智能体应用</option>
          {agentApps.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
        </select>
      </Field>
      <div className="nodeOutputHint">
        <strong>输出</strong>
        <span>{`{{nodes.${node.id}.answer}}`}</span>
        <span>{`{{nodes.${node.id}.outputs}}`}</span>
      </div>
    </div>
  );
}

function KnowledgeNodeConfigFields({
  node,
  datasets,
  updateNodeConfig,
}: {
  node: WorkflowNode;
  datasets: DatasetRecord[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  return (
    <div className="nodeSpecificFields">
      <Field label="知识库" hint="选择当前工作空间中可用的数据集。检索问题建议从输入区 query 引用。">
        <select value={configValueToString(node.config.datasetId)} onChange={(event) => updateNodeConfig(node.id, "datasetId", event.target.value)}>
          <option value="">请选择知识库</option>
          {datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
        </select>
      </Field>
      <div className="formGrid two compactGrid">
        <ConfigField field={{ key: "topK", label: "Top K", kind: "number" }} value={configValueToString(node.config.topK)} variables={[]} onChange={(value) => updateNodeConfig(node.id, "topK", value)} />
        <ConfigField field={{ key: "scoreThreshold", label: "Score 阈值", kind: "number" }} value={configValueToString(node.config.scoreThreshold)} variables={[]} onChange={(value) => updateNodeConfig(node.id, "scoreThreshold", value)} />
      </div>
      <div className="nodeOutputHint">
        <strong>输出结构</strong>
        <span>{`{{nodes.${node.id}.chunks}}`}</span>
        <code>{`[{ content, score, metadata, documentId }]`}</code>
      </div>
    </div>
  );
}

function ToolNodeConfigFields({
  node,
  variables,
  tools,
  updateNodeConfig,
}: {
  node: WorkflowNode;
  variables: WorkflowVariableOption[];
  tools: ToolRecord[];
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
}) {
  const selectedTool = tools.find((tool) => tool.id === node.config.toolId);
  return (
    <div className="nodeSpecificFields">
      <Field label="工具插件" hint="选择平台工具或 MCP 同步出的工具。工具制作规范来自工具管理里的 inputSchema 和执行类型。">
        <select value={configValueToString(node.config.toolId)} onChange={(event) => updateNodeConfig(node.id, "toolId", event.target.value)}>
          <option value="">请选择工具</option>
          {tools.filter((tool) => tool.status === "active").map((tool) => <option key={tool.id} value={tool.id}>{tool.name} · {tool.type}</option>)}
        </select>
      </Field>
      <ConfigField
        field={{ key: "input", label: "工具入参", kind: "json", hint: selectedTool?.inputSchema || "按工具 inputSchema 传入 JSON，可引用输入变量。" }}
        value={configValueToString(node.config.input)}
        variables={variables}
        onChange={(value) => updateNodeConfig(node.id, "input", value)}
      />
      <div className="nodeOutputHint">
        <strong>输出</strong>
        <span>{`{{nodes.${node.id}.output}}`}</span>
        <span>{`{{nodes.${node.id}.latency_ms}}`}</span>
      </div>
    </div>
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
