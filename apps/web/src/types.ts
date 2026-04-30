import type { PointerEvent, RefObject } from "react";

export type AppKind = "agent" | "workflow";
export type AgentMode = "agent";
export type CenterView =
  | "center"
  | "designer"
  | "experience"
  | "api"
  | "observability"
  | "knowledge"
  | "tasks"
  | "providers"
  | "apiKeys"
  | "org";
export type RouteState =
  | { view: "center" }
  | { view: "designer"; appId: string }
  | { view: "experience"; appId: string }
  | { view: "api"; appId: string }
  | { view: "observability"; appId?: string }
  | { view: "knowledge" }
  | { view: "tasks" }
  | { view: "providers" }
  | { view: "apiKeys" }
  | { view: "org" };
export type AppRecord = {
  id: string;
  name: string;
  type: AppKind;
  description?: string;
  status: string;
  visibility?: string;
  updatedAt?: string;
  publishedVersionId?: string | null;
};
export type AppVersion = {
  id: string;
  versionNo: number;
  definitionJson: string;
};
export type AppDraft = {
  id: string;
  appId: string;
  baseVersionId?: string | null;
  definitionJson: string;
  validationJson?: string | null;
  revision: number;
  dirty: boolean;
  autosavedBy?: string | null;
  autosavedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type DraftValidationResponse = {
  draft: AppDraft;
  report: ValidationReport;
};
export type DraftPublishResponse = {
  app: AppRecord;
  version: AppVersion;
  draft: AppDraft;
  report: ValidationReport;
};
export type DraftRunResponse = {
  draft: AppDraft;
  runId: string;
  runType: string;
  status: string;
  currentWaitTaskId?: string | null;
  errorMessage?: string | null;
  outputs: Record<string, unknown>;
};
export type AgentDraft = {
  mode: AgentMode;
  providerAccountId: string;
  model: string;
  knowledgeDatasetIds: string[];
  knowledgeTopK: number;
  knowledgeScoreThreshold: number;
  system: string;
  temperature: number;
  opening: string;
  toolPlan: string;
  textTemplate: string;
  memoryEnabled: boolean;
  memoryWindowMessages: number;
};
export type WorkflowNodeType =
  | "start"
  | "llm"
  | "agent"
  | "tool"
  | "http_request"
  | "knowledge_retrieval"
  | "user_confirm"
  | "user_form"
  | "condition"
  | "variable"
  | "code"
  | "end";
export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description?: string;
  x: number;
  y: number;
  inputs?: WorkflowNodeInput[];
  outputs?: WorkflowNodeOutput;
  runtime?: WorkflowNodeRuntime;
  config: Record<string, unknown>;
};
export type WorkflowNodeInput = {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  value: string;
};
export type WorkflowNodeOutput = {
  format: "text" | "json";
  value: string;
};
export type WorkflowNodeRuntime = {
  timeoutSeconds: number;
  retry: { maxAttempts: number };
};
export type WorkflowAddNodeOptions = {
  position?: { x: number; y: number };
  connectFrom?: string;
  connectTo?: string;
  replaceEdgeId?: string;
};
export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  condition?: string;
};
export type DragState = { nodeId: string; offsetX: number; offsetY: number };
export type ConnectState = { from: string; x: number; y: number };
export type WorkflowDesignerProps = {
  canvasRef: RefObject<HTMLDivElement>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  apps?: AppRecord[];
  datasets?: DatasetRecord[];
  tools?: ToolRecord[];
  modelOptions?: ModelOption[];
  connecting: ConnectState | null;
  selectedNode?: WorkflowNode;
  selectedEdge?: WorkflowEdge;
  workflowDefinition: Record<string, unknown>;
  addNode: (type: WorkflowNodeType, options?: WorkflowAddNodeOptions) => void;
  connectNodes: (from: string, to: string) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, condition: string) => void;
  updateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  updateNodeInput: (nodeId: string, index: number, patch: Partial<WorkflowNodeInput>) => void;
  addNodeInput: (nodeId: string) => void;
  removeNodeInput: (nodeId: string, index: number) => void;
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
  updateNodeOutput: (nodeId: string, patch: Partial<WorkflowNodeOutput>) => void;
  updateNodeRuntime: (nodeId: string, patch: Partial<WorkflowNodeRuntime>) => void;
  startDrag: (event: PointerEvent, node: WorkflowNode) => void;
  startConnect: (event: PointerEvent, node: WorkflowNode) => void;
  finishConnect: (event: PointerEvent, targetId: string) => void;
  moveOnCanvas: (event: PointerEvent) => void;
  stopCanvasInteraction: () => void;
  autoLayout: () => void;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
};
export type RunRecord = {
  runId: string;
  appId: string;
  appName: string;
  appType: AppKind;
  appVersionId?: string;
  runType: AppKind;
  status: string;
  currentWaitTaskId?: string;
  totalTokens?: number;
  latencyMs?: number;
  errorMessage?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};
