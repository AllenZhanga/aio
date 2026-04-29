import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Bot,
  Boxes,
  ClipboardCheck,
  Code2,
  Database,
  FileText,
  Loader2,
  MousePointer2,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Workflow,
  X,
  Zap
} from "lucide-react";
import "./app-center.css";

type AppKind = "agent" | "workflow";
type AgentMode = "agent";
type CenterView = "center" | "designer" | "experience" | "api" | "observability" | "knowledge" | "tasks" | "providers" | "org";
type RouteState = { view: "center" } | { view: "designer"; appId: string } | { view: "experience"; appId: string } | { view: "api"; appId: string } | { view: "observability"; appId?: string } | { view: "knowledge" } | { view: "tasks" } | { view: "providers" } | { view: "org" };
type AppRecord = {
  id: string;
  name: string;
  type: AppKind;
  status: string;
  visibility?: string;
  updatedAt?: string;
  publishedVersionId?: string | null;
};
type AppVersion = { id: string; versionNo: number; definitionJson: string };
type AgentDraft = {
  mode: AgentMode;
  model: string;
  system: string;
  temperature: number;
  opening: string;
  toolPlan: string;
  textTemplate: string;
};
type WorkflowNodeType = "start" | "llm" | "agent" | "tool" | "http_request" | "knowledge_retrieval" | "user_confirm" | "user_form" | "condition" | "variable" | "code" | "end";
type WorkflowNode = { id: string; type: WorkflowNodeType; label: string; x: number; y: number; config: Record<string, unknown> };
type WorkflowEdge = { id: string; from: string; to: string; condition?: string };
type DragState = { nodeId: string; offsetX: number; offsetY: number };
type ConnectState = { from: string; x: number; y: number };
type RunRecord = {
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
type TraceRecord = {
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
type ValidationIssue = { severity: "error" | "warning" | "info"; code: string; title: string; detail: string; target: string };
type ValidationReport = {
  appType: AppKind;
  passed: boolean;
  blockingErrors: number;
  warnings: number;
  suggestions: number;
  issues: ValidationIssue[];
};
type DatasetRecord = { id: string; name: string; description?: string; status: string; embeddingModel?: string; chunkStrategy?: string; createdAt?: string; updatedAt?: string };
type DocumentRecord = { id: string; datasetId: string; name: string; sourceType: string; parseStatus: string; indexStatus: string; errorMessage?: string; createdAt?: string; updatedAt?: string };
type RetrieveRecord = { chunk_id: string; document_id: string; content: string; score: number; metadata?: string };
type WaitTaskRecord = { id: string; appId: string; appName: string; appType: string; runId: string; nodeId: string; nodeType: string; title?: string; description?: string; status: string; actions?: unknown; context?: Record<string, unknown>; submitResult?: Record<string, unknown>; expiresAt?: string; submittedAt?: string; createdAt?: string; updatedAt?: string };
type TenantRecord = { id: string; name: string; code: string; plan: string; status: string; createdAt?: string };
type WorkspaceRecord = { id: string; tenantId: string; name: string; status: string; createdAt?: string };
type ApiKeyRecord = { id: string; name: string; keyPrefix: string; status: string; workspaceId?: string; appId?: string; expiresAt?: string; createdAt?: string };
type UsageSummary = { applications: number; publishedApps: number; datasets: number; documents: number; apiKeys: number; runs: number; failedRuns: number; waitingRuns: number; waitTasks: number; pendingWaitTasks: number; totalTokens: number; averageLatencyMs: number };
type AuditEvent = { id: string; type: string; title: string; detail: string; actor: string; target: string; createdAt?: string };
type ProviderRecord = { id: string; tenantId: string; workspaceId?: string; name: string; providerType: string; baseUrl: string; hasApiKey: boolean; defaultChatModel?: string; defaultEmbeddingModel?: string; configJson?: string; status: string; createdAt?: string; updatedAt?: string };
type ProviderForm = { name: string; providerType: string; baseUrl: string; apiKey: string; defaultChatModel: string; defaultEmbeddingModel: string; configJson: string };
type AuthSession = { token: string; userId: string; displayName?: string; role?: string; tenantId: string; workspaceId: string; expiresAt: number };
type RuntimeWaitTask = { id: string; run_id: string; status: string; type?: string; title?: string; description?: string; actions?: unknown; context?: Record<string, unknown>; expires_at?: string };
type RuntimeResponse = { run_id: string; status: string; answer?: string; outputs?: Record<string, unknown>; wait_task?: RuntimeWaitTask };
type WaitSubmitResponse = { wait_task_id: string; run_id: string; wait_task_status: string; run_status: string; next_wait_task?: RuntimeWaitTask };
type RuntimeRunResponse = { run_id: string; status: string; current_wait_task_id?: string; outputs?: Record<string, unknown> };
type ExperienceMessage = { id: string; role: "user" | "assistant" | "system" | "wait"; text: string; meta?: string; waitTask?: RuntimeWaitTask };

const baseAdminHeaders = {
  "Content-Type": "application/json",
  "X-Aio-Tenant": "default",
  "X-Aio-Workspace": "default"
};

const agentModes: Array<{ mode: AgentMode; title: string; typeLabel: string; description: string; icon: typeof Bot }> = [
  { mode: "agent", title: "Agent", typeLabel: "智能体", description: "适合自主规划、工具调用、知识问答和任务执行。", icon: Bot }
];

const nodeMeta: Record<WorkflowNodeType, { name: string; description: string; accent: string }> = {
  start: { name: "Start", description: "流程入口", accent: "green" },
  llm: { name: "LLM", description: "模型推理", accent: "blue" },
  agent: { name: "Agent", description: "智能体调用", accent: "blue" },
  tool: { name: "Tool", description: "工具调用", accent: "amber" },
  http_request: { name: "HTTP", description: "HTTP 请求", accent: "amber" },
  knowledge_retrieval: { name: "Knowledge", description: "知识检索", accent: "green" },
  user_confirm: { name: "Confirm", description: "人工确认", accent: "red" },
  user_form: { name: "Form", description: "人工表单", accent: "red" },
  condition: { name: "Branch", description: "条件分支", accent: "violet" },
  variable: { name: "Variable", description: "变量赋值", accent: "slate" },
  code: { name: "Code", description: "代码节点", accent: "violet" },
  end: { name: "End", description: "流程结束", accent: "slate" }
};

const defaultNodes: WorkflowNode[] = [
  { id: "start", type: "start", label: "开始", x: 72, y: 180, config: {} },
  { id: "answer", type: "llm", label: "生成回复", x: 360, y: 130, config: { prompt: "请基于输入给出处理建议：{{inputs.question}}" } },
  {
    id: "confirm",
    type: "user_confirm",
    label: "人工确认",
    x: 650,
    y: 180,
    config: {
      title: "确认处理方案",
      description: "{{answer.text}}",
      actions: [{ key: "approve", label: "确认" }, { key: "reject", label: "拒绝" }],
      expiresInSeconds: 86400
    }
  },
  { id: "end", type: "end", label: "结束", x: 940, y: 180, config: { output: "{{answer.text}}" } }
];

const defaultEdges: WorkflowEdge[] = [
  { id: "edge_start_answer", from: "start", to: "answer" },
  { id: "edge_answer_confirm", from: "answer", to: "confirm" },
  { id: "edge_confirm_end", from: "confirm", to: "end", condition: "{{confirm.action == 'approve'}}" }
];

const defaultAgentDraft: AgentDraft = {
  mode: "agent",
  model: "",
  system: "你是企业内部知识助手，回答要简洁、准确、可执行。",
  temperature: 0.3,
  opening: "你好，我可以帮你处理知识问答、售后咨询和流程指引。",
  toolPlan: "优先理解任务 → 检索知识 → 必要时调用工具 → 给出结论和下一步。",
  textTemplate: "请根据以下输入生成结构化内容：{{query}}"
};

const nodeSize = { width: 218, height: 92 };

export default function App() {
  const [view, setView] = useState<CenterView>("center");
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState("");
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [filter, setFilter] = useState<"all" | AppKind>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("应用中心已就绪");
  const [runtimeKey, setRuntimeKey] = useState(localStorage.getItem("aio.runtimeKey") || "");
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<AppKind>("agent");
  const [createMode, setCreateMode] = useState<AgentMode>("agent");
  const [createName, setCreateName] = useState("");
  const [agentDraft, setAgentDraft] = useState<AgentDraft>(defaultAgentDraft);
  const [nodes, setNodes] = useState<WorkflowNode[]>(defaultNodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(defaultEdges);
  const [selectedNodeId, setSelectedNodeId] = useState("answer");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [connecting, setConnecting] = useState<ConnectState | null>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [runsError, setRunsError] = useState("");
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [releasePanelOpen, setReleasePanelOpen] = useState(false);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [retrieveQuery, setRetrieveQuery] = useState("退款政策");
  const [retrieveRecords, setRetrieveRecords] = useState<RetrieveRecord[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [newDatasetName, setNewDatasetName] = useState("企业知识库");
  const [newDocumentText, setNewDocumentText] = useState("退款政策：客户可在 7 天内申请退款。请先核验订单状态，再确认处理方案。");
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [waitTasks, setWaitTasks] = useState<WaitTaskRecord[]>([]);
  const [waitTaskFilter, setWaitTaskFilter] = useState("all");
  const [waitTasksLoading, setWaitTasksLoading] = useState(false);
  const [waitTasksError, setWaitTasksError] = useState("");
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState("");
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState("");
  const [providerForm, setProviderForm] = useState<ProviderForm>({ name: "OpenAI Compatible", providerType: "openai_compatible", baseUrl: "https://api.openai.com/v1", apiKey: "", defaultChatModel: "gpt-4o-mini", defaultEmbeddingModel: "text-embedding-3-small", configJson: "{}" });
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => readStoredConsoleSession());
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [experienceMessages, setExperienceMessages] = useState<ExperienceMessage[]>([]);
  const [experienceInput, setExperienceInput] = useState("请帮我处理一个退款咨询");
  const [experienceFeedback, setExperienceFeedback] = useState("确认继续");
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selectedApp = useMemo(() => apps.find((item) => item.id === selectedAppId), [apps, selectedAppId]);
  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((item) => item.id === selectedEdgeId), [edges, selectedEdgeId]);
  const selectedRun = useMemo(() => runs.find((item) => item.runId === selectedRunId), [runs, selectedRunId]);
  const workflowDefinition = useMemo(() => buildWorkflowDefinition(nodes, edges), [nodes, edges]);
  const visibleApps = useMemo(() => apps.filter((app) => (filter === "all" || app.type === filter) && (!query || app.name.toLowerCase().includes(query.toLowerCase()) || app.id.includes(query))), [apps, filter, query]);
  const modelOptions = useMemo(() => {
    const values = providers.flatMap((provider) => [provider.defaultChatModel, provider.defaultEmbeddingModel]).filter((value): value is string => !!value && !!value.trim());
    return Array.from(new Set(values.length ? values : [""]));
  }, [providers]);

  useEffect(() => {
    const applyRoute = () => {
      const route = parseRoute();
      if (route.view === "designer" || route.view === "api") {
        setSelectedAppId(route.appId);
        setView(route.view);
      } else if (route.view === "experience") {
        setSelectedAppId(route.appId);
        setView(route.view);
      } else if (route.view === "observability") {
        setSelectedAppId(route.appId || "");
        setView(route.view);
      } else if (route.view === "knowledge" || route.view === "tasks" || route.view === "providers" || route.view === "org") {
        setSelectedAppId("");
        setView(route.view);
      } else {
        setSelectedAppId("");
        setView("center");
      }
    };
    applyRoute();
    window.addEventListener("hashchange", applyRoute);
    return () => window.removeEventListener("hashchange", applyRoute);
  }, []);
  useEffect(() => { if (authSession) { void refreshApps(); void refreshProviders(); void refreshWorkspaceOptions(); } else setAppsLoading(false); }, [authSession?.token]);
  useEffect(() => { if (authSession && selectedApp) void loadAppDefinition(selectedApp); }, [authSession?.token, selectedApp?.id]);
  useEffect(() => { if (runtimeKey) localStorage.setItem("aio.runtimeKey", runtimeKey); }, [runtimeKey]);
  useEffect(() => { if (authSession && view === "observability") void refreshRuns(selectedAppId || undefined); }, [authSession?.token, view, selectedAppId]);
  useEffect(() => { if (authSession && view === "observability" && selectedRunId) void loadRunTraces(selectedRunId); }, [authSession?.token, view, selectedRunId]);
  useEffect(() => { if (authSession && view === "knowledge") void refreshKnowledge(); }, [authSession?.token, view]);
  useEffect(() => { if (authSession && view === "tasks") void refreshWaitTasks(); }, [authSession?.token, view, waitTaskFilter]);
  useEffect(() => { if (authSession && view === "providers") void refreshProviders(); }, [authSession?.token, view]);
  useEffect(() => { if (authSession && view === "org") void refreshOrgOps(); }, [authSession?.token, view]);

  async function call<T>(path: string, init: RequestInit = {}, runtime = false): Promise<T> {
    const headers = runtime ? { "Content-Type": "application/json", Authorization: `Bearer ${runtimeKey}` } : { ...baseAdminHeaders, Authorization: `Bearer ${authSession?.token || ""}`, "X-Aio-Tenant": authSession?.tenantId || "default", "X-Aio-Workspace": authSession?.workspaceId || "default" };
    const response = await fetch(path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    if (!runtime && response.status === 401) {
      clearStoredConsoleSession();
      setAuthSession(null);
      throw new Error("登录已过期，请重新登录");
    }
    if (!response.ok) throw new Error(body?.message || body?.error || response.statusText);
    return body as T;
  }

  async function uploadForm<T>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${authSession?.token || ""}`, "X-Aio-Tenant": authSession?.tenantId || "default", "X-Aio-Workspace": authSession?.workspaceId || "default" },
      body: formData
    });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    if (response.status === 401) {
      clearStoredConsoleSession();
      setAuthSession(null);
      throw new Error("登录已过期，请重新登录");
    }
    if (!response.ok) throw new Error(body?.message || body?.error || response.statusText);
    return body as T;
  }

  async function loginConsole() {
    setBusyAction("login");
    setLoginError("");
    try {
      const response = await fetch("/api/aio/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword })
      });
      const text = await response.text();
      const body = text ? safeJsonParse(text) : null;
      if (!response.ok) throw new Error(body?.message || "用户名或密码错误");
      const session = body as AuthSession;
      localStorage.setItem("aio.consoleSession", JSON.stringify(session));
      setAuthSession(session);
      setLoginPassword("");
      setStatus("控制台已登录");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusyAction("");
    }
  }

  function logoutConsole() {
    clearStoredConsoleSession();
    setAuthSession(null);
    setApps([]);
    setSelectedAppId("");
    setStatus("已退出登录");
  }

  async function switchWorkspace(workspaceId: string) {
    if (!authSession || workspaceId === authSession.workspaceId) return;
    setBusyAction("switch-workspace");
    try {
      const response = await fetch("/api/aio/auth/switch-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authSession.token}` },
        body: JSON.stringify({ workspaceId })
      });
      const text = await response.text();
      const body = text ? safeJsonParse(text) : null;
      if (!response.ok) throw new Error(body?.message || "工作空间切换失败");
      const session = body as AuthSession;
      localStorage.setItem("aio.consoleSession", JSON.stringify(session));
      setAuthSession(session);
      setSelectedAppId("");
      setExperienceMessages([]);
      setStatus(`已切换到工作空间 ${session.workspaceId}`);
      navigateCenter();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "工作空间切换失败");
    } finally {
      setBusyAction("");
    }
  }

  async function refreshApps() {
    setAppsLoading(true);
    setAppsError("");
    try {
      const nextApps = await call<AppRecord[]>("/api/aio/admin/apps");
      setApps(nextApps);
      setStatus("应用列表已同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : "应用同步失败";
      setAppsError(message);
      setStatus(message);
    } finally {
      setAppsLoading(false);
    }
  }

  async function loadAppDefinition(app: AppRecord) {
    setDefinitionLoading(true);
    try {
      const versions = await call<AppVersion[]>(`/api/aio/admin/apps/${app.id}/versions`);
      const version = versions.find((item) => item.id === app.publishedVersionId) || versions[0];
      if (!version?.definitionJson) {
        if (app.type === "workflow") resetWorkflowCanvas();
        return;
      }
      const definition = JSON.parse(version.definitionJson) as Record<string, any>;
      if (app.type === "agent") {
        setAgentDraft({
          ...defaultAgentDraft,
          mode: normalizeAgentMode(definition.agentMode),
          model: definition.model?.chatModel || "",
          system: definition.prompt?.system || defaultAgentDraft.system,
          temperature: Number(definition.model?.temperature ?? 0.3),
          opening: definition.ui?.opening || defaultAgentDraft.opening,
          toolPlan: definition.ui?.toolPlan || defaultAgentDraft.toolPlan,
          textTemplate: definition.ui?.textTemplate || defaultAgentDraft.textTemplate
        });
      }
      if (app.type === "workflow") {
        const restored = restoreWorkflowDefinition(definition);
        setNodes(restored.nodes);
        setEdges(restored.edges);
        setSelectedNodeId(restored.nodes.find((node) => node.type === "llm")?.id || restored.nodes[0]?.id || "");
        setSelectedEdgeId("");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "版本定义加载失败");
    } finally {
      setDefinitionLoading(false);
    }
  }

  function openCreateModal(type: AppKind, mode: AgentMode = "agent") {
    setCreateType(type);
    setCreateMode(mode);
    setCreateName(type === "workflow" ? `Workflow 应用 ${apps.filter((item) => item.type === "workflow").length + 1}` : `${agentModes.find((item) => item.mode === mode)?.typeLabel || "Agent"}应用 ${apps.filter((item) => item.type === "agent").length + 1}`);
    setCreateOpen(true);
  }

  async function createApp() {
    setBusyAction("create");
    try {
      const created = await call<AppRecord>("/api/aio/admin/apps", {
        method: "POST",
        body: JSON.stringify({ name: createName.trim() || "未命名应用", type: createType, visibility: "public_api" })
      });
      if (createType === "agent") setAgentDraft({ ...defaultAgentDraft, mode: createMode });
      else resetWorkflowCanvas();
      setCreateOpen(false);
      setSelectedAppId(created.id);
      setView("designer");
      navigateDesigner(created);
      setStatus(`已创建 ${created.name}`);
      await refreshApps();
      setSelectedAppId(created.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建失败");
    } finally {
      setBusyAction("");
    }
  }

  async function publishSelectedApp() {
    setBusyAction("publish");
    try {
      if (!selectedApp) throw new Error("请先选择一个应用");
      const definitionJson = selectedApp.type === "workflow" ? JSON.stringify(workflowDefinition, null, 2) : JSON.stringify(buildAgentDefinition(agentDraft), null, 2);
      const report = await runReleaseCheck(definitionJson);
      if (!report.passed) {
        setStatus(`发布检查未通过：${report.blockingErrors} 个阻断错误`);
        return;
      }
      const version = await call<{ id: string; versionNo: number }>(`/api/aio/admin/apps/${selectedApp.id}/versions`, { method: "POST", body: JSON.stringify({ definitionJson }) });
      await call(`/api/aio/admin/apps/${selectedApp.id}/publish`, { method: "POST", body: JSON.stringify({ versionId: version.id }) });
      setStatus(`${selectedApp.name} 已发布 v${version.versionNo}，发布检查通过`);
      await refreshApps();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布失败");
    } finally {
      setBusyAction("");
    }
  }

  async function validateSelectedApp() {
    setBusyAction("validate");
    try {
      if (!selectedApp) throw new Error("请先选择一个应用");
      const definitionJson = selectedApp.type === "workflow" ? JSON.stringify(workflowDefinition, null, 2) : JSON.stringify(buildAgentDefinition(agentDraft), null, 2);
      const report = await runReleaseCheck(definitionJson);
      setStatus(report.passed ? `发布检查通过：${report.warnings} 个警告` : `发布检查未通过：${report.blockingErrors} 个阻断错误`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布检查失败");
    } finally {
      setBusyAction("");
    }
  }

  async function runReleaseCheck(definitionJson: string) {
    if (!selectedApp) throw new Error("请先选择一个应用");
    const report = await call<ValidationReport>(`/api/aio/admin/apps/${selectedApp.id}/validate`, { method: "POST", body: JSON.stringify({ definitionJson }) });
    setValidationReport(report);
    setReleasePanelOpen(true);
    return report;
  }

  async function createRuntimeKey() {
    setBusyAction("key");
    try {
      if (!selectedApp) throw new Error("请先选择应用");
      const key = await call<{ apiKey: string }>("/api/aio/admin/api-keys", { method: "POST", body: JSON.stringify({ name: `${selectedApp.name} runtime`, workspaceId: authSession?.workspaceId || "default", appId: selectedApp.id }) });
      setRuntimeKey(key.apiKey);
      setStatus("Runtime API Key 已生成");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API Key 创建失败");
    } finally {
      setBusyAction("");
    }
  }

  async function archiveApp(app: AppRecord) {
    if (!window.confirm(`确认删除（归档）应用「${app.name}」？归档后会从当前应用列表移除，历史版本和运行记录仍保留。`)) return;
    setBusyAction(`archive-${app.id}`);
    try {
      await call(`/api/aio/admin/apps/${app.id}/archive`, { method: "POST" });
      setStatus(`已归档 ${app.name}`);
      await refreshApps();
      if (selectedAppId === app.id) backToCenter();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "应用归档失败");
    } finally {
      setBusyAction("");
    }
  }

  async function invokeSelectedApp() {
    setBusyAction("run");
    try {
      if (!selectedApp) throw new Error("请先选择应用");
      if (!runtimeKey) throw new Error("请先生成 Runtime API Key");
      const path = selectedApp.type === "workflow" ? `/v1/apps/${selectedApp.id}/run` : `/v1/apps/${selectedApp.id}/chat`;
      const body = selectedApp.type === "workflow" ? { inputs: { question: "请处理一条售后退款咨询", operator_id: "console-user" }, response_mode: "blocking" } : { query: "请用三句话介绍这个应用可以做什么", stream: false };
      const response = await call<Record<string, unknown>>(path, { method: "POST", body: JSON.stringify(body) }, true);
      setRunResult(response);
      setStatus("试运行完成");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "调用失败");
    } finally {
      setBusyAction("");
    }
  }

  async function sendExperienceMessage() {
    if (!selectedApp) return;
    if (!runtimeKey) {
      setStatus("请先为当前应用生成体验 Key");
      return;
    }
    const prompt = experienceInput.trim();
    if (!prompt) return;
    const userMessage: ExperienceMessage = { id: `msg_${Date.now()}_user`, role: "user", text: prompt, meta: selectedApp.type === "workflow" ? "Workflow 输入" : "用户消息" };
    setExperienceMessages((current) => [...current, userMessage]);
    setExperienceInput("");
    setBusyAction("experience-send");
    try {
      const path = selectedApp.type === "workflow" ? `/v1/apps/${selectedApp.id}/run` : `/v1/apps/${selectedApp.id}/chat`;
      const body = selectedApp.type === "workflow"
        ? { inputs: { question: prompt, operator_id: authSession?.userId || "console-user" }, response_mode: "blocking" }
        : { query: prompt, stream: false };
      const response = await call<RuntimeResponse>(path, { method: "POST", body: JSON.stringify(body) }, true);
      appendRuntimeResponse(response, selectedApp.type);
      setStatus(response.status === "waiting" ? "AI 应用正在等待用户反馈" : "AI 应用体验完成");
    } catch (error) {
      appendExperienceSystem(error instanceof Error ? error.message : "应用体验调用失败");
      setStatus(error instanceof Error ? error.message : "应用体验调用失败");
    } finally {
      setBusyAction("");
    }
  }

  async function submitExperienceWait(waitTask: RuntimeWaitTask, action = "approve") {
    if (!runtimeKey) {
      setStatus("请先为当前应用生成体验 Key");
      return;
    }
    setBusyAction(`experience-wait-${waitTask.id}`);
    const comment = experienceFeedback.trim() || (action === "reject" ? "拒绝" : "确认继续");
    setExperienceMessages((current) => [...current, { id: `msg_${Date.now()}_feedback`, role: "user", text: comment, meta: action === "reject" ? "用户拒绝" : "用户反馈" }]);
    try {
      const response = await call<WaitSubmitResponse>(`/v1/wait-tasks/${waitTask.id}/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": `experience-${waitTask.id}-${Date.now()}` },
        body: JSON.stringify({ action, comment, submitted_by: authSession?.userId || "console-user" })
      }, true);
      setExperienceMessages((current) => current.map((message) => message.waitTask?.id === waitTask.id ? { ...message, waitTask: { ...message.waitTask, status: response.wait_task_status } } : message));
      if (response.next_wait_task) {
        appendExperienceWait(response.next_wait_task);
        setStatus("流程继续后再次等待用户反馈");
      } else {
        const run = await call<RuntimeRunResponse>(`/v1/runs/${response.run_id}`, {}, true);
        setExperienceMessages((current) => [...current, { id: `msg_${Date.now()}_assistant`, role: "assistant", text: runtimeOutputText(run.outputs, run.status), meta: `run ${run.run_id} · ${run.status}` }]);
        setStatus(`流程已${run.status === "success" ? "完成" : run.status}`);
      }
    } catch (error) {
      appendExperienceSystem(error instanceof Error ? error.message : "用户反馈提交失败");
      setStatus(error instanceof Error ? error.message : "用户反馈提交失败");
    } finally {
      setBusyAction("");
    }
  }

  function appendRuntimeResponse(response: RuntimeResponse, type: AppKind) {
    if (response.status === "waiting" && response.wait_task) {
      appendExperienceWait(response.wait_task);
      return;
    }
    const text = type === "agent" ? (response.answer || runtimeOutputText(response.outputs, response.status)) : runtimeOutputText(response.outputs, response.status);
    setExperienceMessages((current) => [...current, { id: `msg_${Date.now()}_assistant`, role: "assistant", text, meta: `run ${response.run_id} · ${response.status}` }]);
  }

  function appendExperienceWait(waitTask: RuntimeWaitTask) {
    setExperienceMessages((current) => [...current, { id: `msg_${Date.now()}_wait`, role: "wait", text: waitTask.description || waitTask.title || "AI 应用需要你的反馈后继续。", meta: waitTask.title || "等待用户反馈", waitTask }]);
  }

  function appendExperienceSystem(text: string) {
    setExperienceMessages((current) => [...current, { id: `msg_${Date.now()}_system`, role: "system", text }]);
  }

  async function refreshRuns(appId = selectedAppId || undefined) {
    setRunsLoading(true);
    setRunsError("");
    try {
      const queryString = appId ? `?appId=${encodeURIComponent(appId)}` : "";
      const nextRuns = await call<RunRecord[]>(`/api/aio/admin/runs${queryString}`);
      setRuns(nextRuns);
      setSelectedRunId((current) => nextRuns.some((run) => run.runId === current) ? current : nextRuns[0]?.runId || "");
      if (!nextRuns.length) setTraces([]);
      setStatus(appId ? "应用运行记录已同步" : "全局运行记录已同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : "运行记录加载失败";
      setRunsError(message);
      setStatus(message);
    } finally {
      setRunsLoading(false);
    }
  }

  async function loadRunTraces(runId: string) {
    setTracesLoading(true);
    try {
      const nextTraces = await call<TraceRecord[]>(`/api/aio/admin/runs/${encodeURIComponent(runId)}/traces`);
      setTraces(nextTraces);
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "Trace 加载失败");
    } finally {
      setTracesLoading(false);
    }
  }

  async function refreshKnowledge() {
    setKnowledgeLoading(true);
    setKnowledgeError("");
    try {
      const nextDatasets = await call<DatasetRecord[]>("/api/aio/admin/datasets");
      setDatasets(nextDatasets);
      const nextDatasetId = selectedDatasetId && nextDatasets.some((dataset) => dataset.id === selectedDatasetId) ? selectedDatasetId : nextDatasets[0]?.id || "";
      setSelectedDatasetId(nextDatasetId);
      if (nextDatasetId) {
        const nextDocuments = await call<DocumentRecord[]>(`/api/aio/admin/datasets/${nextDatasetId}/documents`);
        setDocuments(nextDocuments);
      } else {
        setDocuments([]);
        setRetrieveRecords([]);
      }
      setStatus("知识库已同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : "知识库加载失败";
      setKnowledgeError(message);
      setStatus(message);
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function selectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId);
    setKnowledgeLoading(true);
    setKnowledgeError("");
    try {
      const nextDocuments = await call<DocumentRecord[]>(`/api/aio/admin/datasets/${datasetId}/documents`);
      setDocuments(nextDocuments);
      setRetrieveRecords([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "文档加载失败";
      setKnowledgeError(message);
      setStatus(message);
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function createDataset() {
    setBusyAction("dataset");
    try {
      const created = await call<DatasetRecord>("/api/aio/admin/datasets", { method: "POST", body: JSON.stringify({ name: newDatasetName, description: "控制台创建的数据集", chunkStrategy: "fixed" }) });
      setSelectedDatasetId(created.id);
      setStatus(`已创建知识库 ${created.name}`);
      await refreshKnowledge();
      setSelectedDatasetId(created.id);
      await selectDataset(created.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "知识库创建失败");
    } finally {
      setBusyAction("");
    }
  }

  async function addDocument() {
    if (!selectedDatasetId) return;
    setBusyAction("document");
    try {
      await call(`/api/aio/admin/datasets/${selectedDatasetId}/documents`, { method: "POST", body: JSON.stringify({ name: "控制台文本文档", sourceType: "text", text: newDocumentText }) });
      setStatus("文档已写入并完成轻量索引");
      await selectDataset(selectedDatasetId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "文档写入失败");
    } finally {
      setBusyAction("");
    }
  }

  async function uploadDocumentFile() {
    if (!selectedDatasetId || !knowledgeFile) return;
    setBusyAction("document-upload");
    try {
      const formData = new FormData();
      formData.append("file", knowledgeFile);
      await uploadForm(`/api/aio/admin/datasets/${selectedDatasetId}/documents/upload`, formData);
      setKnowledgeFile(null);
      setStatus("文件已上传、解析并写入索引");
      await selectDataset(selectedDatasetId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "文件上传失败");
    } finally {
      setBusyAction("");
    }
  }

  async function retrieveTest() {
    if (!selectedDatasetId) return;
    setBusyAction("retrieve");
    try {
      const response = await call<{ records: RetrieveRecord[] }>(`/api/aio/admin/datasets/${selectedDatasetId}/retrieve-test`, { method: "POST", body: JSON.stringify({ query: retrieveQuery, topK: 5 }) });
      setRetrieveRecords(response.records || []);
      setStatus(`检索完成：${response.records?.length || 0} 条命中`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "检索测试失败");
    } finally {
      setBusyAction("");
    }
  }

  async function refreshWaitTasks() {
    setWaitTasksLoading(true);
    setWaitTasksError("");
    try {
      const queryString = waitTaskFilter === "all" ? "" : `?status=${encodeURIComponent(waitTaskFilter)}`;
      const nextTasks = await call<WaitTaskRecord[]>(`/api/aio/admin/wait-tasks${queryString}`);
      setWaitTasks(nextTasks);
      setStatus("流程等待已同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : "任务中心加载失败";
      setWaitTasksError(message);
      setStatus(message);
    } finally {
      setWaitTasksLoading(false);
    }
  }

  async function submitWaitTask(task: WaitTaskRecord, action = "approve") {
    setBusyAction(`wait-${task.id}`);
    try {
      await call(`/api/aio/admin/wait-tasks/${task.id}/submit`, { method: "POST", headers: { "Idempotency-Key": `console-${task.id}-${Date.now()}` }, body: JSON.stringify({ action, comment: "流程等待工作台处理" }) });
      setStatus(`等待任务已${action === "reject" ? "拒绝" : "提交"}`);
      await refreshWaitTasks();
      await refreshRuns();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "任务提交失败");
    } finally {
      setBusyAction("");
    }
  }

  async function refreshOrgOps() {
    setOrgLoading(true);
    setOrgError("");
    try {
      const [nextTenants, nextWorkspaces, nextKeys, nextUsage, nextAudit] = await Promise.all([
        call<TenantRecord[]>("/api/aio/admin/tenants"),
        call<WorkspaceRecord[]>("/api/aio/admin/workspaces"),
        call<ApiKeyRecord[]>("/api/aio/admin/api-keys"),
        call<UsageSummary>("/api/aio/admin/usage-summary"),
        call<AuditEvent[]>("/api/aio/admin/audit-events")
      ]);
      setTenants(nextTenants);
      setWorkspaces(nextWorkspaces);
      setApiKeys(nextKeys);
      setUsageSummary(nextUsage);
      setAuditEvents(nextAudit);
      setStatus("组织、用量与审计已同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : "组织运营数据加载失败";
      setOrgError(message);
      setStatus(message);
    } finally {
      setOrgLoading(false);
    }
  }

  async function refreshWorkspaceOptions() {
    try {
      const nextWorkspaces = await call<WorkspaceRecord[]>("/api/aio/admin/workspaces");
      setWorkspaces(nextWorkspaces);
    } catch {
      setWorkspaces([]);
    }
  }

  async function refreshProviders() {
    setProvidersLoading(true);
    setProvidersError("");
    try {
      const nextProviders = await call<ProviderRecord[]>("/api/aio/admin/providers");
      setProviders(nextProviders);
      setStatus("模型供应商已同步");
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型供应商加载失败";
      setProvidersError(message);
      setStatus(message);
    } finally {
      setProvidersLoading(false);
    }
  }

  async function createProvider() {
    setBusyAction("provider-create");
    try {
      await call<ProviderRecord>("/api/aio/admin/providers", {
        method: "POST",
        body: JSON.stringify({ ...providerForm, workspaceId: authSession?.workspaceId || "default", apiKey: providerForm.apiKey || undefined })
      });
      setProviderForm((current) => ({ ...current, apiKey: "" }));
      setStatus("模型供应商已保存");
      await refreshProviders();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "模型供应商保存失败");
    } finally {
      setBusyAction("");
    }
  }

  async function testProvider(provider: ProviderRecord) {
    setBusyAction(`provider-test-${provider.id}`);
    try {
      const result = await call<Record<string, unknown>>(`/api/aio/admin/providers/${provider.id}/test`, { method: "POST" });
      setStatus(`供应商测试完成：${String(result.status || result.message || "ok")}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "供应商测试失败");
    } finally {
      setBusyAction("");
    }
  }

  async function disableProvider(provider: ProviderRecord) {
    if (!window.confirm(`确认禁用模型供应商「${provider.name}」？`)) return;
    setBusyAction(`provider-disable-${provider.id}`);
    try {
      await call<ProviderRecord>(`/api/aio/admin/providers/${provider.id}/disable`, { method: "POST" });
      setStatus(`已禁用 ${provider.name}`);
      await refreshProviders();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "供应商禁用失败");
    } finally {
      setBusyAction("");
    }
  }

  function openDesigner(app: AppRecord) {
    setSelectedAppId(app.id);
    setView("designer");
    navigateDesigner(app);
  }

  function openApiDocs(app: AppRecord) {
    setSelectedAppId(app.id);
    setView("api");
    navigateApiDocs(app);
  }

  function openObservability(app?: AppRecord) {
    setSelectedAppId(app?.id || "");
    setView("observability");
    navigateObservability(app);
  }

  function openExperience(app: AppRecord) {
    setSelectedAppId(app.id);
    setView("experience");
    setExperienceMessages([]);
    navigateExperience(app);
  }

  function openKnowledge() {
    setSelectedAppId("");
    setView("knowledge");
    navigateKnowledge();
  }

  function openProviders() {
    setSelectedAppId("");
    setView("providers");
    navigateProviders();
  }

  function openOrg() {
    setSelectedAppId("");
    setView("org");
    navigateOrg();
  }

  function backToCenter() {
    setView("center");
    navigateCenter();
  }

  function resetWorkflowCanvas() {
    setNodes(defaultNodes.map((item) => ({ ...item, config: { ...item.config } })));
    setEdges(defaultEdges.map((item) => ({ ...item })));
    setSelectedNodeId("answer");
    setSelectedEdgeId("");
  }

  function addNode(type: WorkflowNodeType) {
    const id = `${type}_${Math.random().toString(36).slice(2, 8)}`;
    const index = nodes.length;
    const nextNode: WorkflowNode = { id, type, label: nodeMeta[type].name, x: 130 + (index % 4) * 230, y: 340 + Math.floor(index / 4) * 132, config: defaultNodeConfig(type) };
    setNodes((current) => [...current, nextNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId("");
  }

  function removeNode(nodeId: string) {
    if (nodeId === "start" || nodeId === "end") return;
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.from !== nodeId && edge.to !== nodeId));
    setSelectedNodeId("start");
  }

  function updateNode(nodeId: string, patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, ...patch } : node));
  }

  function updateNodeConfig(nodeId: string, key: string, value: string) {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, config: { ...node.config, [key]: parseConfigValue(key, value) } } : node));
  }

  function updateEdge(edgeId: string, condition: string) {
    setEdges((current) => current.map((edge) => edge.id === edgeId ? { ...edge, condition: condition || undefined } : edge));
  }

  function removeEdge(edgeId: string) {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    setSelectedEdgeId("");
  }

  function canvasPoint(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) };
  }

  function startDrag(event: React.PointerEvent, node: WorkflowNode) {
    const point = canvasPoint(event);
    setDragging({ nodeId: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
    setSelectedNodeId(node.id);
    setSelectedEdgeId("");
  }

  function startConnect(event: React.PointerEvent, node: WorkflowNode) {
    event.stopPropagation();
    const point = canvasPoint(event);
    setConnecting({ from: node.id, x: point.x, y: point.y });
  }

  function finishConnect(event: React.PointerEvent, targetId: string) {
    event.stopPropagation();
    if (!connecting || connecting.from === targetId) return;
    if (!edges.some((edge) => edge.from === connecting.from && edge.to === targetId)) {
      setEdges((current) => [...current, { id: `edge_${connecting.from}_${targetId}_${Date.now()}`, from: connecting.from, to: targetId }]);
    }
    setConnecting(null);
  }

  function moveOnCanvas(event: React.PointerEvent) {
    const point = canvasPoint(event);
    if (dragging) updateNode(dragging.nodeId, { x: Math.max(18, Math.min(1260, point.x - dragging.offsetX)), y: Math.max(18, Math.min(720, point.y - dragging.offsetY)) });
    if (connecting) setConnecting({ ...connecting, x: point.x, y: point.y });
  }

  function stopCanvasInteraction() {
    setDragging(null);
    setConnecting(null);
  }

  if (!authSession) {
    return <LoginPage username={loginUsername} password={loginPassword} error={loginError} loggingIn={busyAction === "login"} setUsername={setLoginUsername} setPassword={setLoginPassword} login={loginConsole} />;
  }

  return (
    <main className="consoleShell">
      <TopNav status={status} session={authSession} workspaces={workspaces} menuOpen={userMenuOpen} settingsOpen={settingsMenuOpen} switching={busyAction === "switch-workspace"} setMenuOpen={setUserMenuOpen} setSettingsOpen={setSettingsMenuOpen} switchWorkspace={switchWorkspace} openProviders={openProviders} logout={logoutConsole} />
      <section className="consoleBody">
        <SideNav activeView={view} session={authSession} onCreate={() => openCreateModal("agent", "agent")} openApps={backToCenter} openObservability={() => openObservability()} openKnowledge={openKnowledge} openOrg={openOrg} />
        {view === "center" ? (
          <AppCenter apps={apps} visibleApps={visibleApps} loading={appsLoading} error={appsError} filter={filter} query={query} session={authSession} setFilter={setFilter} setQuery={setQuery} refreshApps={refreshApps} openCreateModal={openCreateModal} openDesigner={openDesigner} openExperience={openExperience} archiveApp={archiveApp} busyAction={busyAction} />
        ) : view === "api" ? (
          <AppApiDocsPage selectedApp={selectedApp} selectedAppId={selectedAppId} appsLoading={appsLoading} session={authSession} runtimeKey={runtimeKey} setRuntimeKey={setRuntimeKey} busyAction={busyAction} createRuntimeKey={createRuntimeKey} openDesigner={openDesigner} back={backToCenter} />
        ) : view === "experience" ? (
          <ExperiencePage selectedApp={selectedApp} selectedAppId={selectedAppId} appsLoading={appsLoading} messages={experienceMessages} input={experienceInput} feedback={experienceFeedback} runtimeKey={runtimeKey} busyAction={busyAction} setInput={setExperienceInput} setFeedback={setExperienceFeedback} createRuntimeKey={createRuntimeKey} sendMessage={sendExperienceMessage} submitWait={submitExperienceWait} openDesigner={openDesigner} back={backToCenter} />
        ) : view === "observability" ? (
          <RunObservabilityPage apps={apps} selectedApp={selectedApp} selectedAppId={selectedAppId} runs={runs} traces={traces} selectedRun={selectedRun} selectedRunId={selectedRunId} loading={runsLoading} tracesLoading={tracesLoading} error={runsError} refreshRuns={() => refreshRuns(selectedAppId || undefined)} selectRun={setSelectedRunId} openDesigner={openDesigner} openGlobal={() => openObservability()} back={backToCenter} />
        ) : view === "knowledge" ? (
          <KnowledgePage datasets={datasets} documents={documents} retrieveRecords={retrieveRecords} selectedDatasetId={selectedDatasetId} loading={knowledgeLoading} error={knowledgeError} newDatasetName={newDatasetName} newDocumentText={newDocumentText} retrieveQuery={retrieveQuery} knowledgeFile={knowledgeFile} busyAction={busyAction} setNewDatasetName={setNewDatasetName} setNewDocumentText={setNewDocumentText} setRetrieveQuery={setRetrieveQuery} setKnowledgeFile={setKnowledgeFile} refreshKnowledge={refreshKnowledge} selectDataset={selectDataset} createDataset={createDataset} addDocument={addDocument} uploadDocumentFile={uploadDocumentFile} retrieveTest={retrieveTest} />
        ) : view === "tasks" ? (
          <TaskCenterPage tasks={waitTasks} loading={waitTasksLoading} error={waitTasksError} filter={waitTaskFilter} busyAction={busyAction} setFilter={setWaitTaskFilter} refreshTasks={refreshWaitTasks} submitTask={submitWaitTask} />
        ) : view === "providers" ? (
          <ProviderPage providers={providers} loading={providersLoading} error={providersError} form={providerForm} busyAction={busyAction} setForm={setProviderForm} refreshProviders={refreshProviders} createProvider={createProvider} testProvider={testProvider} disableProvider={disableProvider} />
        ) : view === "org" ? (
          <OrgOpsPage tenants={tenants} workspaces={workspaces} apiKeys={apiKeys} usage={usageSummary} auditEvents={auditEvents} session={authSession} loading={orgLoading} error={orgError} refreshOrg={refreshOrgOps} />
        ) : (
          <DesignerPage selectedApp={selectedApp} selectedAppId={selectedAppId} appsLoading={appsLoading} definitionLoading={definitionLoading} busyAction={busyAction} agentDraft={agentDraft} setAgentDraft={setAgentDraft} modelOptions={modelOptions} runResult={runResult} runtimeKey={runtimeKey} setRuntimeKey={setRuntimeKey} validationReport={validationReport} releasePanelOpen={releasePanelOpen} setReleasePanelOpen={setReleasePanelOpen} publishSelectedApp={publishSelectedApp} validateSelectedApp={validateSelectedApp} createRuntimeKey={createRuntimeKey} invokeSelectedApp={invokeSelectedApp} archiveApp={archiveApp} openApiDocs={openApiDocs} openObservability={openObservability} openExperience={openExperience} back={backToCenter} workflowProps={{ canvasRef, nodes, edges, connecting, selectedNode, selectedEdge, workflowDefinition, addNode, removeNode, removeEdge, updateEdge, updateNode, updateNodeConfig, startDrag, startConnect, finishConnect, moveOnCanvas, stopCanvasInteraction, selectNode: (nodeId: string) => { setSelectedNodeId(nodeId); setSelectedEdgeId(""); }, selectEdge: (edgeId: string) => { setSelectedEdgeId(edgeId); setSelectedNodeId(""); } }} />
        )}
      </section>
      {createOpen && <CreateAppModal createType={createType} createMode={createMode} createName={createName} creating={busyAction === "create"} setCreateType={setCreateType} setCreateMode={setCreateMode} setCreateName={setCreateName} close={() => setCreateOpen(false)} createApp={createApp} />}
    </main>
  );
}

function LoginPage(props: { username: string; password: string; error: string; loggingIn: boolean; setUsername: (value: string) => void; setPassword: (value: string) => void; login: () => Promise<void> }) {
  return <main className="loginShell"><section className="loginCard"><div className="loginBrand"><div className="logoGem">A</div><div><strong>Aio Console</strong><span>私有化部署 · 控制台登录</span></div></div><h1>登录管理控制台</h1><p>请输入管理员账号和密码。</p>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span></div>}<Field label="用户名"><input value={props.username} onChange={(event) => props.setUsername(event.target.value)} placeholder="用户名" autoFocus /></Field><Field label="密码"><input type="password" value={props.password} onChange={(event) => props.setPassword(event.target.value)} placeholder="请输入控制台密码" onKeyDown={(event) => { if (event.key === "Enter") void props.login(); }} /></Field><button className="primaryBtn loginBtn" disabled={props.loggingIn} onClick={() => void props.login()}>{props.loggingIn ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />} 登录</button></section></main>;
}

