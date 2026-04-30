import type { ReactNode } from "react";
import { Bot, Braces, Code2, Database, GitBranch, Globe2, MessageSquare, PlayCircle, StopCircle, UserCheck, Variable, Wrench } from "lucide-react";
import type { WorkflowNodeType } from "../../types";

export type WorkflowFieldKind =
  | "text"
  | "number"
  | "select"
  | "textarea"
  | "json"
  | "variableExpr";

export type WorkflowConfigField = {
  key: string;
  label: string;
  kind: WorkflowFieldKind;
  placeholder?: string;
  hint?: string;
  options?: Array<{ label: string; value: string }>;
};

export type WorkflowNodeSpec = {
  type: WorkflowNodeType;
  displayName: string;
  category: "basic" | "ai" | "knowledge" | "tool" | "control" | "human" | "output";
  description: string;
  icon: ReactNode;
  accent: string;
  defaultLabel: string;
  defaultConfig: Record<string, unknown>;
  inputSummary: string[];
  outputSummary: string[];
  configFields: WorkflowConfigField[];
};

export const nodeSpecs: Record<WorkflowNodeType, WorkflowNodeSpec> = {
  start: {
    type: "start",
    displayName: "开始",
    category: "basic",
    description: "流程入口，接收调用输入",
    icon: <PlayCircle size={17} />,
    accent: "green",
    defaultLabel: "开始",
    defaultConfig: {},
    inputSummary: [],
    outputSummary: ["inputs"],
    configFields: [],
  },
  llm: {
    type: "llm",
    displayName: "大模型",
    category: "ai",
    description: "调用大语言模型生成内容",
    icon: <MessageSquare size={17} />,
    accent: "blue",
    defaultLabel: "生成回复",
    defaultConfig: { providerAccountId: "", chatModel: "", systemPrompt: "你是工作流中的 LLM 节点。", userPrompt: "请根据输入给出处理建议：{{input.prompt}}", temperature: 0.3 },
    inputSummary: ["prompt"],
    outputSummary: ["text", "usage"],
    configFields: [
      { key: "providerAccountId", label: "模型供应商", kind: "text", placeholder: "选择或填写供应商账号 ID" },
      { key: "chatModel", label: "模型", kind: "text", placeholder: "例如 qwen-plus / gpt-4.1" },
      { key: "systemPrompt", label: "系统提示词", kind: "textarea", placeholder: "你是工作流中的 LLM 节点。" },
      { key: "userPrompt", label: "用户提示词", kind: "variableExpr", placeholder: "{{input.prompt}}" },
      { key: "temperature", label: "创造性", kind: "number", hint: "建议 0 到 1，数值越高输出越发散。" },
    ],
  },
  agent: {
    type: "agent",
    displayName: "智能体",
    category: "ai",
    description: "调用已发布智能体应用",
    icon: <Bot size={17} />,
    accent: "blue",
    defaultLabel: "调用智能体",
    defaultConfig: { query: "{{input.query}}" },
    inputSummary: ["query"],
    outputSummary: ["answer", "outputs"],
    configFields: [
      { key: "query", label: "输入问题", kind: "variableExpr", placeholder: "{{inputs.question}}" },
    ],
  },
  tool: {
    type: "tool",
    displayName: "工具调用",
    category: "tool",
    description: "调用平台工具或外部能力",
    icon: <Wrench size={17} />,
    accent: "amber",
    defaultLabel: "工具调用",
    defaultConfig: { toolId: "", input: "{{input.input}}" },
    inputSummary: ["input"],
    outputSummary: ["output", "latencyMs"],
    configFields: [
      { key: "toolId", label: "工具 ID", kind: "text" },
      { key: "input", label: "工具入参", kind: "variableExpr" },
    ],
  },
  http_request: {
    type: "http_request",
    displayName: "HTTP 请求",
    category: "tool",
    description: "请求外部 HTTP API",
    icon: <Globe2 size={17} />,
    accent: "amber",
    defaultLabel: "HTTP 请求",
    defaultConfig: { url: "https://example.com/webhook", method: "POST", headers: {}, query: {}, body: "{{input.body}}" },
    inputSummary: ["url", "body"],
    outputSummary: ["status", "body", "headers"],
    configFields: [
      { key: "url", label: "URL", kind: "text" },
      { key: "method", label: "Method", kind: "select", options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((value) => ({ label: value, value })) },
      { key: "headers", label: "Headers", kind: "json", hint: "请求头键值对，可引用 inputs、metadata、vars、nodes、sys。" },
      { key: "query", label: "Query", kind: "json", hint: "URL 查询参数键值对。" },
      { key: "body", label: "Body", kind: "variableExpr" },
    ],
  },
  knowledge_retrieval: {
    type: "knowledge_retrieval",
    displayName: "知识检索",
    category: "knowledge",
    description: "从知识库召回片段",
    icon: <Database size={17} />,
    accent: "green",
    defaultLabel: "知识检索",
    defaultConfig: { datasetId: "", query: "{{input.query}}", topK: 5, scoreThreshold: 0 },
    inputSummary: ["query"],
    outputSummary: ["chunks", "query"],
    configFields: [
      { key: "datasetId", label: "知识库 ID", kind: "text" },
      { key: "query", label: "检索问题", kind: "variableExpr" },
      { key: "topK", label: "Top K", kind: "number" },
      { key: "scoreThreshold", label: "Score 阈值", kind: "number" },
    ],
  },
  user_confirm: {
    type: "user_confirm",
    displayName: "人工确认",
    category: "human",
    description: "暂停流程等待人工确认",
    icon: <UserCheck size={17} />,
    accent: "red",
    defaultLabel: "人工确认",
    defaultConfig: {
      title: "确认处理方案",
      description: "{{input.description}}",
      actions: [{ key: "approve", label: "确认" }, { key: "reject", label: "拒绝" }],
      expiresInSeconds: 86400,
    },
    inputSummary: ["description"],
    outputSummary: ["action", "submittedBy", "comment"],
    configFields: [
      { key: "title", label: "标题", kind: "text" },
      { key: "description", label: "说明", kind: "textarea", hint: "默认使用本节点输入变量 {{input.description}}。" },
      { key: "actions", label: "动作按钮", kind: "json", hint: "确认按钮列表，例如 [{\"key\":\"approve\",\"label\":\"确认\"}]" },
      { key: "expiresInSeconds", label: "超时秒数", kind: "number" },
    ],
  },
  user_form: {
    type: "user_form",
    displayName: "人工表单",
    category: "human",
    description: "暂停流程等待表单提交",
    icon: <Braces size={17} />,
    accent: "red",
    defaultLabel: "人工表单",
    defaultConfig: { title: "补充信息", description: "{{input.description}}", formSchema: { type: "object", properties: { comment: { type: "string", title: "备注" } } } },
    inputSummary: ["formSchema"],
    outputSummary: ["values", "submittedBy"],
    configFields: [
      { key: "title", label: "标题", kind: "text" },
      { key: "description", label: "说明", kind: "textarea", hint: "默认使用本节点输入变量 {{input.description}}。" },
      { key: "formSchema", label: "表单 Schema", kind: "json" },
    ],
  },
  condition: {
    type: "condition",
    displayName: "条件分支",
    category: "control",
    description: "按表达式选择后续路径",
    icon: <GitBranch size={17} />,
    accent: "violet",
    defaultLabel: "条件分支",
    defaultConfig: { expression: "{{input.expression == 'approve'}}" },
    inputSummary: ["expression"],
    outputSummary: ["true", "false", "else"],
    configFields: [
      { key: "expression", label: "条件表达式", kind: "variableExpr" },
    ],
  },
  variable: {
    type: "variable",
    displayName: "变量赋值",
    category: "basic",
    description: "写入流程级变量",
    icon: <Variable size={17} />,
    accent: "slate",
    defaultLabel: "变量赋值",
    defaultConfig: { name: "answerText", type: "string", value: "{{input.value}}" },
    inputSummary: ["value"],
    outputSummary: ["vars"],
    configFields: [
      { key: "name", label: "变量名", kind: "text", placeholder: "answerText" },
      { key: "type", label: "变量类型", kind: "select", options: ["string", "number", "boolean", "object", "array"].map((value) => ({ label: value, value })) },
      { key: "value", label: "变量值", kind: "variableExpr" },
    ],
  },
  code: {
    type: "code",
    displayName: "代码执行",
    category: "control",
    description: "执行受控脚本逻辑",
    icon: <Code2 size={17} />,
    accent: "violet",
    defaultLabel: "代码执行",
    defaultConfig: { language: "javascript", code: "return inputs;" },
    inputSummary: ["code"],
    outputSummary: ["result"],
    configFields: [
      { key: "language", label: "语言", kind: "select", options: [{ label: "JavaScript", value: "javascript" }] },
      { key: "code", label: "代码", kind: "textarea" },
    ],
  },
  end: {
    type: "end",
    displayName: "结束",
    category: "output",
    description: "生成流程最终输出",
    icon: <StopCircle size={17} />,
    accent: "slate",
    defaultLabel: "结束",
    defaultConfig: { output: "{{input.output}}" },
    inputSummary: ["output"],
    outputSummary: ["outputs"],
    configFields: [
      { key: "output", label: "最终输出", kind: "variableExpr" },
    ],
  },
};

export const nodeCategoryLabels: Record<WorkflowNodeSpec["category"], string> = {
  basic: "基础",
  ai: "AI",
  knowledge: "知识",
  tool: "工具",
  control: "控制",
  human: "人工",
  output: "输出",
};

export function nodeSpec(type: WorkflowNodeType) {
  return nodeSpecs[type];
}
