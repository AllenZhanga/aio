import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Boxes,
  ChevronDown,
  Code2,
  FileText,
  Grid3X3,
  Layers3,
  Loader2,
  MessageSquareText,
  MousePointer2,
  PanelRight,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Settings2,
  Sparkles,
  Workflow,
  X,
  Zap
} from "lucide-react";
import "./app-center.css";

type AppKind = "agent" | "workflow";
type AgentMode = "chat-assistant" | "agent" | "text-generation";
type CenterView = "center" | "designer" | "api" | "observability";
type RouteState = { view: "center" } | { view: "designer"; appId: string } | { view: "api"; appId: string } | { view: "observability"; appId?: string };
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
type WorkflowNodeType = "start" | "llm" | "tool" | "user_confirm" | "condition" | "end";
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

const adminHeaders = {
  "Content-Type": "application/json",
  "X-Aio-Tenant": "default",
  "X-Aio-Workspace": "default"
};

const agentModes: Array<{ mode: AgentMode; title: string; typeLabel: string; description: string; icon: typeof MessageSquareText }> = [
  { mode: "chat-assistant", title: "Chatflow", typeLabel: "聊天助手", description: "适合客服、知识问答、多轮对话。", icon: MessageSquareText },
  { mode: "agent", title: "Agent", typeLabel: "智能体", description: "适合自主规划、工具调用、任务执行。", icon: Bot },
  { mode: "text-generation", title: "文本生成", typeLabel: "文本生成", description: "适合结构化写作、总结、模板生成。", icon: FileText }
];