function TopNav({ status, session, workspaces, menuOpen, settingsOpen, switching, setMenuOpen, setSettingsOpen, switchWorkspace, openProviders, logout }: { status: string; session: AuthSession; workspaces: WorkspaceRecord[]; menuOpen: boolean; settingsOpen: boolean; switching: boolean; setMenuOpen: (open: boolean) => void; setSettingsOpen: (open: boolean) => void; switchWorkspace: (workspaceId: string) => Promise<void>; openProviders: () => void; logout: () => void }) {
  const displayName = session.displayName || session.userId;
  const roleLabel = session.role === "admin" || (!session.role && session.userId === "admin") ? "管理员" : "成员";
  const options = workspaces.some((workspace) => workspace.id === session.workspaceId) ? workspaces : [{ id: session.workspaceId, tenantId: session.tenantId, name: session.workspaceId, status: "active" }, ...workspaces];
  return <header className="topNav"><div className="logoGroup"><div className="logoGem">A</div><strong>Aio</strong></div><div className="statusDot"><Sparkles size={14} /><span>{status}</span></div><div className="topActions"><div className="settingsWrap"><button className="settingsBtn" title="系统设置" onClick={() => { setSettingsOpen(!settingsOpen); setMenuOpen(false); }}><Settings2 size={17} /></button>{settingsOpen && <div className="settingsMenu"><strong>系统设置</strong><button onClick={() => { setSettingsOpen(false); openProviders(); }}><Bot size={16} /><span><b>模型供应商</b><small>配置 LLM 网关、模型和 API Key</small></span></button></div>}</div><div className="avatarWrap"><button className="avatar" title="账号菜单" onClick={() => { setMenuOpen(!menuOpen); setSettingsOpen(false); }}>{displayName.slice(0, 1).toUpperCase()}</button>{menuOpen && <div className="avatarMenu"><strong>基本信息</strong><dl><dt>账号</dt><dd>{session.userId}</dd><dt>名称</dt><dd>{displayName}</dd><dt>角色</dt><dd>{roleLabel}</dd><dt>租户</dt><dd>{session.tenantId}</dd><dt>工作空间</dt><dd>{session.workspaceId}</dd></dl><label className="menuField"><span>切换工作空间</span><select value={session.workspaceId} disabled={switching || options.length <= 1} onChange={(event) => void switchWorkspace(event.target.value)}>{options.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name || workspace.id} · {workspace.id}</option>)}</select></label><button className="dangerTextBtn" onClick={logout}><X size={14} /> 退出登录</button></div>}</div></div></header>;
}

