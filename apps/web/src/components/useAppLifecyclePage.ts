import { useEffect, useMemo, useRef, useState } from "react";
import { buildAgentDefinition } from "../appDefinitions";
import { navigateCenter, navigateDesigner } from "../routes";
import type {
  AgentDraft,
  AgentMode,
  AppDraft,
  AppKind,
  AppRecord,
  CenterView,
  DraftPublishResponse,
  DraftRunResponse,
  DraftValidationResponse,
  ValidationReport,
} from "../types";
import { normalizeAgentMode } from "./WorkflowDesigner";

const defaultAgentDraft: AgentDraft = {
  mode: "agent",
  providerAccountId: "",
  model: "",
  knowledgeDatasetIds: [],
  knowledgeTopK: 5,
  knowledgeScoreThreshold: 0,
  system: "你是企业内部知识助手，回答要简洁、准确、可执行。",
  temperature: 0.3,
  opening: "你好，我可以帮你处理知识问答、售后咨询和流程指引。",
  toolPlan: "优先理解任务 → 检索知识 → 必要时调用工具 → 给出结论和下一步。",
  textTemplate: "请根据以下输入生成结构化内容：{{query}}",
  memoryEnabled: true,
  memoryWindowMessages: 10,
};

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

export function useAppLifecyclePage({
  call,
  setStatus,
  setView,
  workflowDefinition,
  resetWorkflowCanvas,
  restoreWorkflowCanvas,
}: {
  call: ConsoleCall;
  setStatus: (value: string) => void;
  setView: (view: CenterView) => void;
  runtimeKey: string;
  workflowDefinition: Record<string, unknown>;
  resetWorkflowCanvas: () => void;
  restoreWorkflowCanvas: (definition: Record<string, any>) => void;
}) {
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState("");
  const [definitionLoading, setDefinitionLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [filter, setFilter] = useState<"all" | AppKind>("all");
  const [query, setQuery] = useState("");
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<AppKind>("agent");
  const [createMode, setCreateMode] = useState<AgentMode>("agent");
  const [createName, setCreateName] = useState("");
  const [agentDraft, setAgentDraft] = useState<AgentDraft>(defaultAgentDraft);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [releasePanelOpen, setReleasePanelOpen] = useState(false);
  const [pendingPublishDefinitionJson, setPendingPublishDefinitionJson] = useState("");
  const [currentDraft, setCurrentDraft] = useState<AppDraft | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const [draftSaveMessage, setDraftSaveMessage] = useState("");
  const lastSavedDefinitionRef = useRef("");

  const selectedApp = useMemo(
    () => apps.find((item) => item.id === selectedAppId),
    [apps, selectedAppId],
  );
  const visibleApps = useMemo(
    () =>
      apps.filter(
        (app) =>
          (filter === "all" || app.type === filter) &&
          (!query ||
            app.name.toLowerCase().includes(query.toLowerCase()) ||
            app.id.includes(query)),
      ),
    [apps, filter, query],
  );

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
      const draft = await call<AppDraft>(`/api/aio/admin/apps/${app.id}/draft`);
      setCurrentDraft(draft);
      setDraftSaveState("saved");
      setDraftSaveMessage(draft.dirty ? "草稿已保存，有未发布修改" : "草稿与线上版本一致");
      lastSavedDefinitionRef.current = draft.definitionJson;
      if (!draft.definitionJson) {
        if (app.type === "workflow") resetWorkflowCanvas();
        return;
      }
      const definition = JSON.parse(draft.definitionJson) as Record<string, any>;
      if (app.type === "agent") {
        setAgentDraft({
          ...defaultAgentDraft,
          mode: normalizeAgentMode(definition.agentMode),
          providerAccountId: definition.model?.providerAccountId || "",
          model: definition.model?.chatModel || "",
          knowledgeDatasetIds: Array.isArray(definition.knowledge)
            ? definition.knowledge
                .map((item: any) => item?.datasetId)
                .filter((value: unknown): value is string => typeof value === "string" && !!value)
            : [],
          knowledgeTopK: Number(definition.knowledge?.[0]?.topK ?? 5),
          knowledgeScoreThreshold: Number(definition.knowledge?.[0]?.scoreThreshold ?? 0),
          system: definition.prompt?.system || defaultAgentDraft.system,
          temperature: Number(definition.model?.temperature ?? 0.3),
          opening: definition.ui?.opening || defaultAgentDraft.opening,
          toolPlan: definition.ui?.toolPlan || defaultAgentDraft.toolPlan,
          textTemplate: definition.ui?.textTemplate || defaultAgentDraft.textTemplate,
          memoryEnabled: definition.memory?.enabled !== false,
          memoryWindowMessages: Number(definition.memory?.windowMessages ?? defaultAgentDraft.memoryWindowMessages),
        });
      }
      if (app.type === "workflow") {
        restoreWorkflowCanvas(definition);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "版本定义加载失败");
    } finally {
      setDefinitionLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedApp || !currentDraft || currentDraft.appId !== selectedApp.id || definitionLoading) return undefined;
    const definitionJson = selectedAppDefinitionJson(selectedApp);
    if (definitionJson === lastSavedDefinitionRef.current) return undefined;
    setDraftSaveState("unsaved");
    setDraftSaveMessage("草稿有未保存修改");
    const handle = window.setTimeout(() => {
      void saveDraftDefinition(definitionJson);
    }, 900);
    return () => window.clearTimeout(handle);
  }, [selectedApp?.id, selectedApp?.type, currentDraft?.appId, currentDraft?.revision, definitionLoading, workflowDefinition, agentDraft]);

  async function saveDraftDefinition(definitionJson: string) {
    if (!selectedApp || !currentDraft || currentDraft.appId !== selectedApp.id) return null;
    setDraftSaveState("saving");
    setDraftSaveMessage("草稿保存中");
    try {
      const draft = await call<AppDraft>(`/api/aio/admin/apps/${selectedApp.id}/draft`, {
        method: "PUT",
        body: JSON.stringify({ definitionJson }),
      });
      setCurrentDraft(draft);
      lastSavedDefinitionRef.current = definitionJson;
      setDraftSaveState("saved");
      setDraftSaveMessage("草稿已保存，有未发布修改");
      return draft;
    } catch (error) {
      const message = error instanceof Error ? error.message : "草稿保存失败";
      setDraftSaveState("error");
      setDraftSaveMessage(message);
      setStatus(message);
      return null;
    }
  }

  async function saveCurrentDraftNow() {
    if (!selectedApp) throw new Error("请先选择一个应用");
    const definitionJson = selectedAppDefinitionJson(selectedApp);
    if (definitionJson === lastSavedDefinitionRef.current && currentDraft) return currentDraft;
    const saved = await saveDraftDefinition(definitionJson);
    if (!saved) throw new Error("草稿保存失败，请修正后重试");
    return saved;
  }

  function openCreateModal(type: AppKind, mode: AgentMode = "agent") {
    setCreateType(type);
    setCreateMode(mode);
    setCreateName(
      type === "workflow"
        ? `Workflow 应用 ${apps.filter((item) => item.type === "workflow").length + 1}`
        : `${mode === "agent" ? "智能体" : "Agent"}应用 ${apps.filter((item) => item.type === "agent").length + 1}`,
    );
    setCreateOpen(true);
  }

  async function createApp() {
    setBusyAction("create");
    try {
      const created = await call<AppRecord>("/api/aio/admin/apps", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim() || "未命名应用",
          type: createType,
          visibility: "public_api",
        }),
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
    setPendingPublishDefinitionJson("");
    try {
      if (!selectedApp) throw new Error("请先选择一个应用");
      const draft = await saveCurrentDraftNow();
      const report = await runReleaseCheck();
      if (!report.passed) {
        setStatus(`发布检查未通过：${report.blockingErrors} 个阻断错误`);
        return;
      }
      setPendingPublishDefinitionJson(draft.definitionJson);
      setStatus("发布检查通过，请在侧边栏确认发布");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布检查失败");
    } finally {
      setBusyAction("");
    }
  }

  async function confirmPublishSelectedApp() {
    setBusyAction("publish-confirm");
    try {
      if (!selectedApp) throw new Error("请先选择一个应用");
      if (!pendingPublishDefinitionJson) throw new Error("请先点击发布并通过发布检查");
      const published = await call<DraftPublishResponse>(`/api/aio/admin/apps/${selectedApp.id}/draft/publish`, { method: "POST" });
      setCurrentDraft(published.draft);
      setValidationReport(published.report);
      lastSavedDefinitionRef.current = published.draft.definitionJson;
      setDraftSaveState("saved");
      setDraftSaveMessage("草稿与线上版本一致");
      setPendingPublishDefinitionJson("");
      setReleasePanelOpen(false);
      setStatus(`${selectedApp.name} 已发布 v${published.version.versionNo}，线上版本已切换`);
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
      await saveCurrentDraftNow();
      const report = await runReleaseCheck();
      setStatus(
        report.passed
          ? `发布检查通过：${report.warnings} 个警告`
          : `发布检查未通过：${report.blockingErrors} 个阻断错误`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "发布检查失败");
    } finally {
      setBusyAction("");
    }
  }

  async function runReleaseCheck() {
    if (!selectedApp) throw new Error("请先选择一个应用");
    const response = await call<DraftValidationResponse>(`/api/aio/admin/apps/${selectedApp.id}/draft/validate`, { method: "POST" });
    setCurrentDraft(response.draft);
    setValidationReport(response.report);
    setReleasePanelOpen(true);
    return response.report;
  }

  async function archiveApp(app: AppRecord) {
    setBusyAction(`archive-${app.id}`);
    try {
      await call(`/api/aio/admin/apps/${app.id}/archive`, { method: "POST" });
      setStatus(`已归档 ${app.name}`);
      await refreshApps();
      if (selectedAppId === app.id) {
        setSelectedAppId("");
        setView("center");
        navigateCenter();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "应用归档失败");
    } finally {
      setBusyAction("");
    }
  }

  async function updateSelectedAppInfo(app: AppRecord, updates: { name: string; description?: string }) {
    setBusyAction("app-info");
    try {
      const updated = await call<AppRecord>(`/api/aio/admin/apps/${app.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: updates.name,
          description: updates.description || "",
          visibility: app.visibility,
          status: app.status,
        }),
      });
      setApps((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatus("应用信息已保存");
      return updated;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "应用信息保存失败");
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function invokeSelectedApp() {
    setBusyAction("run");
    try {
      if (!selectedApp) throw new Error("请先选择应用");
      const draft = await saveCurrentDraftNow();
      const body =
        selectedApp.type === "workflow"
          ? {
              inputs: {
                question: "请处理一条售后退款咨询",
                operator_id: "console-user",
              },
              response_mode: "blocking",
            }
          : { query: "请用三句话介绍这个应用可以做什么", stream: false };
      const response = await call<DraftRunResponse>(`/api/aio/admin/apps/${selectedApp.id}/draft/run`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCurrentDraft(response.draft);
      setRunResult(response);
      setDraftSaveState("saved");
      setDraftSaveMessage(response.draft.dirty ? `草稿已保存，有未发布修改 · r${draft.revision}` : "草稿与线上版本一致");
      setStatus(response.status === "failed" ? (response.errorMessage || "草稿试运行失败") : "草稿试运行完成，线上版本未受影响");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "调用失败");
    } finally {
      setBusyAction("");
    }
  }

  function selectedAppDefinitionJson(app: AppRecord) {
    return app.type === "workflow"
      ? JSON.stringify(workflowDefinition, null, 2)
      : JSON.stringify(buildAgentDefinition(agentDraft), null, 2);
  }

  return {
    apps,
    visibleApps,
    selectedApp,
    selectedAppId,
    appsLoading,
    appsError,
    definitionLoading,
    busyAction,
    filter,
    query,
    runResult,
    createOpen,
    createType,
    createMode,
    createName,
    agentDraft,
    validationReport,
    releasePanelOpen,
    pendingPublishDefinitionJson,
    currentDraft,
    draftSaveState,
    draftSaveMessage,
    setApps,
    setAppsLoading,
    setSelectedAppId,
    setFilter,
    setQuery,
    setCreateOpen,
    setCreateType,
    setCreateMode,
    setCreateName,
    setAgentDraft,
    setReleasePanelOpen,
    refreshApps,
    loadAppDefinition,
    openCreateModal,
    createApp,
    publishSelectedApp,
    confirmPublishSelectedApp,
    validateSelectedApp,
    archiveApp,
    updateSelectedAppInfo,
    invokeSelectedApp,
  };
}