export type TraceRecord = {
  id: string;
  runId: string;
  type: string;
  name: string;
  status: string;
  latencyMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  token?: Record<string, unknown>;
  errorMessage?: string;
  createdAt?: string;
};
export type ValidationIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  title: string;
  detail: string;
  target: string;
};
export type ValidationReport = {
  appType: AppKind;
  passed: boolean;
  blockingErrors: number;
  warnings: number;
  suggestions: number;
  issues: ValidationIssue[];
};
export type DatasetRecord = {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  name: string;
  description?: string;
  status: string;
  embeddingProviderId?: string;
  embeddingModel?: string;
  chunkStrategy?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type ToolRecord = {
  id: string;
  tenantId?: string;
  workspaceId?: string;
  name: string;
  type: string;
  description?: string;
  inputSchema?: string;
  configJson?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};
export type DocumentRecord = {
  id: string;
  datasetId: string;
  name: string;
  sourceType: string;
  objectKey?: string;
  contentText?: string;
  parseStatus: string;
  indexStatus: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type ChunkRecord = {
  id: string;
  documentId: string;
  chunkNo: number;
  content: string;
  contentChars: number;
  tokenCount?: number;
  metadata?: string;
  vectorId?: string;
  vectorStatus?: string;
  embeddingProviderId?: string;
  embeddingModel?: string;
  embeddingDimension?: number;
  createdAt?: string;
};
export type ChunkInspectResponse = {
  document: DocumentRecord;
  dataset: DatasetRecord;
  parse: {
    source_type?: string;
    dataset_strategy?: string;
    actual_strategy?: string;
    algorithm?: string;
    chunk_size?: number;
    source_chars?: number;
    total_chunks?: number;
    parse_status?: string;
    index_status?: string;
    embedding_provider_id?: string;
    embedding_model?: string;
    vector_status?: string;
    vector_note?: string;
    embedded_chunks?: number;
  };
  chunks: ChunkRecord[];
};
export type RetrieveRecord = {
  chunk_id: string;
  document_id: string;
  content: string;
  score: number;
  metadata?: string;
};
export type WaitTaskRecord = {
  id: string;
  appId: string;
  appName: string;
  appType: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  title?: string;
  description?: string;
  status: string;
  actions?: unknown;
  context?: Record<string, unknown>;
  submitResult?: Record<string, unknown>;
  expiresAt?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
export type TenantRecord = {
  id: string;
  name: string;
  code: string;
  plan: string;
  status: string;
  createdAt?: string;
};
export type WorkspaceRecord = {
  id: string;
  tenantId: string;
  name: string;
  status: string;
  createdAt?: string;
};
export type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  workspaceIds: string[];
  createdAt?: string;
};
export type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  workspaceId?: string;
  appId?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt?: string;
  revokedAt?: string;
};
export type UsageSummary = {
  applications: number;
  publishedApps: number;
  datasets: number;
  documents: number;
  apiKeys: number;
  runs: number;
  failedRuns: number;
  waitingRuns: number;
  waitTasks: number;
  pendingWaitTasks: number;
  totalTokens: number;
  averageLatencyMs: number;
};
export type AuditEvent = {
  id: string;
  type: string;
  title: string;
  detail: string;
  actor: string;
  target: string;
  createdAt?: string;
};
export type ProviderRecord = {
  id: string;
  tenantId: string;
  workspaceId?: string;
  name: string;
  providerType: string;
  baseUrl: string;
  hasApiKey: boolean;
  defaultChatModel?: string;
  defaultEmbeddingModel?: string;
  configJson?: string;
  llmBaseUrl?: string;
  hasLlmApiKey: boolean;
  llmModel?: string;
  llmConfigJson?: string;
  embeddingBaseUrl?: string;
  hasEmbeddingApiKey: boolean;
  embeddingModel?: string;
  embeddingConfigJson?: string;
  rerankBaseUrl?: string;
  hasRerankApiKey: boolean;
  rerankModel?: string;
  rerankConfigJson?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};
export type ProviderForm = {
  name: string;
  providerType: string;
  baseUrl: string;
  apiKey: string;
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  configJson: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  llmConfigJson: string;
  embeddingBaseUrl: string;
  embeddingApiKey: string;
  embeddingModel: string;
  embeddingConfigJson: string;
  rerankBaseUrl: string;
  rerankApiKey: string;
  rerankModel: string;
  rerankConfigJson: string;
};
export type ModelOption = {
  providerId: string;
  providerName: string;
  model: string;
};
export type AuthSession = {
  token: string;
  userId: string;
  displayName?: string;
  role?: string;
  tenantId: string;
  workspaceId: string;
  expiresAt: number;
};
export type RuntimeWaitTask = {
  id: string;
  run_id: string;
  status: string;
  type?: string;
  title?: string;
  description?: string;
  actions?: unknown;
  context?: Record<string, unknown>;
  expires_at?: string;
};
export type RuntimeResponse = {
  run_id: string;
  status: string;
  answer?: string;
  conversation_id?: string;
  knowledge?: RetrieveRecord[];
  usage?: RuntimeUsage;
  outputs?: Record<string, unknown>;
  wait_task?: RuntimeWaitTask;
};
export type RuntimeUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};
export type WaitSubmitResponse = {
  wait_task_id: string;
  run_id: string;
  wait_task_status: string;
  run_status: string;
  next_wait_task?: RuntimeWaitTask;
};
export type RuntimeRunResponse = {
  run_id: string;
  status: string;
  current_wait_task_id?: string;
  outputs?: Record<string, unknown>;
};
export type ExperienceMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "wait";
  text: string;
  meta?: string;
  runId?: string;
  status?: string;
  conversationId?: string;
  knowledge?: RetrieveRecord[];
  usage?: RuntimeUsage;
  streaming?: boolean;
  waitTask?: RuntimeWaitTask;
};