function SideNav({ activeView, session, onCreate, openApps, openObservability, openKnowledge, openOrg }: { activeView: CenterView; session: AuthSession; onCreate: () => void; openApps: () => void; openObservability: () => void; openKnowledge: () => void; openOrg: () => void }) {
  return <aside className="sideNav"><button className="createBtn" onClick={onCreate}><Plus size={17} /> 创建应用</button><button className={`sideItem ${activeView === "center" || activeView === "designer" || activeView === "experience" || activeView === "api" ? "active" : ""}`} onClick={openApps}><Boxes size={18} /> 应用管理</button><button className={`sideItem ${activeView === "knowledge" ? "active" : ""}`} onClick={openKnowledge}><Database size={18} /> 知识库</button><button className={`sideItem ${activeView === "observability" ? "active" : ""}`} onClick={openObservability}><Play size={18} /> 运行观测</button><button className={`sideItem ${activeView === "org" ? "active" : ""}`} onClick={openOrg}><Building2 size={18} /> 组织运营</button><p className="sideGroup">当前空间：{session.workspaceId}<br />账号：{session.displayName || session.userId}</p></aside>;
}

function AppCenter(props: { apps: AppRecord[]; visibleApps: AppRecord[]; loading: boolean; error: string; filter: "all" | AppKind; query: string; session: AuthSession; setFilter: (filter: "all" | AppKind) => void; setQuery: (query: string) => void; refreshApps: () => Promise<void>; openCreateModal: (type: AppKind, mode?: AgentMode) => void; openDesigner: (app: AppRecord) => void; openExperience: (app: AppRecord) => void; archiveApp: (app: AppRecord) => Promise<void>; busyAction: string }) {
  const isFilteredEmpty = !props.loading && !props.error && props.apps.length > 0 && props.visibleApps.length === 0;
  return <section className="workspacePane"><div className="pageHeader"><div><h1>应用管理</h1><p>当前账号只看到工作空间 {props.session.workspaceId} 的应用和数据。</p></div><div className="headerActions"><button className="primaryBtn" onClick={() => props.openCreateModal("agent", "agent")}><Plus size={17} /> 创建应用</button></div></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshApps()}>重试</button></div>}<div className="toolbar"><div className="filterTabs">{([{ key: "all", label: "全部" }, { key: "agent", label: "Agent" }, { key: "workflow", label: "工作流" }] as const).map((item) => <button key={item.key} className={props.filter === item.key ? "active" : ""} onClick={() => props.setFilter(item.key)}>{item.label}</button>)}</div><div className="searchInput"><Search size={16} /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="搜索应用名称" /></div><button className="iconBtn" disabled={props.loading} onClick={() => void props.refreshApps()}>{props.loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}</button></div>{props.loading && <StatePanel icon="loading" title="正在同步应用列表" text="正在读取当前空间的应用、发布状态和最近更新时间。" />}{!props.loading && !props.error && <div className="appGrid"><button className="createCard" onClick={() => props.openCreateModal("agent", "agent")}><Plus size={22} /><strong>创建应用</strong><span>空白 Agent / Workflow</span></button>{props.visibleApps.map((app) => <AppTile key={app.id} app={app} openDesigner={props.openDesigner} openExperience={props.openExperience} archiveApp={props.archiveApp} archiving={props.busyAction === `archive-${app.id}`} />)}</div>}{!props.loading && !props.error && !props.apps.length && <StatePanel title="暂无应用" text="当前账号的工作空间还没有应用，可先创建 Agent 或 Workflow。" />}{isFilteredEmpty && <StatePanel title="没有匹配的应用" text="请调整筛选条件或搜索关键字。" />}</section>;
}

