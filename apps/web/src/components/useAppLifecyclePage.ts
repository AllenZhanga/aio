import { useMemo, useState } from "react";
import { buildAgentDefinition } from "../appDefinitions";
import { navigateCenter, navigateDesigner } from "../routes";
import type {
  AgentDraft,
  AgentMode,
  AppKind,
  AppRecord,
  AppVersion,
  CenterView,
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
  runtimeKey,
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
      const versions = await call<AppVersion[]>(
        `/api/aio/admin/apps/${app.id}/versions`,
      );
      const version =
        versions.find((item) => item.id === app.publishedVersionId) ||
        versions[0];
      if (!version?.definitionJson) {
        if (app.type === "workflow") resetWorkflowCanvas();
        return;
      }
      const definition = JSON.parse(version.definitionJson) as Record<string, any>;
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
    try {
      if (!selectedApp) throw new Error("请先选择一个应用");
      const definitionJson = selectedAppDefinitionJson(selectedApp);
      const report = await runReleaseCheck(definitionJson);
      if (!report.passed) {
        setStatus(`发布检查未通过：${report.blockingErrors} 个阻断错误`);
        return;
      }
      const version = await call<{ id: string; versionNo: number }>(
        `/api/aio/admin/apps/${selectedApp.id}/versions`,
        { method: "POST", body: JSON.stringify({ definitionJson }) },
      );
      await call(`/api/aio/admin/apps/${selectedApp.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ versionId: version.id }),
      });
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
      const report = await runReleaseCheck(selectedAppDefinitionJson(selectedApp));
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

  async function runReleaseCheck(definitionJson: string) {
    if (!selectedApp) throw new Error("请先选择一个应用");
    const report = await call<ValidationReport>(
      `/api/aio/admin/apps/${selectedApp.id}/validate`,
      { method: "POST", body: JSON.stringify({ definitionJson }) },
    );
    setValidationReport(report);
    setReleasePanelOpen(true);
    return report;
  }

  async function archiveApp(app: AppRecord) {
    if (
      !window.confirm(
        `确认删除（归档）应用「${app.name}」？归档后会从当前应用列表移除，历史版本和运行记录仍保留。`,
      )
    ) {
      return;
    }
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

  async function invokeSelectedApp() {
    setBusyAction("run");
    try {
      if (!selectedApp) throw new Error("请先选择应用");
      if (!runtimeKey) throw new Error("请先在 API Key 菜单创建或填入 Runtime API Key");
      const path =
        selectedApp.type === "workflow"
          ? `/v1/apps/${selectedApp.id}/run`
          : `/v1/apps/${selectedApp.id}/chat`;
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
      const response = await call<Record<string, unknown>>(
        path,
        { method: "POST", body: JSON.stringify(body) },
        true,
      );
      setRunResult(response);
      setStatus("试运行完成");
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
    validateSelectedApp,
    archiveApp,
    invokeSelectedApp,
  };
}
