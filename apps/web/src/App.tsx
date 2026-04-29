import { useEffect, useMemo, useState } from "react";
import { AppCenter, CreateAppModal } from "./components/AppCenter";
import { LoginPage, SideNav, TopNav } from "./components/AppShell";
import { ApiKeyPage } from "./components/ApiKeyPage";
import { AppApiDocsPage } from "./components/AppApiDocsPage";
import { DesignerPage } from "./components/DesignerPage";
import { ExperiencePage } from "./components/ExperiencePage";
import { KnowledgePage } from "./components/KnowledgePage";
import { OrgOpsPage } from "./components/OrgOpsPage";
import { ProviderPage } from "./components/providers";
import { RunObservabilityPage } from "./components/RunObservabilityPage";
import { TaskCenterPage } from "./components/TaskCenterPage";
import { useAppLifecyclePage } from "./components/useAppLifecyclePage";
import { useApiKeyPage } from "./components/useApiKeyPage";
import { useConsoleSession } from "./components/useConsoleSession";
import { useExperiencePage } from "./components/useExperiencePage";
import { useKnowledgePage } from "./components/useKnowledgePage";
import { useOrgOpsPage } from "./components/useOrgOpsPage";
import { useProviderPage } from "./components/useProviderPage";
import { useRunObservabilityPage } from "./components/useRunObservabilityPage";
import { useTaskCenterPage } from "./components/useTaskCenterPage";
import { useWorkflowDesignerPage } from "./components/useWorkflowDesignerPage";
import { safeJsonParse } from "./consoleUtils";
import {
  navigateApiDocs,
  navigateApiKeys,
  navigateCenter,
  navigateDesigner,
  navigateExperience,
  navigateKnowledge,
  navigateObservability,
  navigateOrg,
  navigateProviders,
  parseRoute,
} from "./routes";
import type {
  AppRecord,
  CenterView,
  ModelOption,
} from "./types";
import "./app-center.css";

const baseAdminHeaders = {
  "Content-Type": "application/json",
  "X-Aio-Tenant": "default",
  "X-Aio-Workspace": "default",
};