function AppTile({ app, openDesigner, openExperience, archiveApp, archiving }: { app: AppRecord; openDesigner: (app: AppRecord) => void; openExperience: (app: AppRecord) => void; archiveApp: (app: AppRecord) => Promise<void>; archiving: boolean }) {
  const statusMeta = getAppStatusMeta(app);
  return <article className="appTile" role="button" tabIndex={0} onClick={() => openDesigner(app)} onKeyDown={(event) => { if (event.key === "Enter") openDesigner(app); }}><div className="tileTop"><span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><span className={`publishState ${statusMeta.tone}`}><i /> {statusMeta.label}</span></div><strong>{app.name}</strong><dl><dt>应用 ID</dt><dd>{app.id}</dd><dt>应用类型</dt><dd>{app.type === "workflow" ? "工作流" : "Agent"}</dd></dl><div className="tileActions"><p>更新于 {formatDate(app.updatedAt)}</p><div className="tileActionButtons"><button className="ghostTinyBtn" onClick={(event) => { event.stopPropagation(); openExperience(app); }}><Play size={14} /> 体验</button><button className="dangerTextBtn" disabled={archiving} onClick={(event) => { event.stopPropagation(); void archiveApp(app); }}>{archiving ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} 删除</button></div></div></article>;
}

function CreateAppModal(props: { createType: AppKind; createMode: AgentMode; createName: string; creating: boolean; setCreateType: (type: AppKind) => void; setCreateMode: (mode: AgentMode) => void; setCreateName: (name: string) => void; close: () => void; createApp: () => Promise<void> }) {
  return <div className="modalBackdrop" role="presentation"><section className="createModal" role="dialog" aria-modal="true"><header><div><h2>创建应用</h2><p>选择应用类型，创建后进入对应设计页面。</p></div><button className="iconBtn" disabled={props.creating} onClick={props.close}><X size={18} /></button></header><div className="createTypeGrid">{agentModes.map((item) => <CreateTypeCard key={item.mode} active={props.createType === "agent" && props.createMode === item.mode} icon={item.icon} title={item.title} text={item.description} onClick={() => { props.setCreateType("agent"); props.setCreateMode(item.mode); }} />)}<CreateTypeCard active={props.createType === "workflow"} icon={Workflow} title="Workflow" text="可视化拖拽节点、连线、条件分支和人工确认。" onClick={() => props.setCreateType("workflow")} /></div><label className="field"><span>应用名称</span><input value={props.createName} onChange={(event) => props.setCreateName(event.target.value)} placeholder="输入应用名称" /></label><footer><button className="ghostBtn" disabled={props.creating} onClick={props.close}>取消</button><button className="primaryBtn" disabled={props.creating} onClick={() => void props.createApp()}>{props.creating ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} 创建</button></footer></section></div>;
}

function CreateTypeCard({ active, icon: Icon, title, text, onClick }: { active: boolean; icon: typeof Bot; title: string; text: string; onClick: () => void }) {
  return <button className={`typeCard ${active ? "active" : ""}`} onClick={onClick}><Icon size={22} /><strong>{title}</strong><span>{text}</span></button>;
}