const nodeMeta: Record<WorkflowNodeType, { name: string; description: string; accent: string }> = {
  start: { name: "Start", description: "流程入口", accent: "green" },
  llm: { name: "LLM", description: "模型推理", accent: "blue" },
  tool: { name: "Tool", description: "工具调用", accent: "amber" },
  user_confirm: { name: "Confirm", description: "人工确认", accent: "red" },
  condition: { name: "Branch", description: "条件分支", accent: "violet" },
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
  mode: "chat-assistant",
  model: "test-local-fallback",
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
  const [createMode, setCreateMode] = useState<AgentMode>("chat-assistant");
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
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const selectedApp = useMemo(() => apps.find((item) => item.id === selectedAppId), [apps, selectedAppId]);
  const selectedNode = useMemo(() => nodes.find((item) => item.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedEdge = useMemo(() => edges.find((item) => item.id === selectedEdgeId), [edges, selectedEdgeId]);
  const selectedRun = useMemo(() => runs.find((item) => item.runId === selectedRunId), [runs, selectedRunId]);
  const workflowDefinition = useMemo(() => buildWorkflowDefinition(nodes, edges), [nodes, edges]);
  const visibleApps = useMemo(() => apps.filter((app) => (filter === "all" || app.type === filter) && (!query || app.name.toLowerCase().includes(query.toLowerCase()) || app.id.includes(query))), [apps, filter, query]);

  useEffect(() => {
    const applyRoute = () => {
      const route = parseRoute();
      if (route.view === "designer" || route.view === "api") {
        setSelectedAppId(route.appId);
        setView(route.view);
      } else if (route.view === "observability") {
        setSelectedAppId(route.appId || "");
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
  useEffect(() => { void refreshApps(); }, []);
  useEffect(() => { if (selectedApp) void loadAppDefinition(selectedApp); }, [selectedApp?.id]);
  useEffect(() => { if (runtimeKey) localStorage.setItem("aio.runtimeKey", runtimeKey); }, [runtimeKey]);
  useEffect(() => { if (view === "observability") void refreshRuns(selectedAppId || undefined); }, [view, selectedAppId]);
  useEffect(() => { if (view === "observability" && selectedRunId) void loadRunTraces(selectedRunId); }, [view, selectedRunId]);

  async function call<T>(path: string, init: RequestInit = {}, runtime = false): Promise<T> {
    const headers = runtime ? { "Content-Type": "application/json", Authorization: `Bearer ${runtimeKey}` } : adminHeaders;
    const response = await fetch(path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    if (!response.ok) throw new Error(body?.message || body?.error || response.statusText);
    return body as T;
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
          model: definition.model?.chatModel || "test-local-fallback",
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

  function openCreateModal(type: AppKind, mode: AgentMode = "chat-assistant") {
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
      const key = await call<{ apiKey: string }>("/api/aio/admin/api-keys", { method: "POST", body: JSON.stringify({ name: `${selectedApp.name} runtime`, workspaceId: "default", appId: selectedApp.id }) });
      setRuntimeKey(key.apiKey);
      setStatus("Runtime API Key 已生成");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API Key 创建失败");
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
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, config: { ...node.config, [key]: value } } : node));
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

  return (
    <main className="consoleShell">
      <TopNav status={status} />
      <section className="consoleBody">
        <SideNav activeView={view} onCreate={() => openCreateModal("agent", "chat-assistant")} openApps={backToCenter} openObservability={() => openObservability()} />
        {view === "center" ? (
          <AppCenter apps={apps} visibleApps={visibleApps} loading={appsLoading} error={appsError} filter={filter} query={query} setFilter={setFilter} setQuery={setQuery} refreshApps={refreshApps} openCreateModal={openCreateModal} openDesigner={openDesigner} />
        ) : view === "api" ? (
          <AppApiDocsPage selectedApp={selectedApp} selectedAppId={selectedAppId} appsLoading={appsLoading} runtimeKey={runtimeKey} setRuntimeKey={setRuntimeKey} busyAction={busyAction} createRuntimeKey={createRuntimeKey} openDesigner={openDesigner} back={backToCenter} />
        ) : view === "observability" ? (
          <RunObservabilityPage apps={apps} selectedApp={selectedApp} selectedAppId={selectedAppId} runs={runs} traces={traces} selectedRun={selectedRun} selectedRunId={selectedRunId} loading={runsLoading} tracesLoading={tracesLoading} error={runsError} refreshRuns={() => refreshRuns(selectedAppId || undefined)} selectRun={setSelectedRunId} openDesigner={openDesigner} openGlobal={() => openObservability()} back={backToCenter} />
        ) : (
          <DesignerPage selectedApp={selectedApp} selectedAppId={selectedAppId} appsLoading={appsLoading} definitionLoading={definitionLoading} busyAction={busyAction} agentDraft={agentDraft} setAgentDraft={setAgentDraft} runResult={runResult} runtimeKey={runtimeKey} setRuntimeKey={setRuntimeKey} validationReport={validationReport} releasePanelOpen={releasePanelOpen} setReleasePanelOpen={setReleasePanelOpen} publishSelectedApp={publishSelectedApp} validateSelectedApp={validateSelectedApp} createRuntimeKey={createRuntimeKey} invokeSelectedApp={invokeSelectedApp} openApiDocs={openApiDocs} openObservability={openObservability} back={backToCenter} workflowProps={{ canvasRef, nodes, edges, connecting, selectedNode, selectedEdge, workflowDefinition, addNode, removeNode, removeEdge, updateEdge, updateNode, updateNodeConfig, startDrag, startConnect, finishConnect, moveOnCanvas, stopCanvasInteraction, selectNode: (nodeId: string) => { setSelectedNodeId(nodeId); setSelectedEdgeId(""); }, selectEdge: (edgeId: string) => { setSelectedEdgeId(edgeId); setSelectedNodeId(""); } }} />
        )}
      </section>
      {createOpen && <CreateAppModal createType={createType} createMode={createMode} createName={createName} creating={busyAction === "create"} setCreateType={setCreateType} setCreateMode={setCreateMode} setCreateName={setCreateName} close={() => setCreateOpen(false)} createApp={createApp} />}
    </main>
  );
}

function TopNav({ status }: { status: string }) {
  return <header className="topNav"><div className="logoGroup"><div className="logoGem">A</div><strong>Aio</strong><span>Default Workspace</span><ChevronDown size={14} /></div><nav className="topTabs"><button>探索</button><button className="active"><Boxes size={15} /> 工作室</button><button>知识库</button><button>工具</button></nav><div className="statusDot"><Sparkles size={14} /> {status}</div><div className="avatar">D</div></header>;
}

function SideNav({ activeView, onCreate, openApps, openObservability }: { activeView: CenterView; onCreate: () => void; openApps: () => void; openObservability: () => void }) {
  return <aside className="sideNav"><button className="createBtn" onClick={onCreate}><Plus size={17} /> 创建应用</button><button className="sideItem"><Grid3X3 size={18} /> 应用广场</button><button className={`sideItem ${activeView === "center" || activeView === "designer" || activeView === "api" ? "active" : ""}`} onClick={openApps}><Boxes size={18} /> 应用管理</button><button className={`sideItem ${activeView === "observability" ? "active" : ""}`} onClick={openObservability}><Play size={18} /> 运行观测</button><button className="sideItem"><Zap size={18} /> 任务中心</button><p className="sideGroup">MCP</p><button className="sideItem"><Code2 size={18} /> MCP 广场</button><button className="sideItem"><Layers3 size={18} /> MCP 管理</button></aside>;
}

function AppCenter(props: { apps: AppRecord[]; visibleApps: AppRecord[]; loading: boolean; error: string; filter: "all" | AppKind; query: string; setFilter: (filter: "all" | AppKind) => void; setQuery: (query: string) => void; refreshApps: () => Promise<void>; openCreateModal: (type: AppKind, mode?: AgentMode) => void; openDesigner: (app: AppRecord) => void }) {
  const isFilteredEmpty = !props.loading && !props.error && props.apps.length > 0 && props.visibleApps.length === 0;
  return <section className="workspacePane"><div className="pageHeader"><div><h1>应用管理</h1><p>创建、设计、发布 Agent 与 Workflow 应用。</p></div><div className="headerActions"><button className="ghostBtn">使用指南</button><button className="primaryBtn" onClick={() => props.openCreateModal("agent", "chat-assistant")}><Plus size={17} /> 创建应用</button></div></div>{props.error && <div className="errorBanner"><AlertCircle size={16} /><span>{props.error}</span><button onClick={() => void props.refreshApps()}>重试</button></div>}<div className="toolbar"><div className="filterTabs">{([{ key: "all", label: "全部" }, { key: "agent", label: "Agent" }, { key: "workflow", label: "工作流" }] as const).map((item) => <button key={item.key} className={props.filter === item.key ? "active" : ""} onClick={() => props.setFilter(item.key)}>{item.label}</button>)}</div><div className="searchInput"><Search size={16} /><input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="搜索应用名称" /></div><button className="iconBtn" disabled={props.loading} onClick={() => void props.refreshApps()}>{props.loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}</button></div>{props.loading && <StatePanel icon="loading" title="正在同步应用列表" text="正在读取当前空间的应用、发布状态和最近更新时间。" />}{!props.loading && !props.error && <div className="appGrid"><button className="createCard" onClick={() => props.openCreateModal("agent", "chat-assistant")}><Plus size={22} /><strong>创建应用</strong><span>空白应用 / 模板 / DSL 导入</span></button>{props.visibleApps.map((app) => <AppTile key={app.id} app={app} openDesigner={props.openDesigner} />)}</div>}{!props.loading && !props.error && !props.apps.length && <StatePanel title="暂无应用" text="从 Chatflow、Agent、文本生成或 Workflow 开始创建第一个应用。" />}{isFilteredEmpty && <StatePanel title="没有匹配的应用" text="请调整筛选条件或搜索关键字。" />}</section>;
}

function AppTile({ app, openDesigner }: { app: AppRecord; openDesigner: (app: AppRecord) => void }) {
  const statusMeta = getAppStatusMeta(app);
  return <button className="appTile" onClick={() => openDesigner(app)}><div className="tileTop"><span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><span className={`publishState ${statusMeta.tone}`}><i /> {statusMeta.label}</span></div><strong>{app.name}</strong><dl><dt>应用 ID</dt><dd>{app.id}</dd><dt>应用类型</dt><dd>{app.type === "workflow" ? "工作流" : "Agent"}</dd></dl><p>更新于 {formatDate(app.updatedAt)}</p></button>;
}

function CreateAppModal(props: { createType: AppKind; createMode: AgentMode; createName: string; creating: boolean; setCreateType: (type: AppKind) => void; setCreateMode: (mode: AgentMode) => void; setCreateName: (name: string) => void; close: () => void; createApp: () => Promise<void> }) {
  return <div className="modalBackdrop" role="presentation"><section className="createModal" role="dialog" aria-modal="true"><header><div><h2>创建应用</h2><p>选择应用类型，创建后进入对应设计页面。</p></div><button className="iconBtn" disabled={props.creating} onClick={props.close}><X size={18} /></button></header><div className="createTypeGrid">{agentModes.map((item) => <CreateTypeCard key={item.mode} active={props.createType === "agent" && props.createMode === item.mode} icon={item.icon} title={item.title} text={item.description} onClick={() => { props.setCreateType("agent"); props.setCreateMode(item.mode); }} />)}<CreateTypeCard active={props.createType === "workflow"} icon={Workflow} title="Workflow" text="可视化拖拽节点、连线、条件分支和人工确认。" onClick={() => props.setCreateType("workflow")} /></div><label className="field"><span>应用名称</span><input value={props.createName} onChange={(event) => props.setCreateName(event.target.value)} placeholder="输入应用名称" /></label><footer><button className="ghostBtn" disabled={props.creating} onClick={props.close}>取消</button><button className="primaryBtn" disabled={props.creating} onClick={() => void props.createApp()}>{props.creating ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} 创建</button></footer></section></div>;
}

function CreateTypeCard({ active, icon: Icon, title, text, onClick }: { active: boolean; icon: typeof Bot; title: string; text: string; onClick: () => void }) {
  return <button className={`typeCard ${active ? "active" : ""}`} onClick={onClick}><Icon size={22} /><strong>{title}</strong><span>{text}</span></button>;
}

function DesignerPage(props: { selectedApp?: AppRecord; selectedAppId: string; appsLoading: boolean; definitionLoading: boolean; busyAction: string; agentDraft: AgentDraft; setAgentDraft: (draft: AgentDraft) => void; runResult: Record<string, unknown> | null; runtimeKey: string; setRuntimeKey: (value: string) => void; validationReport: ValidationReport | null; releasePanelOpen: boolean; setReleasePanelOpen: (open: boolean) => void; publishSelectedApp: () => Promise<void>; validateSelectedApp: () => Promise<void>; createRuntimeKey: () => Promise<void>; invokeSelectedApp: () => Promise<void>; openApiDocs: (app: AppRecord) => void; openObservability: (app: AppRecord) => void; back: () => void; workflowProps: WorkflowDesignerProps }) {
  if (!props.selectedApp) return <section className="workspacePane"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开应用" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的基础信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} /></section>;
  const statusMeta = getAppStatusMeta(props.selectedApp);
  return <section className="designerPane"><header className="designerHeader"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><div className="designerTitle"><span className={`tileIcon ${props.selectedApp.type}`}>{props.selectedApp.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><div><h1>{props.selectedApp.name}</h1><p>{props.selectedApp.type} · {statusMeta.label} · {props.selectedApp.id}</p></div>{props.definitionLoading && <span className="statusPill"><Loader2 className="spin" size={13} /> 同步版本</span>}</div><div className="designerActions"><button className="ghostBtn" onClick={() => props.openObservability(props.selectedApp!)}><Play size={16} /> 运行观测</button><button className="ghostBtn" onClick={() => props.openApiDocs(props.selectedApp!)}><Code2 size={16} /> API 文档</button><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.validateSelectedApp()}>{props.busyAction === "validate" ? <Loader2 className="spin" size={16} /> : <AlertCircle size={16} />} 发布检查</button><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.createRuntimeKey()}>{props.busyAction === "key" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} 生成 Key</button><button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.invokeSelectedApp()}>{props.busyAction === "run" ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 试运行</button><button className="primaryBtn" disabled={!!props.busyAction} onClick={() => void props.publishSelectedApp()}>{props.busyAction === "publish" ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />} 发布</button></div></header>{props.selectedApp.type === "agent" ? <AgentDesigner draft={props.agentDraft} setDraft={props.setAgentDraft} runResult={props.runResult} runtimeKey={props.runtimeKey} setRuntimeKey={props.setRuntimeKey} /> : <WorkflowDesigner {...props.workflowProps} />}{props.releasePanelOpen && <ReleaseCheckPanel report={props.validationReport} close={() => props.setReleasePanelOpen(false)} />}</section>;
}

function ReleaseCheckPanel({ report, close }: { report: ValidationReport | null; close: () => void }) {
  const issues = report?.issues || [];
  return <aside className="releasePanel"><div className="releasePanelHeader"><div><h2>发布检查</h2><p>{report ? (report.passed ? "无阻断错误，可以发布。" : "存在阻断错误，发布已停止。") : "尚未执行检查。"}</p></div><button className="iconBtn" onClick={close}><X size={18} /></button></div>{report && <div className="releaseSummary"><article className={report.blockingErrors ? "danger" : "success"}><strong>{report.blockingErrors}</strong><span>阻断错误</span></article><article><strong>{report.warnings}</strong><span>警告</span></article><article><strong>{report.suggestions}</strong><span>建议</span></article></div>}{!issues.length && <StatePanel title="检查通过" text="当前定义没有阻断错误。建议发布后进入运行观测查看首轮调用 Trace。" />}{issues.length > 0 && <div className="releaseIssueList">{issues.map((issue) => <article className={`releaseIssue ${issue.severity}`} key={`${issue.code}-${issue.target}-${issue.title}`}><div><span>{issue.severity === "error" ? "阻断" : issue.severity === "warning" ? "警告" : "建议"}</span><code>{issue.code}</code></div><strong>{issue.title}</strong><p>{issue.detail}</p><small>{issue.target}</small></article>)}</div>}</aside>;
}

function AppApiDocsPage(props: { selectedApp?: AppRecord; selectedAppId: string; appsLoading: boolean; runtimeKey: string; setRuntimeKey: (value: string) => void; busyAction: string; createRuntimeKey: () => Promise<void>; openDesigner: (app: AppRecord) => void; back: () => void }) {
  if (!props.selectedApp) return <section className="workspacePane"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开 API 文档" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的 API 信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} /></section>;
  const app = props.selectedApp;
  const docs = buildApiDocs(app, props.runtimeKey);
  const statusMeta = getAppStatusMeta(app);
  return <section className="workspacePane apiDocsPane"><div className="apiDocsHeader"><button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button><div className="designerTitle"><span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span><div><h1>{app.name} API 文档</h1><p>{app.type} · {statusMeta.label} · {app.id}</p></div></div><div className="designerActions"><button className="ghostBtn" onClick={() => props.openDesigner(app)}><Settings2 size={16} /> 返回设计</button><button className="primaryBtn" disabled={props.busyAction === "key"} onClick={() => void props.createRuntimeKey()}>{props.busyAction === "key" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} 生成应用 Key</button></div></div><div className="apiDocsGrid"><aside className="designCard apiMetaCard"><h3>调用信息</h3><dl><dt>Base URL</dt><dd>{docs.baseUrl}</dd><dt>App ID</dt><dd>{app.id}</dd><dt>鉴权方式</dt><dd>Authorization: Bearer sk_xxx</dd><dt>Key Scope</dt><dd>tenant=default / workspace=default / app={app.id}</dd></dl><Field label="Runtime API Key"><input value={props.runtimeKey} onChange={(event) => props.setRuntimeKey(event.target.value)} placeholder="sk_..." /></Field>{app.status !== "published" && <div className="warningBox"><AlertCircle size={16} /> 当前应用尚未发布，外部运行 API 只会调用已发布版本。</div>}</aside><main className="apiExampleStack"><section className="designCard"><div className="sectionTitle"><Code2 size={18} /><div><h2>{docs.primaryTitle}</h2><p>{docs.primaryDescription}</p></div></div><EndpointRow method="POST" path={docs.primaryPath} /><CodeBlock title="curl" code={docs.curl} /><CodeBlock title="JavaScript" code={docs.javascript} /><CodeBlock title="Java" code={docs.java} /><CodeBlock title="Python" code={docs.python} /></section><section className="designCard"><h3>{app.type === "workflow" ? "Workflow 等待任务与 Trace" : "Run 与 Trace 查询"}</h3>{docs.extra.map((item) => <CodeBlock key={item.title} title={item.title} code={item.code} />)}</section></main></div></section>;
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

function AgentDesigner({ draft, setDraft, runResult, runtimeKey, setRuntimeKey }: { draft: AgentDraft; setDraft: (draft: AgentDraft) => void; runResult: Record<string, unknown> | null; runtimeKey: string; setRuntimeKey: (value: string) => void }) {
  const mode = agentModes.find((item) => item.mode === draft.mode) || agentModes[0];
  const definition = buildAgentDefinition(draft);
  return <div className="agentLayout"><aside className="agentModeRail">{agentModes.map((item) => <button key={item.mode} className={draft.mode === item.mode ? "active" : ""} onClick={() => setDraft({ ...draft, mode: item.mode })}><item.icon size={18} /><span>{item.typeLabel}</span></button>)}</aside><section className="designCard mainDesignCard"><div className="sectionTitle"><mode.icon size={20} /><div><h2>{mode.typeLabel}设计</h2><p>{mode.description}</p></div></div><div className="formGrid two"><Field label="模型"><input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /></Field><Field label="Temperature"><input type="number" min="0" max="2" step="0.1" value={draft.temperature} onChange={(event) => setDraft({ ...draft, temperature: Number(event.target.value) })} /></Field></div>{draft.mode === "chat-assistant" && <ChatAssistantForm draft={draft} setDraft={setDraft} />}{draft.mode === "agent" && <AutonomousAgentForm draft={draft} setDraft={setDraft} />}{draft.mode === "text-generation" && <TextGenerationForm draft={draft} setDraft={setDraft} />}</section><aside className="previewStack"><section className="designCard compact"><h3>Runtime Key</h3><input value={runtimeKey} onChange={(event) => setRuntimeKey(event.target.value)} placeholder="sk_..." /></section><section className="designCard preview"><h3>Definition</h3><pre>{JSON.stringify(definition, null, 2)}</pre></section><section className="designCard preview"><h3>Run Result</h3><pre>{JSON.stringify(runResult || { hint: "发布后可生成 Key 并试运行。" }, null, 2)}</pre></section></aside></div>;
}

function ChatAssistantForm({ draft, setDraft }: { draft: AgentDraft; setDraft: (draft: AgentDraft) => void }) {
  return <><Field label="开场白"><input value={draft.opening} onChange={(event) => setDraft({ ...draft, opening: event.target.value })} /></Field><Field label="系统提示词"><textarea value={draft.system} onChange={(event) => setDraft({ ...draft, system: event.target.value })} /></Field></>;
}

function AutonomousAgentForm({ draft, setDraft }: { draft: AgentDraft; setDraft: (draft: AgentDraft) => void }) {
  return <><Field label="Agent 规划策略"><textarea value={draft.toolPlan} onChange={(event) => setDraft({ ...draft, toolPlan: event.target.value })} /></Field><Field label="角色与约束"><textarea value={draft.system} onChange={(event) => setDraft({ ...draft, system: event.target.value })} /></Field></>;
}

function TextGenerationForm({ draft, setDraft }: { draft: AgentDraft; setDraft: (draft: AgentDraft) => void }) {
  return <><Field label="生成模板"><textarea value={draft.textTemplate} onChange={(event) => setDraft({ ...draft, textTemplate: event.target.value })} /></Field><Field label="写作规范"><textarea value={draft.system} onChange={(event) => setDraft({ ...draft, system: event.target.value })} /></Field></>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
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
  return <div className="workflowLayout"><aside className="nodePalette designCard"><h3>节点</h3>{(Object.keys(nodeMeta) as WorkflowNodeType[]).map((type) => <button className="paletteItem" key={type} onClick={() => props.addNode(type)}><span className={`dot ${nodeMeta[type].accent}`} /><strong>{nodeMeta[type].name}</strong><small>{nodeMeta[type].description}</small><Plus size={14} /></button>)}<p className="gestureTip"><MousePointer2 size={15} /> 拖动节点移动，从右侧端口拖到另一节点左侧端口连线。</p></aside><div className="workflowCanvas" ref={props.canvasRef} onPointerMove={props.moveOnCanvas} onPointerUp={props.stopCanvasInteraction} onPointerLeave={props.stopCanvasInteraction}><svg className="edgeLayer" width="100%" height="100%"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#2563eb" /></marker></defs>{props.edges.map((edge) => { const from = props.nodes.find((node) => node.id === edge.from); const to = props.nodes.find((node) => node.id === edge.to); if (!from || !to) return null; return <path key={edge.id} className="edgePath" d={edgePath(from.x + nodeSize.width, from.y + nodeSize.height / 2, to.x, to.y + nodeSize.height / 2)} markerEnd="url(#arrow)" onPointerDown={(event) => { event.stopPropagation(); props.selectEdge(edge.id); }} />; })}{props.connecting && <path className="edgePath draft" d={edgePath(nodeOutX(props.nodes, props.connecting.from), nodeOutY(props.nodes, props.connecting.from), props.connecting.x, props.connecting.y)} />}</svg>{props.nodes.map((node) => <article className={`workflowNode ${node.type} ${props.selectedNode?.id === node.id ? "selected" : ""}`} style={{ transform: `translate(${node.x}px, ${node.y}px)` }} key={node.id} onPointerDown={(event) => props.startDrag(event, node)}><button className="port in" aria-label="连接入口" onPointerUp={(event) => props.finishConnect(event, node.id)} /><div className="nodeHead" onPointerDown={() => props.selectNode(node.id)}><span className={`dot ${nodeMeta[node.type].accent}`} /><strong>{node.label}</strong></div><p>{nodeMeta[node.type].description}</p><small>{node.id}</small><button className="port out" aria-label="连接出口" onPointerDown={(event) => props.startConnect(event, node)} /></article>)}</div><aside className="inspector designCard"><div className="sectionTitle"><PanelRight size={18} /><h3>属性</h3></div>{props.selectedNode && <div className="inspectorStack"><Field label="节点名称"><input value={props.selectedNode.label} onChange={(event) => props.updateNode(props.selectedNode!.id, { label: event.target.value })} /></Field><Field label="节点 ID"><input value={props.selectedNode.id} readOnly /></Field>{nodeConfigKeys(props.selectedNode.type).map((key) => <Field key={key} label={key}><textarea value={String(props.selectedNode?.config[key] ?? "")} onChange={(event) => props.updateNodeConfig(props.selectedNode!.id, key, event.target.value)} /></Field>)}<button className="dangerBtn" disabled={props.selectedNode.id === "start" || props.selectedNode.id === "end"} onClick={() => props.removeNode(props.selectedNode!.id)}><X size={16} /> 删除节点</button></div>}{props.selectedEdge && <div className="inspectorStack"><Field label="连线"><input value={`${props.selectedEdge.from} → ${props.selectedEdge.to}`} readOnly /></Field><Field label="条件表达式"><textarea value={props.selectedEdge.condition || ""} onChange={(event) => props.updateEdge(props.selectedEdge!.id, event.target.value)} placeholder="{{confirm.action == 'approve'}}" /></Field><button className="dangerBtn" onClick={() => props.removeEdge(props.selectedEdge!.id)}><X size={16} /> 删除连线</button></div>}{!props.selectedNode && !props.selectedEdge && <p className="mutedText">选择节点或连线后编辑属性。</p>}<div className="definitionPreview"><h3>Workflow JSON</h3><pre>{JSON.stringify(props.workflowDefinition, null, 2)}</pre></div></aside></div>;
}

function buildAgentDefinition(draft: AgentDraft) {
  return { type: "agent", agentMode: draft.mode, model: { chatModel: draft.model, temperature: draft.temperature, maxTokens: 1024 }, prompt: { system: draft.mode === "text-generation" ? `${draft.system}\n\n模板：${draft.textTemplate}` : draft.system }, knowledge: [], tools: [], memory: { enabled: draft.mode !== "text-generation", windowMessages: 10 }, output: { format: draft.mode === "text-generation" ? "structured_text" : "text" }, ui: { opening: draft.opening, toolPlan: draft.toolPlan, textTemplate: draft.textTemplate } };
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

function normalizeAgentMode(mode: unknown): AgentMode {
  return mode === "agent" || mode === "text-generation" || mode === "chat-assistant" ? mode : "chat-assistant";
}

function normalizeNodeType(type: unknown): WorkflowNodeType {
  return type === "start" || type === "llm" || type === "tool" || type === "user_confirm" || type === "condition" || type === "end" ? type : "llm";
}

function defaultNodeConfig(type: WorkflowNodeType): Record<string, unknown> {
  if (type === "llm") return { prompt: "请根据上下文处理：{{inputs.question}}" };
  if (type === "tool") return { toolId: "", input: "{{inputs}}" };
  if (type === "user_confirm") return { title: "等待人工确认", description: "{{answer.text}}", actions: [{ key: "approve", label: "确认" }, { key: "reject", label: "拒绝" }] };
  if (type === "condition") return { expression: "{{confirm.action == 'approve'}}" };
  if (type === "end") return { output: "{{answer.text}}" };
  return {};
}

function nodeConfigKeys(type: WorkflowNodeType) {
  if (type === "llm") return ["prompt"];
  if (type === "tool") return ["toolId", "input"];
  if (type === "user_confirm") return ["title", "description"];
  if (type === "condition") return ["expression"];
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

function parseRoute(): RouteState {
  const hash = window.location.hash.replace(/^#/, "") || "/apps";
  if (hash === "/observability/runs") return { view: "observability" };
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

function navigateObservability(app?: AppRecord) {
  const nextHash = app ? `#/apps/${encodeURIComponent(app.id)}/runs` : "#/observability/runs";
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
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