export default function App() {
  const [view, setView] = useState<CenterView>("center");
  const [status, setStatus] = useState("应用中心已就绪");
  const [runtimeKey, setRuntimeKey] = useState(
    localStorage.getItem("aio.runtimeKey") || "",
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const consoleSession = useConsoleSession({
    setStatus,
    onLogout: () => {
      appLifecyclePage.setApps([]);
      appLifecyclePage.setSelectedAppId("");
    },
    onSwitchWorkspace: () => {
      appLifecyclePage.setSelectedAppId("");
      experiencePage.resetMessages();
      navigateCenter();
    },
  });
  const authSession = consoleSession.authSession;
  const workflowPage = useWorkflowDesignerPage();
  const appLifecyclePage = useAppLifecyclePage({
    call,
    setStatus,
    setView,
    runtimeKey,
    workflowDefinition: workflowPage.workflowDefinition,
    resetWorkflowCanvas: workflowPage.resetWorkflowCanvas,
    restoreWorkflowCanvas: workflowPage.restoreWorkflowCanvas,
  });
  const runObservabilityPage = useRunObservabilityPage({ call, setStatus });
  const providerPage = useProviderPage({
    call,
    setStatus,
    workspaceId: authSession?.workspaceId || "default",
  });
  const apiKeyPage = useApiKeyPage({
    call,
    setRuntimeKey,
    setStatus,
    workspaceId: authSession?.workspaceId || "default",
  });
  const orgOpsPage = useOrgOpsPage({ call, setStatus });
  const knowledgePage = useKnowledgePage({ call, uploadForm, setStatus });
  const taskCenterPage = useTaskCenterPage({
    call,
    setStatus,
    refreshRuns: () => runObservabilityPage.refreshRuns(),
  });
  const experiencePage = useExperiencePage({
    call,
    setStatus,
    selectedApp: appLifecyclePage.selectedApp,
    authSession,
    runtimeKey,
  });

  const {
    apps,
    visibleApps,
    selectedApp,
    selectedAppId,
    appsLoading,
    appsError,
    definitionLoading,
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
    archiveApp,
    invokeSelectedApp,
  } = appLifecyclePage;
  const experienceBusyAction =
    experiencePage.busyAction || appLifecyclePage.busyAction;
  const modelOptions = useMemo<ModelOption[]>(() => {
    return providerPage.providers
      .filter((provider) => provider.status === "active")
      .map((provider) => ({
        providerId: provider.id,
        providerName: provider.name,
        model: (provider.llmModel || provider.defaultChatModel || "").trim(),
      }))
      .filter((option) => !!option.model);
  }, [providerPage.providers]);

  useEffect(() => {
    if (selectedApp?.type !== "agent" || !modelOptions.length) return;
    const currentProvider = modelOptions.find(
      (option) => option.providerId === agentDraft.providerAccountId,
    );
    if (agentDraft.providerAccountId && agentDraft.model && currentProvider)
      return;
    const matchedByModel =
      !agentDraft.providerAccountId && agentDraft.model
        ? modelOptions.find((option) => option.model === agentDraft.model)
        : undefined;
    const next = currentProvider || matchedByModel || modelOptions[0];
    if (
      appLifecyclePage.agentDraft.providerAccountId === next.providerId &&
      appLifecyclePage.agentDraft.model === next.model
    )
      return;
    setAgentDraft({
      ...agentDraft,
      providerAccountId: next.providerId,
      model: agentDraft.model || next.model,
    });
  }, [
    selectedApp?.type,
    modelOptions,
    agentDraft.providerAccountId,
    agentDraft.model,
  ]);

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
      } else if (
        route.view === "knowledge" ||
        route.view === "tasks" ||
        route.view === "providers" ||
        route.view === "apiKeys" ||
        route.view === "org"
      ) {
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
  useEffect(() => {
    if (authSession) {
      void refreshApps();
      void providerPage.refreshProviders();
      void orgOpsPage.refreshWorkspaceOptions();
    } else setAppsLoading(false);
  }, [authSession?.token]);
  useEffect(() => {
    if (authSession && selectedApp) void loadAppDefinition(selectedApp);
  }, [authSession?.token, selectedApp?.id]);
  useEffect(() => {
    if (runtimeKey) localStorage.setItem("aio.runtimeKey", runtimeKey);
    else localStorage.removeItem("aio.runtimeKey");
  }, [runtimeKey]);
  useEffect(() => {
    if (authSession && view === "observability")
      void runObservabilityPage.refreshRuns(selectedAppId || undefined);
  }, [authSession?.token, view, selectedAppId]);
  useEffect(() => {
    if (authSession && view === "observability" && runObservabilityPage.selectedRunId)
      void runObservabilityPage.loadRunTraces(runObservabilityPage.selectedRunId);
  }, [authSession?.token, view, runObservabilityPage.selectedRunId]);
  useEffect(() => {
    if (authSession && view === "knowledge") void knowledgePage.refreshKnowledge();
  }, [authSession?.token, view]);
  useEffect(() => {
    if (
      authSession &&
      selectedApp?.type === "agent" &&
      !knowledgePage.datasets.length
    )
      void knowledgePage.refreshKnowledge();
  }, [authSession?.token, selectedApp?.type, knowledgePage.datasets.length]);
  useEffect(() => {
    if (authSession && view === "tasks") void taskCenterPage.refreshTasks();
  }, [authSession?.token, view, taskCenterPage.filter]);
  useEffect(() => {
    if (authSession && view === "providers") void providerPage.refreshProviders();
  }, [authSession?.token, view]);
  useEffect(() => {
    if (authSession && view === "apiKeys") void apiKeyPage.refreshApiKeys();
  }, [authSession?.token, view]);
  useEffect(() => {
    if (authSession && view === "org") void orgOpsPage.refreshOrg();
  }, [authSession?.token, view]);

  async function call<T>(
    path: string,
    init: RequestInit = {},
    runtime = false,
  ): Promise<T> {
    const headers = runtime
      ? {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runtimeKey}`,
        }
      : {
          ...baseAdminHeaders,
          Authorization: `Bearer ${authSession?.token || ""}`,
          "X-Aio-Tenant": authSession?.tenantId || "default",
          "X-Aio-Workspace": authSession?.workspaceId || "default",
        };
    const response = await fetch(path, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    if (!runtime && response.status === 401) {
      consoleSession.clearSession();
      throw new Error("登录已过期，请重新登录");
    }
    if (!response.ok)
      throw new Error(body?.message || body?.error || response.statusText);
    return body as T;
  }

  async function uploadForm<T>(path: string, formData: FormData): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authSession?.token || ""}`,
        "X-Aio-Tenant": authSession?.tenantId || "default",
        "X-Aio-Workspace": authSession?.workspaceId || "default",
      },
      body: formData,
    });
    const text = await response.text();
    const body = text ? safeJsonParse(text) : null;
    if (response.status === 401) {
      consoleSession.clearSession();
      throw new Error("登录已过期，请重新登录");
    }
    if (!response.ok)
      throw new Error(body?.message || body?.error || response.statusText);
    return body as T;
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
    experiencePage.resetMessages();
    navigateExperience(app);
  }

  function openKnowledge() {
    setSelectedAppId("");
    knowledgePage.backToDatasetList();
    setView("knowledge");
    navigateKnowledge();
  }

  function openProviders() {
    setSelectedAppId("");
    setView("providers");
    navigateProviders();
  }

  function openApiKeys() {
    setSelectedAppId("");
    setView("apiKeys");
    navigateApiKeys();
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

  if (!authSession) {
    return (
      <LoginPage
        username={consoleSession.loginUsername}
        password={consoleSession.loginPassword}
        error={consoleSession.loginError}
        loggingIn={consoleSession.busyAction === "login"}
        setUsername={consoleSession.setLoginUsername}
        setPassword={consoleSession.setLoginPassword}
        login={consoleSession.loginConsole}
      />
    );
  }

  return (
    <main className="consoleShell">
      <TopNav
        status={status}
        session={authSession}
        workspaces={orgOpsPage.workspaces}
        menuOpen={userMenuOpen}
        settingsOpen={settingsMenuOpen}
        switching={consoleSession.busyAction === "switch-workspace"}
        setMenuOpen={setUserMenuOpen}
        setSettingsOpen={setSettingsMenuOpen}
        switchWorkspace={consoleSession.switchWorkspace}
        openProviders={openProviders}
        logout={consoleSession.logoutConsole}
      />
      <section className="consoleBody">
        <SideNav
          activeView={view}
          session={authSession}
          onCreate={() => openCreateModal("agent", "agent")}
          openApps={backToCenter}
          openObservability={() => openObservability()}
          openKnowledge={openKnowledge}
          openApiKeys={openApiKeys}
          openOrg={openOrg}
        />
        {view === "center" ? (
          <AppCenter
            apps={apps}
            visibleApps={visibleApps}
            loading={appsLoading}
            error={appsError}
            filter={filter}
            query={query}
            session={authSession}
            setFilter={setFilter}
            setQuery={setQuery}
            refreshApps={refreshApps}
            openCreateModal={openCreateModal}
            openDesigner={openDesigner}
            openExperience={openExperience}
            archiveApp={archiveApp}
            busyAction={appLifecyclePage.busyAction}
          />
        ) : view === "api" ? (
          <AppApiDocsPage
            selectedApp={selectedApp}
            selectedAppId={selectedAppId}
            appsLoading={appsLoading}
            session={authSession}
            runtimeKey={runtimeKey}
            setRuntimeKey={setRuntimeKey}
            busyAction={appLifecyclePage.busyAction}
            openDesigner={openDesigner}
            back={backToCenter}
          />
        ) : view === "experience" ? (
          <ExperiencePage
            selectedApp={selectedApp}
            selectedAppId={selectedAppId}
            appsLoading={appsLoading}
            messages={experiencePage.messages}
            input={experiencePage.input}
            feedback={experiencePage.feedback}
            runtimeKey={runtimeKey}
            busyAction={experienceBusyAction}
            setInput={experiencePage.setInput}
            setFeedback={experiencePage.setFeedback}
            sendMessage={experiencePage.sendMessage}
            submitWait={experiencePage.submitWait}
            openDesigner={openDesigner}
            back={backToCenter}
          />
        ) : view === "observability" ? (
          <RunObservabilityPage
            apps={apps}
            selectedApp={selectedApp}
            selectedAppId={selectedAppId}
            runs={runObservabilityPage.runs}
            traces={runObservabilityPage.traces}
            selectedRun={runObservabilityPage.selectedRun}
            selectedRunId={runObservabilityPage.selectedRunId}
            loading={runObservabilityPage.loading}
            tracesLoading={runObservabilityPage.tracesLoading}
            error={runObservabilityPage.error}
            refreshRuns={() => runObservabilityPage.refreshRuns(selectedAppId || undefined)}
            selectRun={runObservabilityPage.selectRun}
            openDesigner={openDesigner}
            openGlobal={() => openObservability()}
            back={backToCenter}
          />
        ) : view === "knowledge" ? (
          <KnowledgePage
            {...knowledgePage}
            providerOptions={providerPage.providers}
            runtimeKey={runtimeKey}
          />
        ) : view === "tasks" ? (
          <TaskCenterPage {...taskCenterPage} />
        ) : view === "providers" ? (
          <ProviderPage {...providerPage} />
        ) : view === "apiKeys" ? (
          <ApiKeyPage
            apiKeys={apiKeyPage.apiKeys}
            loading={apiKeyPage.loading}
            error={apiKeyPage.error}
            session={authSession}
            apps={apps}
            runtimeKey={runtimeKey}
            newName={apiKeyPage.newName}
            scopeType={apiKeyPage.scopeType}
            selectedAppId={apiKeyPage.selectedAppId}
            createdApiKey={apiKeyPage.createdApiKey}
            formOpen={apiKeyPage.formOpen}
            busyAction={apiKeyPage.busyAction}
            setNewName={apiKeyPage.setNewName}
            setRuntimeKey={setRuntimeKey}
            setScopeType={apiKeyPage.setScopeType}
            setSelectedAppId={apiKeyPage.setSelectedAppId}
            openCreateForm={apiKeyPage.openCreateForm}
            closeForm={apiKeyPage.closeForm}
            refreshApiKeys={apiKeyPage.refreshApiKeys}
            createApiKey={apiKeyPage.createApiKey}
            revokeApiKey={apiKeyPage.revokeApiKey}
            deleteApiKey={apiKeyPage.deleteApiKey}
          />
        ) : view === "org" ? (
          <OrgOpsPage {...orgOpsPage} session={authSession} />
        ) : (
          <DesignerPage
            selectedApp={selectedApp}
            selectedAppId={selectedAppId}
            appsLoading={appsLoading}
            definitionLoading={definitionLoading}
            busyAction={appLifecyclePage.busyAction}
            agentDraft={agentDraft}
            setAgentDraft={setAgentDraft}
            modelOptions={modelOptions}
            datasets={knowledgePage.datasets}
            runResult={runResult}
            runtimeKey={runtimeKey}
            setRuntimeKey={setRuntimeKey}
            validationReport={validationReport}
            releasePanelOpen={releasePanelOpen}
            pendingPublishDefinitionJson={appLifecyclePage.pendingPublishDefinitionJson}
            setReleasePanelOpen={setReleasePanelOpen}
            publishSelectedApp={publishSelectedApp}
            confirmPublishSelectedApp={appLifecyclePage.confirmPublishSelectedApp}
            invokeSelectedApp={invokeSelectedApp}
            archiveApp={archiveApp}
            openApiDocs={openApiDocs}
            openObservability={openObservability}
            openExperience={openExperience}
            back={backToCenter}
            workflowProps={workflowPage.workflowProps}
          />
        )}
      </section>
      {createOpen && (
        <CreateAppModal
          createType={createType}
          createMode={createMode}
          createName={createName}
          creating={appLifecyclePage.busyAction === "create"}
          setCreateType={setCreateType}
          setCreateMode={setCreateMode}
          setCreateName={setCreateName}
          close={() => setCreateOpen(false)}
          createApp={createApp}
        />
      )}
    </main>
  );
}