function DesignerPage(props: { selectedApp?: AppRecord; selectedAppId: string; appsLoading: boolean; definitionLoading: boolean; busyAction: string; agentDraft: AgentDraft; setAgentDraft: (draft: AgentDraft) => void; modelOptions: string[]; runResult: Record<string, unknown> | null; runtimeKey: string; setRuntimeKey: (value: string) => void; validationReport: ValidationReport | null; releasePanelOpen: boolean; setReleasePanelOpen: (open: boolean) => void; publishSelectedApp: () => Promise<void>; validateSelectedApp: () => Promise<void>; createRuntimeKey: () => Promise<void>; invokeSelectedApp: () => Promise<void>; archiveApp: (app: AppRecord) => Promise<void>; openApiDocs: (app: AppRecord) => void; openObservability: (app: AppRecord) => void; openExperience: (app: AppRecord) => void; back: () => void; workflowProps: WorkflowDesignerProps }) {
  if (!props.selectedApp) return <section className="workspacePane"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开应用" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的基础信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} /></section>;
  const statusMeta = getAppStatusMeta(props.selectedApp);
  return <section className="designerPane"><header className="designerHeader"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><div className="designerTitle"><span className={`tileIcon ${props.selectedApp.type}`}>{props.selectedApp.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><div><h1>{props.selectedApp.name}</h1><p>{props.selectedApp.type} · {statusMeta.label} · {props.selectedApp.id}</p></div>{props.definitionLoading && <span className="statusPill"><Loader2 className="spin" size={13} /> 同步版本</span>}</div><div className="designerActions"><button className="primaryBtn" onClick={() => props.openExperience(props.selectedApp!)}><Play size={16} /> 对话体验</button><button className="ghostBtn" onClick={() => props.openObservability(props.selectedApp!)}><Play size={16} /> 运行观测</button><button className="ghostBtn" onClick={() => props.openApiDocs(props.selectedApp!)}><Code2 size={16} /> API 文档</button><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.validateSelectedApp()}>{props.busyAction === "validate" ? <Loader2 className="spin" size={16} /> : <AlertCircle size={16} />} 发布检查</button><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.createRuntimeKey()}>{props.busyAction === "key" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} 生成 Key</button><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.invokeSelectedApp()}>{props.busyAction === "run" ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 试运行</button><button className="dangerBtn" disabled={!!props.busyAction} onClick={() => void props.archiveApp(props.selectedApp!)}>{props.busyAction === `archive-${props.selectedApp.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} 删除</button><button className="primaryBtn" disabled={!!props.busyAction} onClick={() => void props.publishSelectedApp()}>{props.busyAction === "publish" ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />} 发布</button></div></header>{props.selectedApp.type === "agent" ? <AgentDesigner draft={props.agentDraft} setDraft={props.setAgentDraft} modelOptions={props.modelOptions} runResult={props.runResult} runtimeKey={props.runtimeKey} setRuntimeKey={props.setRuntimeKey} /> : <WorkflowDesigner {...props.workflowProps} />}{props.releasePanelOpen && <ReleaseCheckPanel report={props.validationReport} close={() => props.setReleasePanelOpen(false)} />}</section>;
}

function ExperiencePage(props: { selectedApp?: AppRecord; selectedAppId: string; appsLoading: boolean; messages: ExperienceMessage[]; input: string; feedback: string; runtimeKey: string; busyAction: string; setInput: (value: string) => void; setFeedback: (value: string) => void; createRuntimeKey: () => Promise<void>; sendMessage: () => Promise<void>; submitWait: (task: RuntimeWaitTask, action?: string) => Promise<void>; openDesigner: (app: AppRecord) => void; back: () => void }) {
  if (!props.selectedApp) return <section className="workspacePane"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开应用体验" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的体验信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} /></section>;
  const app = props.selectedApp;
  const canSend = !!props.runtimeKey && app.status === "published" && !!props.input.trim() && props.busyAction !== "experience-send";
  return <section className="experiencePane"><div className="experienceHero"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><div className="experienceHeroText"><span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><div><h1>{app.name}</h1><p>{app.type === "workflow" ? "像最终用户一样发起流程，对话中直接提交反馈，AI 会自动续跑。" : "像最终用户一样直接和 Agent 对话，不需要先看 API 文档。"}</p></div></div><div className="designerActions"><button className="ghostBtn" onClick={() => props.openDesigner(app)}><Settings2 size={16} /> 返回设计</button><button className="ghostBtn" disabled={props.busyAction === "key"} onClick={() => void props.createRuntimeKey()}>{props.busyAction === "key" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} {props.runtimeKey ? "重新生成 Key" : "生成体验 Key"}</button></div></div>{app.status !== "published" && <div className="warningBox"><AlertCircle size={16} /> 当前应用尚未发布。请先发布应用，体验界面会调用已发布版本。</div>}<div className="experienceShell"><aside className="experienceBrief"><strong>体验通道</strong><dl><dt>App ID</dt><dd>{app.id}</dd><dt>类型</dt><dd>{app.type === "workflow" ? "Workflow" : "Agent"}</dd><dt>状态</dt><dd>{getAppStatusMeta(app).label}</dd><dt>Runtime Key</dt><dd>{props.runtimeKey ? "已就绪" : "未生成"}</dd></dl><p>{app.type === "workflow" ? "当流程到达人工确认节点时，等待卡片会直接出现在对话流里；用户点击确认或拒绝后，后端立即恢复流程。" : "Agent 回复会直接显示在对话流里，运行记录仍进入运行观测。"}</p></aside><main className="chatConsole"><div className="chatFeed">{!props.messages.length && <div className="chatEmpty"><Sparkles size={26} /><strong>开始一次真实应用体验</strong><span>{app.type === "workflow" ? "输入业务问题，流程暂停时会在这里等待用户反馈。" : "输入问题，直接查看 Agent 的最终回复。"}</span></div>}{props.messages.map((message) => <ExperienceBubble key={message.id} message={message} feedback={props.feedback} busyAction={props.busyAction} setFeedback={props.setFeedback} submitWait={props.submitWait} />)}{props.busyAction === "experience-send" && <div className="chatThinking"><Loader2 className="spin" size={16} /> AI 应用正在处理...</div>}</div><div className="chatComposer"><textarea value={props.input} onChange={(event) => props.setInput(event.target.value)} placeholder={app.type === "workflow" ? "输入流程问题，例如：这个退款请求应该怎么处理？" : "输入你想问 Agent 的问题"} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void props.sendMessage(); }} /><button className="primaryBtn" disabled={!canSend} onClick={() => void props.sendMessage()}>{props.busyAction === "experience-send" ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 发送</button></div></main></div></section>;
}

function ExperienceBubble(props: { message: ExperienceMessage; feedback: string; busyAction: string; setFeedback: (value: string) => void; submitWait: (task: RuntimeWaitTask, action?: string) => Promise<void> }) {
  const message = props.message;
  if (message.role === "wait" && message.waitTask) {
    const waitTask = message.waitTask;
    const actions = waitTaskActions(waitTask);
    const pending = !waitTask.status || waitTask.status === "pending";
    return <article className="chatBubble wait"><div className="bubbleMeta"><ClipboardCheck size={15} /> {message.meta} · {waitTask.status || "pending"}</div><strong>{waitTask.title || "等待用户反馈"}</strong><p>{message.text}</p>{pending ? <Field label="反馈内容"><textarea value={props.feedback} onChange={(event) => props.setFeedback(event.target.value)} /></Field> : <p className="mutedText">该等待项已处理，流程已继续。</p>}<div className="buttonRow">{actions.map((action) => <button key={action.key} className={action.key === "reject" ? "dangerBtn" : "primaryBtn"} disabled={!pending || props.busyAction === `experience-wait-${waitTask.id}`} onClick={() => void props.submitWait(waitTask, action.key)}>{props.busyAction === `experience-wait-${waitTask.id}` ? <Loader2 className="spin" size={16} /> : <ClipboardCheck size={16} />} {action.label}</button>)}</div></article>;
  }
  return <article className={`chatBubble ${message.role}`}><div className="bubbleMeta">{message.role === "user" ? "用户" : message.role === "assistant" ? "AI 应用" : "系统"}{message.meta ? ` · ${message.meta}` : ""}</div><p>{message.text}</p></article>;
}

function ReleaseCheckPanel({ report, close }: { report: ValidationReport | null; close: () => void }) {
  const issues = report?.issues || [];
  return <aside className="releasePanel"><div className="releasePanelHeader"><div><h2>发布检查</h2><p>{report ? (report.passed ? "无阻断错误，可以发布。" : "存在阻断错误，发布已停止。") : "尚未执行检查。"}</p></div><button className="iconBtn" onClick={close}><X size={18} /></button></div>{report && <div className="releaseSummary"><article className={report.blockingErrors ? "danger" : "success"}><strong>{report.blockingErrors}</strong><span>阻断错误</span></article><article><strong>{report.warnings}</strong><span>警告</span></article><article><strong>{report.suggestions}</strong><span>建议</span></article></div>}{!issues.length && <StatePanel title="检查通过" text="当前定义没有阻断错误。建议发布后进入运行观测查看首轮调用 Trace。" />}{issues.length > 0 && <div className="releaseIssueList">{issues.map((issue) => <article className={`releaseIssue ${issue.severity}`} key={`${issue.code}-${issue.target}-${issue.title}`}><div><span>{issue.severity === "error" ? "阻断" : issue.severity === "warning" ? "警告" : "建议"}</span><code>{issue.code}</code></div><strong>{issue.title}</strong><p>{issue.detail}</p><small>{issue.target}</small></article>)}</div>}</aside>;
}

function AppApiDocsPage(props: { selectedApp?: AppRecord; selectedAppId: string; appsLoading: boolean; session: AuthSession; runtimeKey: string; setRuntimeKey: (value: string) => void; busyAction: string; createRuntimeKey: () => Promise<void>; openDesigner: (app: AppRecord) => void; back: () => void }) {
  if (!props.selectedApp) return <section className="workspacePane"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开 API 文档" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的 API 信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} /></section>;
  const app = props.selectedApp;
  const docs = buildApiDocs(app, props.runtimeKey);
  const statusMeta = getAppStatusMeta(app);
  return <section className="workspacePane apiDocsPane"><div className="apiDocsHeader"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><div className="designerTitle"><span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><div><h1>{app.name} API 文档</h1><p>{app.type} · {statusMeta.label} · {app.id}</p></div></div><div className="designerActions"><button className="ghostBtn" onClick={() => props.openDesigner(app)}><Settings2 size={16} /> 返回设计</button><button className="primaryBtn" disabled={props.busyAction === "key"} onClick={() => void props.createRuntimeKey()}>{props.busyAction === "key" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} 生成应用 Key</button></div></div><div className="apiDocsGrid"><aside className="designCard apiMetaCard"><h3>调用信息</h3><dl><dt>Base URL</dt><dd>{docs.baseUrl}</dd><dt>App ID</dt><dd>{app.id}</dd><dt>鉴权方式</dt><dd>Authorization: Bearer sk_xxx</dd><dt>Key Scope</dt><dd>tenant={props.session.tenantId} / workspace={props.session.workspaceId} / app={app.id}</dd></dl><Field label="Runtime API Key"><input value={props.runtimeKey} onChange={(event) => props.setRuntimeKey(event.target.value)} placeholder="sk_..." /></Field>{app.status !== "published" && <div className="warningBox"><AlertCircle size={16} /> 当前应用尚未发布，外部运行 API 只会调用已发布版本。</div>}</aside><main className="apiExampleStack"><section className="designCard"><div className="sectionTitle"><Code2 size={18} /><div><h2>{docs.primaryTitle}</h2><p>{docs.primaryDescription}</p></div></div><EndpointRow method="POST" path={docs.primaryPath} /><CodeBlock title="curl" code={docs.curl} /><CodeBlock title="JavaScript" code={docs.javascript} /><CodeBlock title="Java" code={docs.java} /><CodeBlock title="Python" code={docs.python} /></section><section className="designCard"><h3>{app.type === "workflow" ? "Workflow 等待任务与 Trace" : "Run 与 Trace 查询"}</h3>{docs.extra.map((item) => <CodeBlock key={item.title} title={item.title} code={item.code} />)}</section></main></div></section>;
}

function RunObservabilityPage(props: { apps: AppRecord[]; selectedApp?: AppRecord; selectedAppId: string; runs: RunRecord[]; traces: TraceRecord[]; selectedRun?: RunRecord; selectedRunId: string; loading: boolean; tracesLoading: boolean; error: string; refreshRuns: () => Promise<void>; selectRun: (runId: string) => void; openDesigner: (app: AppRecord) => void; openGlobal: () => void; back: () => void }) {
  const scopeTitle = props.selectedApp ? `${props.selectedApp.name} 运行观测` : "全局运行观测";
  const successCount = props.runs.filter((run) => run.status === "success").length;
  const waitingCount = props.runs.filter((run) => run.status === "waiting").length;
  const failedCount = props.runs.filter((run) => run.status === "failed").length;
  const avgLatency = props.runs.length ? Math.round(props.runs.reduce((sum, run) => sum + (run.latencyMs || 0), 0) / props.runs.length) : 0;
  const selectedAppRecord = props.selectedRun ? props.apps.find((app) => app.id === props.selectedRun?.appId) : undefined;
  return <section className="workspacePane runObsPane"><div className="runObsHeader"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><div><h1>{scopeTitle}</h1><p>{props.selectedApp ? `仅查看 ${props.selectedApp.id} 的运行记录` : "跨应用查看最近运行、Trace、输入输出和错误原因"}</p></div><div className="designerActions">{props.selectedApp && <button className="ghostBtn" onClick={props.openGlobal}>全局运行</button>}<button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshRuns()}>{props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button>{props.selectedApp && <button className="primaryBtn" onClick={() => props.openDesigner(props.selectedApp!)}><Settings2 size={16} /> 返回设计</button>}</div></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshRuns()}>重试</button></div>}<div className="runStats"><article><span>Runs</span><strong>{props.runs.length}</strong><p>最近 50 条</p></article><article><span>成功</span><strong>{successCount}</strong><p>成功完成</p></article><article><span>等待</span><strong>{waitingCount}</strong><p>人工任务</p></article><article><span>失败</span><strong>{failedCount}</strong><p>需排障</p></article><article><span>平均耗时</span><strong>{avgLatency}ms</strong><p>端到端</p></article></div>{props.loading && <StatePanel icon="loading" title="正在同步运行记录" text="正在读取当前空间的 Run、Trace 摘要和最近执行状态。" />}{!props.loading && !props.error && !props.runs.length && <StatePanel title="暂无运行记录" text="发布应用后在设计页试运行，或通过 API 调用应用，即可在这里看到 Run 和 Trace。" />}{!props.loading && props.runs.length > 0 && <div className="runObsGrid"><aside className="runListPane designCard"><div className="sectionTitle"><Play size={18} /><div><h2>Run 列表</h2><p>按创建时间倒序</p></div></div>{props.runs.map((run) => <button key={run.runId} className={`runListItem ${props.selectedRunId === run.runId ? "active" : ""}`} onClick={() => props.selectRun(run.runId)}><span className={`runStatus ${run.status}`}>{run.status}</span><strong>{run.appName}</strong><small>{run.runId}</small><em>{formatDate(run.createdAt)} · {run.latencyMs ?? 0}ms</em></button>)}</aside><main className="runDetailPane"><section className="designCard"><div className="runDetailTop"><div><h2>{props.selectedRun?.appName || "未选择 Run"}</h2><p>{props.selectedRun?.runId} · {props.selectedRun?.runType} · version {props.selectedRun?.appVersionId || "-"}</p></div>{props.selectedRun && <span className={`runStatus large ${props.selectedRun.status}`}>{props.selectedRun.status}</span>}</div>{props.selectedRun && <div className="runMetaGrid"><dl><dt>App ID</dt><dd>{props.selectedRun.appId}</dd><dt>Run Type</dt><dd>{props.selectedRun.runType}</dd><dt>Latency</dt><dd>{props.selectedRun.latencyMs ?? 0}ms</dd><dt>Tokens</dt><dd>{props.selectedRun.totalTokens ?? 0}</dd><dt>Wait Task</dt><dd>{props.selectedRun.currentWaitTaskId || "-"}</dd><dt>Created</dt><dd>{formatDate(props.selectedRun.createdAt)}</dd></dl>{selectedAppRecord && <button className="ghostBtn" onClick={() => props.openDesigner(selectedAppRecord)}><Settings2 size={16} /> 打开应用设计</button>}</div>}{props.selectedRun?.errorMessage && <div className="warningBox"><AlertCircle size={16} /> {props.selectedRun.errorMessage}</div>}<div className="ioGrid"><CodeBlock title="Run Input" code={JSON.stringify(props.selectedRun?.input || {}, null, 2)} /><CodeBlock title="Run Output" code={JSON.stringify(props.selectedRun?.output || {}, null, 2)} /></div></section><section className="designCard"><div className="sectionTitle"><Workflow size={18} /><div><h2>Trace 时间线</h2><p>{props.tracesLoading ? "正在加载 Trace" : `${props.traces.length} 个步骤`}</p></div></div>{props.tracesLoading && <StatePanel icon="loading" title="正在加载 Trace" text="正在读取节点、模型、工具或检索步骤。" />}{!props.tracesLoading && !props.traces.length && <StatePanel title="暂无 Trace" text="该 Run 尚未写入 Trace，或当前记录还在执行中。" />}{!props.tracesLoading && props.traces.map((trace, index) => <article className="traceItem" key={trace.id}><div className="traceIndex">{index + 1}</div><div className="traceBody"><div><strong>{trace.name}</strong><span className={`runStatus ${trace.status}`}>{trace.status}</span></div><p>{trace.type} · {trace.latencyMs ?? 0}ms · {formatDate(trace.createdAt)}</p>{trace.errorMessage && <div className="warningBox"><AlertCircle size={16} /> {trace.errorMessage}</div>}<div className="ioGrid compact"><CodeBlock title="Input" code={JSON.stringify(trace.input || {}, null, 2)} /><CodeBlock title="Output" code={JSON.stringify(trace.output || {}, null, 2)} /></div></div></article>)}</section></main></div>}</section>;
}

function KnowledgePage(props: { datasets: DatasetRecord[]; documents: DocumentRecord[]; retrieveRecords: RetrieveRecord[]; selectedDatasetId: string; loading: boolean; error: string; newDatasetName: string; newDocumentText: string; retrieveQuery: string; knowledgeFile: File | null; busyAction: string; setNewDatasetName: (value: string) => void; setNewDocumentText: (value: string) => void; setRetrieveQuery: (value: string) => void; setKnowledgeFile: (file: File | null) => void; refreshKnowledge: () => Promise<void>; selectDataset: (datasetId: string) => Promise<void>; createDataset: () => Promise<void>; addDocument: () => Promise<void>; uploadDocumentFile: () => Promise<void>; retrieveTest: () => Promise<void> }) {
  const selected = props.datasets.find((dataset) => dataset.id === props.selectedDatasetId);
  const uploadBusy = props.busyAction === "document-upload";
  return <section className="workspacePane opsPane"><div className="pageHeader"><div><h1>知识库</h1><p>完成数据集、文件上传解析、文档写入、索引状态和检索测试闭环。</p></div><div className="headerActions"><button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshKnowledge()}>{props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button><button className="primaryBtn" disabled={props.busyAction === "dataset"} onClick={() => void props.createDataset()}><Database size={16} /> 创建知识库</button></div></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshKnowledge()}>重试</button></div>}<div className="opsGrid"><aside className="designCard opsList"><Field label="新知识库名称"><input value={props.newDatasetName} onChange={(event) => props.setNewDatasetName(event.target.value)} /></Field>{props.datasets.map((dataset) => <button className={`runListItem ${dataset.id === props.selectedDatasetId ? "active" : ""}`} key={dataset.id} onClick={() => void props.selectDataset(dataset.id)}><span className="runStatus success">{dataset.status}</span><strong>{dataset.name}</strong><small>{dataset.id}</small><em>{dataset.chunkStrategy || "fixed"} · {formatDate(dataset.updatedAt)}</em></button>)}{!props.datasets.length && !props.loading && <StatePanel title="暂无知识库" text="输入名称并点击创建知识库，然后上传文件或添加文本文档。" />}</aside><main className="opsMain"><section className="designCard"><div className="sectionTitle"><FileText size={18} /><div><h2>{selected?.name || "选择知识库"}</h2><p>{selected ? `${selected.id} · ${props.documents.length} 个文档` : "创建或选择一个数据集后管理文档。"}</p></div></div><div className="formGrid two"><Field label="上传文件解析"><div className={`fileUploadBox uploadDropzone ${props.knowledgeFile ? "selected" : ""}`}><div className="uploadDropzoneMain"><span className="uploadIcon"><UploadCloud size={24} /></span><div><strong>{props.knowledgeFile ? props.knowledgeFile.name : "选择文本资料上传"}</strong><p>支持 txt、md、csv、json 等文本类文件，上传后自动解析为文档并生成 chunk。</p>{props.knowledgeFile && <small>{formatFileSize(props.knowledgeFile.size)} · 准备上传并索引</small>}</div></div><input id="knowledge-file-input" className="visuallyHiddenInput" type="file" accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json,text/csv" onChange={(event) => props.setKnowledgeFile(event.target.files?.[0] || null)} /><div className="uploadActions"><label className="filePickBtn" htmlFor="knowledge-file-input">选择文件</label>{props.knowledgeFile && <button className="ghostTinyBtn" disabled={uploadBusy} onClick={() => props.setKnowledgeFile(null)}>移除</button>}<button className="primaryBtn" disabled={!props.selectedDatasetId || !props.knowledgeFile || uploadBusy} onClick={() => void props.uploadDocumentFile()}>{uploadBusy ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} 上传并索引</button></div></div></Field><PromptEditor title="内联文本文档" label="文本文档内容" description="适合快速录入政策、FAQ、流程说明；写入后会立刻进入轻量索引。" value={props.newDocumentText} onChange={props.setNewDocumentText} icon={<FileText size={18} />} /></div><div className="stackPanel horizontal"><button className="ghostBtn" disabled={!props.selectedDatasetId || props.busyAction === "document"} onClick={() => void props.addDocument()}>{props.busyAction === "document" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} 写入文本并索引</button><p className="mutedText">轻量索引会直接生成 chunk，可立即用于检索测试和 Agent 知识挂载。</p></div><div className="tableList">{props.documents.map((document) => <article key={document.id}><div><strong>{document.name}</strong><small>{document.id}</small></div><span className={`runStatus ${document.indexStatus === "success" ? "success" : "running"}`}>{document.indexStatus}</span><em>{document.sourceType} · {formatDate(document.updatedAt)}</em></article>)}</div></section><section className="designCard"><div className="sectionTitle"><Search size={18} /><div><h2>检索测试</h2><p>验证 TopK 命中、score 和片段内容。</p></div></div><div className="inlineForm"><input value={props.retrieveQuery} onChange={(event) => props.setRetrieveQuery(event.target.value)} placeholder="输入 query" /><button className="primaryBtn" disabled={!props.selectedDatasetId || props.busyAction === "retrieve"} onClick={() => void props.retrieveTest()}>{props.busyAction === "retrieve" ? <Loader2 className="spin" size={16} /> : <Search size={16} />} 检索</button></div><div className="resultCards">{props.retrieveRecords.map((record) => <article key={record.chunk_id}><strong>score {record.score.toFixed(2)}</strong><p>{record.content}</p><small>{record.document_id} / {record.chunk_id}</small></article>)}</div>{!props.retrieveRecords.length && <p className="mutedText">暂无命中结果，写入文档后执行检索测试。</p>}</section></main></div></section>;
}

function TaskCenterPage(props: { tasks: WaitTaskRecord[]; loading: boolean; error: string; filter: string; busyAction: string; setFilter: (value: string) => void; refreshTasks: () => Promise<void>; submitTask: (task: WaitTaskRecord, action?: string) => Promise<void> }) {
  const pending = props.tasks.filter((task) => task.status === "pending").length;
  return <section className="workspacePane opsPane"><div className="pageHeader"><div><h1>流程等待</h1><p>这是 Workflow 在人工确认、表单补充等节点暂停后生成的待处理项；可由业务操作员在这里提交，流程会自动恢复。</p></div><button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshTasks()}>{props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshTasks()}>重试</button></div>}<div className="runStats"><article><span>等待项</span><strong>{props.tasks.length}</strong><p>当前空间</p></article><article><span>待用户操作</span><strong>{pending}</strong><p>pending</p></article><article><span>已处理</span><strong>{props.tasks.length - pending}</strong><p>submitted/rejected</p></article><article><span>筛选</span><strong>{props.filter}</strong><p>状态过滤</p></article><article><span>用途</span><strong><Zap size={24} /></strong><p>流程恢复</p></article></div><div className="filterTabs opsFilters">{["all", "pending", "submitted", "rejected", "cancelled", "expired"].map((item) => <button key={item} className={props.filter === item ? "active" : ""} onClick={() => props.setFilter(item)}>{item}</button>)}</div>{props.loading && <StatePanel icon="loading" title="正在同步等待项" text="正在读取当前空间的流程等待任务。" />}{!props.loading && !props.tasks.length && <StatePanel title="暂无流程等待" text="运行包含人工确认节点的 Workflow 后，会在这里出现 pending 等待项；外部用户端也可以通过 API 对接处理。" />}{!props.loading && props.tasks.length > 0 && <div className="taskGrid">{props.tasks.map((task) => <article className="designCard taskCard" key={task.id}><div className="taskHeader"><span className={`runStatus ${task.status}`}>{task.status}</span><small>{formatDate(task.createdAt)}</small></div><h2>{task.title || task.nodeId}</h2><p>{task.description || "等待业务用户或操作员处理。"}</p><dl><dt>应用</dt><dd>{task.appName}</dd><dt>Run</dt><dd>{task.runId}</dd><dt>节点</dt><dd>{task.nodeId} / {task.nodeType}</dd><dt>过期</dt><dd>{formatDate(task.expiresAt)}</dd></dl><CodeBlock title="上下文" code={JSON.stringify(task.context || {}, null, 2)} />{task.status === "pending" && <div className="buttonRow"><button className="primaryBtn" disabled={props.busyAction === `wait-${task.id}`} onClick={() => void props.submitTask(task, "approve")}>{props.busyAction === `wait-${task.id}` ? <Loader2 className="spin" size={16} /> : <ClipboardCheck size={16} />} 确认继续</button><button className="dangerBtn" disabled={props.busyAction === `wait-${task.id}`} onClick={() => void props.submitTask(task, "reject")}>拒绝</button></div>}</article>)}</div>}</section>;
}

function ProviderPage(props: { providers: ProviderRecord[]; loading: boolean; error: string; form: ProviderForm; busyAction: string; setForm: (form: ProviderForm) => void; refreshProviders: () => Promise<void>; createProvider: () => Promise<void>; testProvider: (provider: ProviderRecord) => Promise<void>; disableProvider: (provider: ProviderRecord) => Promise<void> }) {
  const activeCount = props.providers.filter((provider) => provider.status === "active").length;
  const providerTypes = ["openai_compatible", "openai", "azure_openai", "dashscope", "deepseek", "ollama", "custom"];
  return <section className="workspacePane opsPane"><div className="pageHeader"><div><h1>模型供应商</h1><p>配置 OpenAI Compatible、私有大模型网关或企业模型账号，供 Agent / Workflow LLM 节点使用。</p></div><button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshProviders()}>{props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshProviders()}>重试</button></div>}<div className="runStats"><article><span>供应商</span><strong>{props.providers.length}</strong><p>当前空间</p></article><article><span>Active</span><strong>{activeCount}</strong><p>可用于运行</p></article><article><span>模型选项</span><strong>{props.providers.filter((item) => item.defaultChatModel).length}</strong><p>Agent 下拉来源</p></article><article><span>密钥</span><strong>{props.providers.filter((item) => item.hasApiKey).length}</strong><p>已配置 API Key</p></article><article><span>模式</span><strong>LLM</strong><p>Chat / Embedding</p></article></div><div className="opsGrid"><aside className="designCard opsList"><div className="sectionTitle"><Settings2 size={18} /><div><h2>新增供应商</h2><p>API Key 只写入后端，不会在列表中回显。</p></div></div><Field label="名称"><input value={props.form.name} onChange={(event) => props.setForm({ ...props.form, name: event.target.value })} /></Field><Field label="类型"><select value={props.form.providerType} onChange={(event) => props.setForm({ ...props.form, providerType: event.target.value })}>{providerTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label="Base URL"><input value={props.form.baseUrl} onChange={(event) => props.setForm({ ...props.form, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></Field><Field label="API Key"><input type="password" value={props.form.apiKey} onChange={(event) => props.setForm({ ...props.form, apiKey: event.target.value })} placeholder="sk-..." /></Field><Field label="默认 Chat Model"><input value={props.form.defaultChatModel} onChange={(event) => props.setForm({ ...props.form, defaultChatModel: event.target.value })} /></Field><Field label="默认 Embedding Model"><input value={props.form.defaultEmbeddingModel} onChange={(event) => props.setForm({ ...props.form, defaultEmbeddingModel: event.target.value })} /></Field><Field label="扩展配置 JSON"><textarea value={props.form.configJson} onChange={(event) => props.setForm({ ...props.form, configJson: event.target.value })} /></Field><button className="primaryBtn" disabled={props.busyAction === "provider-create"} onClick={() => void props.createProvider()}>{props.busyAction === "provider-create" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} 保存供应商</button></aside><main className="opsMain"><section className="designCard"><div className="sectionTitle"><Bot size={18} /><div><h2>供应商账号</h2><p>模型配置入口已接入后端 Provider API。</p></div></div>{props.loading && <StatePanel icon="loading" title="正在同步供应商" text="正在读取当前空间的模型供应商账号。" />}{!props.loading && !props.providers.length && <StatePanel title="暂无模型供应商" text="先在左侧保存一个 OpenAI Compatible 或企业模型网关账号。" />}{!props.loading && props.providers.length > 0 && <div className="tableList providerList">{props.providers.map((provider) => <article key={provider.id}><div><strong>{provider.name}</strong><small>{provider.providerType} · {provider.baseUrl}</small><small>Chat: {provider.defaultChatModel || "-"} · Embedding: {provider.defaultEmbeddingModel || "-"}</small></div><span className={`runStatus ${provider.status === "active" ? "success" : "cancelled"}`}>{provider.status}</span><em>{provider.hasApiKey ? "已配置 Key" : "未配置 Key"}</em><div className="buttonRow"><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.testProvider(provider)}>{props.busyAction === `provider-test-${provider.id}` ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 测试</button><button className="dangerBtn" disabled={!!props.busyAction || provider.status !== "active"} onClick={() => void props.disableProvider(provider)}>禁用</button></div></article>)}</div>}</section></main></div></section>;
}

function OrgOpsPage(props: { tenants: TenantRecord[]; workspaces: WorkspaceRecord[]; apiKeys: ApiKeyRecord[]; usage: UsageSummary | null; auditEvents: AuditEvent[]; session: AuthSession; loading: boolean; error: string; refreshOrg: () => Promise<void> }) {
  const usage = props.usage;
  const roleLabel = props.session.role === "admin" || (!props.session.role && props.session.userId === "admin") ? "管理员" : "成员";
  const activeKeys = props.apiKeys.filter((key) => key.status === "active").length;
  return <section className="workspacePane orgPane"><div className="pageHeader"><div><h1>组织运营</h1><p>用于确认当前空间的权限边界、资源消耗、集成凭据和最近关键操作。</p></div><button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshOrg()}>{props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新</button></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshOrg()}>重试</button></div>}<div className="orgHero"><div className="orgHeroText"><span><Building2 size={18} /> 当前组织上下文</span><h2>{props.session.tenantId} / {props.session.workspaceId}</h2><p>这里不是业务配置入口，而是管理员看“谁在什么空间、用了多少、开放了哪些 Key、最近做了什么”的运营视图。</p></div><div className="orgHeroCards"><article><small>账号角色</small><strong>{roleLabel}</strong><p>{props.session.displayName || props.session.userId}</p></article><article><small>可见空间</small><strong>{props.workspaces.length}</strong><p>{roleLabel === "管理员" ? "管理员可查看全部授权空间" : "成员仅查看授权空间"}</p></article><article><small>活跃 Key</small><strong>{activeKeys}</strong><p>外部系统调用 Runtime API 的凭据</p></article></div></div><div className="orgKpiGrid"><article><span>应用总数</span><strong>{usage?.applications ?? 0}</strong><p>已发布 {usage?.publishedApps ?? 0}</p></article><article><span>知识资产</span><strong>{usage?.datasets ?? 0}</strong><p>文档 {usage?.documents ?? 0}</p></article><article><span>运行次数</span><strong>{usage?.runs ?? 0}</strong><p>失败 {usage?.failedRuns ?? 0} · 等待 {usage?.waitingRuns ?? 0}</p></article><article><span>等待任务</span><strong>{usage?.pendingWaitTasks ?? 0}</strong><p>待处理 / 总计 {usage?.waitTasks ?? 0}</p></article><article><span>Token</span><strong>{usage?.totalTokens ?? 0}</strong><p>累计消耗</p></article><article><span>平均耗时</span><strong>{usage?.averageLatencyMs ?? 0}ms</strong><p>端到端运行</p></article></div><div className="orgPanelGrid"><section className="designCard"><div className="sectionTitle"><ShieldCheck size={18} /><div><h2>空间与权限边界</h2><p>应用、知识库、模型供应商、Key 和运行记录都按 workspace 隔离。</p></div></div><div className="scopeStack">{props.tenants.map((tenant) => <article key={tenant.id} className="scopeItem tenant"><div><strong>{tenant.name}</strong><small>{tenant.code} · {tenant.plan}</small></div><span className="runStatus success">{tenant.status}</span></article>)}{props.workspaces.map((workspace) => <article key={workspace.id} className={`scopeItem ${workspace.id === props.session.workspaceId ? "active" : ""}`}><div><strong>{workspace.name || workspace.id}</strong><small>{workspace.tenantId}</small></div><span>{workspace.id === props.session.workspaceId ? "当前空间" : workspace.status}</span></article>)}</div></section><section className="designCard"><div className="sectionTitle"><Code2 size={18} /><div><h2>API Key 与集成范围</h2><p>外部系统通过这些 Key 调用 Runtime API；明文只在创建时返回。</p></div></div><div className="keyList">{props.apiKeys.map((key) => <article key={key.id}><div><strong>{key.name}</strong><small>{key.keyPrefix}*** · {key.appId ? "应用级" : "空间级"}</small></div><span className={`runStatus ${key.status === "active" ? "success" : "cancelled"}`}>{key.status}</span><em>{key.appId || key.workspaceId || props.session.workspaceId}</em></article>)}{!props.apiKeys.length && <StatePanel title="暂无 API Key" text="在应用 API 文档或设计页生成 Key 后，会在这里看到 scope 和状态。" />}</div></section><section className="designCard orgAuditCard"><div className="sectionTitle"><ClipboardCheck size={18} /><div><h2>最近审计事件</h2><p>追踪发布、Key 创建、知识索引等会影响运行的操作。</p></div></div><div className="auditTimeline">{props.auditEvents.map((event) => <article key={`${event.type}-${event.id}`}><span>{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p><small>{event.actor} · {event.target} · {formatDate(event.createdAt)}</small></article>)}</div>{!props.auditEvents.length && <StatePanel title="暂无审计事件" text="发布应用、创建 Key 或写入知识文档后会生成审计摘要。" />}</section></div></section>;
}

function EndpointRow({ method, path }: { method: string; path: string }) {
  return <div className="endpointRow"><strong>{method}</strong><span>{path}</span><CopyButton text={path} /></div>;
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return <div className="codeBlock"><div><strong>{title}</strong><CopyButton text={code} /></div><pre>{code}</pre></div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="copyBtn" onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>{copied ? "已复制" : "复制"}</button>;
}

function StatePanel({ icon = "empty", title, text }: { icon?: "empty" | "loading" | "missing"; title: string; text: string }) {
  return <div className="statePanel">{icon === "loading" ? <Loader2 className="spin" size={28} /> : <Boxes size={28} />}<strong>{title}</strong><span>{text}</span></div>;
}

function AgentDesigner({ draft, setDraft, modelOptions, runResult, runtimeKey, setRuntimeKey }: { draft: AgentDraft; setDraft: (draft: AgentDraft) => void; modelOptions: string[]; runResult: Record<string, unknown> | null; runtimeKey: string; setRuntimeKey: (value: string) => void }) {
  const mode = agentModes[0];
  const definition = buildAgentDefinition(draft);
  const options = modelOptions.includes(draft.model) ? modelOptions : [draft.model, ...modelOptions].filter(Boolean);
  return <div className="agentLayout"><section className="designCard mainDesignCard"><div className="sectionTitle"><mode.icon size={20} /><div><h2>{mode.typeLabel}设计</h2><p>{mode.description}</p></div></div><div className="formGrid two"><Field label="模型"><select value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })}>{options.map((model) => <option key={model} value={model}>{model}</option>)}</select></Field><Field label="Temperature"><input type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })} /></Field></div><AutonomousAgentForm draft={draft} setDraft={setDraft} /><Field label="开场白"><input value={draft.opening} onChange={(event) => setDraft({ ...draft, opening: event.target.value })} /></Field></section><aside className="previewStack"><section className="designCard compact"><h3>Runtime Key</h3><input value={runtimeKey} onChange={(event) => setRuntimeKey(event.target.value)} placeholder="sk_..." /></section><section className="designCard preview"><h3>Definition</h3><pre>{JSON.stringify(definition, null, 2)}</pre></section><section className="designCard preview"><h3>Run Result</h3><pre>{JSON.stringify(runResult || { hint: "发布后可生成 Key 并试运行。" }, null, 2)}</pre></section></aside></div>;
}

function AutonomousAgentForm({ draft, setDraft }: { draft: AgentDraft; setDraft: (draft: AgentDraft) => void }) {
  return <><PromptEditor title="Agent 规划策略" label="策略提示" description="描述 Agent 如何拆解任务、选择工具、检索知识和组织回答。" value={draft.toolPlan} onChange={(value) => setDraft({ ...draft, toolPlan: value })} icon={<Workflow size={18} />} /><PromptEditor title="角色与约束" label="系统提示" description="定义角色边界、语气、安全约束和输出要求，会写入发布定义。" value={draft.system} onChange={(value) => setDraft({ ...draft, system: value })} icon={<Bot size={18} />} /></>;
}

function PromptEditor({ title, label, description, value, onChange, icon }: { title: string; label: string; description: string; value: string; onChange: (value: string) => void; icon: React.ReactNode }) {
  const lineCount = value ? value.split(/\r?\n/).length : 0;
  const charCount = value.trim().length;
  return <section className="promptEditor"><div className="promptEditorHeader"><span className="promptEditorIcon">{icon}</span><div><small>{label}</small><strong>{title}</strong><p>{description}</p></div><em>{lineCount} 行 · {charCount} 字</em></div><textarea value={value} onChange={(event) => onChange(event.target.value)} /></section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field"><span>{label}</span>{children}</div>;
}

type WorkflowDesignerProps = {
  canvasRef: React.RefObject<HTMLDivElement>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  connecting: ConnectState | null;
  selectedNode?: WorkflowNode;
  selectedEdge?: WorkflowEdge;
  workflowDefinition: Record<string, unknown>;
  addNode: (type: WorkflowNodeType) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, condition: string) => void;
  updateNode: (nodeId: string, patch: Partial<WorkflowNode>) => void;
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
  startDrag: (event: React.PointerEvent, node: WorkflowNode) => void;
  startConnect: (event: React.PointerEvent, node: WorkflowNode) => void;
  finishConnect: (event: React.PointerEvent, targetId: string) => void;
  moveOnCanvas: (event: React.PointerEvent) => void;
  stopCanvasInteraction: () => void;
  selectNode: (nodeId: string) => void;
  selectEdge: (edgeId: string) => void;
};

function WorkflowDesigner(props: WorkflowDesignerProps) {
  return <div className="workflowLayout"><aside className="nodePalette designCard"><h3>节点</h3>{(Object.keys(nodeMeta) as WorkflowNodeType[]).map((type) => <button className="paletteItem" key={type} onClick={() => props.addNode(type)}><span className={`dot ${nodeMeta[type].accent}`} /><strong>{nodeMeta[type].name}</strong><small>{nodeMeta[type].description}</small><Plus size={14} /></button>)}<p className="gestureTip"><MousePointer2 size={15} /> 拖动节点移动，从右侧端口拖到另一节点左侧端口连线。</p></aside><div className="workflowCanvas" ref={props.canvasRef} onPointerMove={props.moveOnCanvas} onPointerUp={props.stopCanvasInteraction} onPointerLeave={props.stopCanvasInteraction}><svg className="edgeLayer" width="100%" height="100%"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#2563eb" /></marker></defs>{props.edges.map((edge) => { const from = props.nodes.find((node) => node.id === edge.from); const to = props.nodes.find((node) => node.id === edge.to); if (!from || !to) return null; return <path key={edge.id} className="edgePath" d={edgePath(from.x + nodeSize.width, from.y + nodeSize.height / 2, to.x, to.y + nodeSize.height / 2)} markerEnd="url(#arrow)" onPointerDown={(event) => { event.stopPropagation(); props.selectEdge(edge.id); }} />; })}{props.connecting && <path className="edgePath draft" d={edgePath(nodeOutX(props.nodes, props.connecting.from), nodeOutY(props.nodes, props.connecting.from), props.connecting.x, props.connecting.y)} />}</svg>{props.nodes.map((node) => <article className={`workflowNode ${node.type} ${props.selectedNode?.id === node.id ? "selected" : ""}`} style={{ transform: `translate(${node.x}px, ${node.y}px)` }} key={node.id} onPointerDown={(event) => props.startDrag(event, node)}><button className="port in" aria-label="连接入口" onPointerUp={(event) => props.finishConnect(event, node.id)} /><div className="nodeHead" onPointerDown={() => props.selectNode(node.id)}><span className={`dot ${nodeMeta[node.type].accent}`} /><strong>{node.label}</strong></div><p>{nodeMeta[node.type].description}</p><small>{node.id}</small><button className="port out" aria-label="连接出口" onPointerDown={(event) => props.startConnect(event, node)} /></article>)}</div><aside className="inspector designCard"><div className="sectionTitle"><PanelRight size={18} /><h3>属性</h3></div>{props.selectedNode && <div className="inspectorStack"><Field label="节点名称"><input value={props.selectedNode.label} onChange={(event) => props.updateNode(props.selectedNode!.id, { label: event.target.value })} /></Field><Field label="节点 ID"><input value={props.selectedNode.id} readOnly /></Field>{nodeConfigKeys(props.selectedNode.type).map((key) => <Field key={key} label={key}><textarea value={configValueToString(props.selectedNode?.config[key])} onChange={(event) => props.updateNodeConfig(props.selectedNode!.id, key, event.target.value)} /></Field>)}<button className="dangerBtn" disabled={props.selectedNode.id === "start" || props.selectedNode.id === "end"} onClick={() => props.removeNode(props.selectedNode!.id)}><X size={16} /> 删除节点</button></div>}{props.selectedEdge && <div className="inspectorStack"><Field label="连线"><input value={`${props.selectedEdge.from} → ${props.selectedEdge.to}`} readOnly /></Field><Field label="条件表达式"><textarea value={props.selectedEdge.condition || ""} onChange={(event) => props.updateEdge(props.selectedEdge!.id, event.target.value)} placeholder="{{confirm.action == 'approve'}}" /></Field><button className="dangerBtn" onClick={() => props.removeEdge(props.selectedEdge!.id)}><X size={16} /> 删除连线</button></div>}{!props.selectedNode && !props.selectedEdge && <p className="mutedText">选择节点或连线后编辑属性。</p>}<div className="definitionPreview"><h3>Workflow JSON</h3><pre>{JSON.stringify(props.workflowDefinition, null, 2)}</pre></div></aside></div>;
}

function buildAgentDefinition(draft: AgentDraft) {
  return { type: "agent", agentMode: draft.mode, model: { chatModel: draft.model, temperature: draft.temperature, maxTokens: 1024 }, prompt: { system: draft.system }, knowledge: [], tools: [], memory: { enabled: true, windowMessages: 10 }, output: { format: "text" }, ui: { opening: draft.opening, toolPlan: draft.toolPlan } };
}

function buildWorkflowDefinition(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  return { type: "workflow", inputs: [{ name: "question", type: "string", required: true }, { name: "operator_id", type: "string", required: false }], nodes: nodes.map((node) => ({ id: node.id, type: node.type, config: node.config })), edges: edges.map((edge) => ({ from: edge.from, to: edge.to, ...(edge.condition ? { condition: edge.condition } : {}) })), ui: { nodes: nodes.map((node) => ({ id: node.id, label: node.label, x: node.x, y: node.y })) } };
}

function restoreWorkflowDefinition(definition: Record<string, any>): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const uiNodes = Array.isArray(definition.ui?.nodes) ? definition.ui.nodes : [];
  const nodes = Array.isArray(definition.nodes) && definition.nodes.length ? definition.nodes.map((item: Record<string, any>, index: number) => { const type = normalizeNodeType(item.type); const ui = uiNodes.find((candidate: Record<string, any>) => candidate.id === item.id) || {}; return { id: String(item.id || `${type}_${index}`), type, label: String(ui.label || nodeMeta[type].name), x: Number(ui.x ?? 72 + index * 260), y: Number(ui.y ?? 160 + (index % 2) * 100), config: typeof item.config === "object" && item.config ? item.config : {} } as WorkflowNode; }) : defaultNodes.map((item) => ({ ...item, config: { ...item.config } }));
  const edges = Array.isArray(definition.edges) ? definition.edges.map((item: Record<string, any>, index: number) => ({ id: `edge_${String(item.from)}_${String(item.to)}_${index}`, from: String(item.from), to: String(item.to), condition: item.condition ? String(item.condition) : undefined })) : defaultEdges.map((item) => ({ ...item }));
  return { nodes, edges };
}

function configValueToString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function parseConfigValue(key: string, value: string): unknown {
  const trimmed = value.trim();
  if (["topK", "scoreThreshold", "expiresInSeconds"].includes(key) && trimmed !== "") {
    const numeric = Number(trimmed);
    return Number.isNaN(numeric) ? value : numeric;
  }
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function normalizeAgentMode(mode: unknown): AgentMode {
  return mode === "agent" ? "agent" : "agent";
}

function normalizeNodeType(type: unknown): WorkflowNodeType {
  return type === "start" || type === "llm" || type === "agent" || type === "tool" || type === "http_request" || type === "knowledge_retrieval" || type === "user_confirm" || type === "user_form" || type === "condition" || type === "variable" || type === "code" || type === "end" ? type : "llm";
}

function defaultNodeConfig(type: WorkflowNodeType): Record<string, unknown> {
  if (type === "llm") return { prompt: "请根据上下文处理：{{inputs.question}}" };
  if (type === "agent") return { query: "{{inputs.question}}" };
  if (type === "tool") return { toolId: "", input: "{{inputs}}" };
  if (type === "http_request") return { url: "https://example.com/webhook", method: "POST", body: "{{inputs}}" };
  if (type === "knowledge_retrieval") return { datasetId: "", query: "{{inputs.question}}", topK: 5, scoreThreshold: 0 };
  if (type === "user_confirm") return { title: "等待人工确认", description: "{{answer.text}}", actions: [{ key: "approve", label: "确认" }, { key: "reject", label: "拒绝" }] };
  if (type === "user_form") return { title: "补充信息", description: "{{answer.text}}", formSchema: { type: "object", properties: { comment: { type: "string", title: "备注" } } } };
  if (type === "condition") return { expression: "{{confirm.action == 'approve'}}" };
  if (type === "variable") return { result: "{{inputs.question}}" };
  if (type === "code") return { language: "javascript", code: "return inputs;" };
  if (type === "end") return { output: "{{answer.text}}" };
  return {};
}

function nodeConfigKeys(type: WorkflowNodeType) {
  if (type === "llm") return ["prompt"];
  if (type === "agent") return ["query"];
  if (type === "tool") return ["toolId", "input"];
  if (type === "http_request") return ["url", "method", "body"];
  if (type === "knowledge_retrieval") return ["datasetId", "query", "topK", "scoreThreshold"];
  if (type === "user_confirm") return ["title", "description"];
  if (type === "user_form") return ["title", "description", "formSchema"];
  if (type === "condition") return ["expression"];
  if (type === "variable") return ["result"];
  if (type === "code") return ["language", "code"];
  if (type === "end") return ["output"];
  return [];
}

function edgePath(x1: number, y1: number, x2: number, y2: number) {
  const distance = Math.max(70, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + distance} ${y1}, ${x2 - distance} ${y2}, ${x2} ${y2}`;
}

function nodeOutX(nodes: WorkflowNode[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  return (node?.x || 0) + nodeSize.width;
}

function nodeOutY(nodes: WorkflowNode[], nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  return (node?.y || 0) + nodeSize.height / 2;
}

function formatDate(value?: string) {
  if (!value) return "刚刚";
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function parseRoute(): RouteState {
  const hash = window.location.hash.replace(/^#/, "") || "/apps";
  if (hash === "/knowledge") return { view: "knowledge" };
  if (hash === "/tasks") return { view: "tasks" };
  if (hash === "/providers") return { view: "providers" };
  if (hash === "/org") return { view: "org" };
  if (hash === "/observability/runs") return { view: "observability" };
  const experienceMatch = hash.match(/^\/apps\/([^/]+)\/experience$/);
  if (experienceMatch?.[1]) return { view: "experience", appId: decodeURIComponent(experienceMatch[1]) };
  const apiMatch = hash.match(/^\/apps\/([^/]+)\/api$/);
  if (apiMatch?.[1]) return { view: "api", appId: decodeURIComponent(apiMatch[1]) };
  const runsMatch = hash.match(/^\/apps\/([^/]+)\/runs$/);
  if (runsMatch?.[1]) return { view: "observability", appId: decodeURIComponent(runsMatch[1]) };
  const match = hash.match(/^\/apps\/([^/]+)/);
  if (match?.[1]) return { view: "designer", appId: decodeURIComponent(match[1]) };
  return { view: "center" };
}

function navigateCenter() {
  if (window.location.hash !== "#/apps") window.location.hash = "#/apps";
}

function navigateDesigner(app: AppRecord) {
  const segment = app.type === "workflow" ? "workflow" : "agent";
  const nextHash = `#/apps/${encodeURIComponent(app.id)}/${segment}`;
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

function navigateApiDocs(app: AppRecord) {
  const nextHash = `#/apps/${encodeURIComponent(app.id)}/api`;
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

function navigateExperience(app: AppRecord) {
  const nextHash = `#/apps/${encodeURIComponent(app.id)}/experience`;
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

function navigateObservability(app?: AppRecord) {
  const nextHash = app ? `#/apps/${encodeURIComponent(app.id)}/runs` : "#/observability/runs";
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
}

function navigateKnowledge() {
  if (window.location.hash !== "#/knowledge") window.location.hash = "#/knowledge";
}

function navigateProviders() {
  if (window.location.hash !== "#/providers") window.location.hash = "#/providers";
}

function navigateOrg() {
  if (window.location.hash !== "#/org") window.location.hash = "#/org";
}

function runtimeOutputText(outputs?: Record<string, unknown>, status = "success") {
  if (!outputs || !Object.keys(outputs).length) return status === "success" ? "流程已完成。" : `运行状态：${status}`;
  const answer = outputs.answer;
  if (typeof answer === "string" && answer.trim()) return answer;
  const text = outputs.outputs || outputs.text || outputs.output || outputs.result;
  if (typeof text === "string" && text.trim()) return text;
  return JSON.stringify(outputs, null, 2);
}

function waitTaskActions(task: RuntimeWaitTask) {
  const raw = task.actions;
  if (Array.isArray(raw)) {
    const actions = raw.map((item) => {
      if (typeof item === "string") return { key: item, label: item };
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const key = String(record.key || record.value || record.action || "approve");
        return { key, label: String(record.label || record.name || key) };
      }
      return null;
    }).filter((item): item is { key: string; label: string } => !!item);
    if (actions.length) return actions;
  }
  return [{ key: "approve", label: "确认继续" }, { key: "reject", label: "拒绝" }];
}

function readStoredConsoleSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem("aio.consoleSession");
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || session.expiresAt * 1000 < Date.now()) {
      clearStoredConsoleSession();
      return null;
    }
    return session;
  } catch {
    clearStoredConsoleSession();
    return null;
  }
}

function clearStoredConsoleSession() {
  localStorage.removeItem("aio.consoleSession");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getAppStatusMeta(app: AppRecord) {
  if (app.status === "published") return { label: "已发布", tone: "success" };
  if (app.status === "published_with_draft") return { label: "有未发布变更", tone: "warning" };
  if (app.status === "disabled") return { label: "已禁用", tone: "danger" };
  if (app.status === "archived") return { label: "已归档", tone: "muted" };
  if (app.publishedVersionId) return { label: "有未发布变更", tone: "warning" };
  return { label: "草稿", tone: "draft" };
}

function buildApiDocs(app: AppRecord, runtimeKey: string) {
  const baseUrl = window.location.origin;
  const key = runtimeKey || "sk_REPLACE_ME";
  if (app.type === "workflow") {
    const body = JSON.stringify({ inputs: { question: "这个客户应该怎么跟进？", operator_id: "user_001" }, response_mode: "blocking", metadata: { external_biz_id: "crm_task_123" } }, null, 2);
    return {
      baseUrl,
      primaryTitle: "Workflow Run API",
      primaryDescription: "用于触发已发布工作流。遇到人工确认或表单节点时会返回 waiting 和 wait_task。",
      primaryPath: `/v1/apps/${app.id}/run`,
      curl: [
        `curl -X POST '${baseUrl}/v1/apps/${app.id}/run' \\`,
        `  -H 'Authorization: Bearer ${key}' \\`,
        "  -H 'Content-Type: application/json' \\",
        `  -d '${body.replace(/'/g, "'\\''")}'`
      ].join("\n"),
      javascript: [
        `const response = await fetch("${baseUrl}/v1/apps/${app.id}/run", {`,
        "  method: \"POST\",",
        `  headers: { "Authorization": "Bearer ${key}", "Content-Type": "application/json" },`,
        `  body: JSON.stringify(${body})`,
        "});",
        "const result = await response.json();"
      ].join("\n"),
      java: [
        "HttpRequest request = HttpRequest.newBuilder()",
        `    .uri(URI.create("${baseUrl}/v1/apps/${app.id}/run"))`,
        `    .header("Authorization", "Bearer ${key}")`,
        "    .header(\"Content-Type\", \"application/json\")",
        `    .POST(HttpRequest.BodyPublishers.ofString("""${body}"""))`,
        "    .build();"
      ].join("\n"),
      python: [
        "import requests",
        `response = requests.post("${baseUrl}/v1/apps/${app.id}/run",`,
        `  headers={"Authorization": "Bearer ${key}"},`,
        `  json=${body.replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None")})`,
        "print(response.json())"
      ].join("\n"),
      extra: [
        { title: "提交等待任务", code: [`curl -X POST '${baseUrl}/v1/wait-tasks/{wait_task_id}/submit' \\`, `  -H 'Authorization: Bearer ${key}' \\`, "  -H 'Idempotency-Key: 8e4b1a1c-6d4f-4fd8-a2ef-42d0a5b39c11' \\", "  -H 'Content-Type: application/json' \\", "  -d '{\"action\":\"approve\",\"comment\":\"确认继续\"}'"].join("\n") },
        { title: "查询 Run Trace", code: `curl -H 'Authorization: Bearer ${key}' '${baseUrl}/v1/runs/{run_id}/traces'` },
        { title: "Streaming / Async 调用提示", code: "将请求体 response_mode 改为 streaming 可接收节点事件；改为 async 可立即返回 run_id，后续用 /v1/runs/{run_id} 查询。" }
      ]
    };
  }
  const body = JSON.stringify({ query: "帮我总结一下退款政策", inputs: { user_name: "张三" }, stream: false }, null, 2);
  return {
    baseUrl,
    primaryTitle: "Agent Chat API",
    primaryDescription: "用于调用已发布 Agent，支持多轮 conversation_id 和非流式/流式响应。",
    primaryPath: `/v1/apps/${app.id}/chat`,
    curl: [`curl -X POST '${baseUrl}/v1/apps/${app.id}/chat' \\`, `  -H 'Authorization: Bearer ${key}' \\`, "  -H 'Content-Type: application/json' \\", `  -d '${body.replace(/'/g, "'\\''")}'`].join("\n"),
    javascript: [`const response = await fetch("${baseUrl}/v1/apps/${app.id}/chat", {`, "  method: \"POST\",", `  headers: { "Authorization": "Bearer ${key}", "Content-Type": "application/json" },`, `  body: JSON.stringify(${body})`, "});", "const result = await response.json();"].join("\n"),
    java: ["HttpRequest request = HttpRequest.newBuilder()", `    .uri(URI.create("${baseUrl}/v1/apps/${app.id}/chat"))`, `    .header("Authorization", "Bearer ${key}")`, "    .header(\"Content-Type\", \"application/json\")", `    .POST(HttpRequest.BodyPublishers.ofString("""${body}"""))`, "    .build();"].join("\n"),
    python: ["import requests", `response = requests.post("${baseUrl}/v1/apps/${app.id}/chat",`, `  headers={"Authorization": "Bearer ${key}"},`, `  json=${body.replace(/true/g, "True").replace(/false/g, "False").replace(/null/g, "None")})`, "print(response.json())"].join("\n"),
    extra: [
      { title: "查询 Run", code: `curl -H 'Authorization: Bearer ${key}' '${baseUrl}/v1/runs/{run_id}'` },
      { title: "查询 Trace", code: `curl -H 'Authorization: Bearer ${key}' '${baseUrl}/v1/runs/{run_id}/traces'` },
      { title: "流式调用提示", code: "将请求体 stream 设置为 true；后续 SSE 事件协议会在 P2 后续迭代中补齐。" }
    ]
  };
}
