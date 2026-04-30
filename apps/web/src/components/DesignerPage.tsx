import { useEffect, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Code2, Edit3, Info, Loader2, Play, Rocket, Save, Trash2, Workflow, X } from "lucide-react";
import type { AgentDraft, AppDraft, AppRecord, DatasetRecord, ModelOption, ValidationReport, WorkflowDesignerProps } from "../types";
import { AgentDesigner } from "./AgentDesigner";
import { ActionBar, Drawer, Field, PopConfirm, StatePanel } from "./ui";
import { WorkflowDesigner } from "./WorkflowDesigner";

export function DesignerPage(props: {
  selectedApp?: AppRecord;
  selectedAppId: string;
  appsLoading: boolean;
  definitionLoading: boolean;
  busyAction: string;
  agentDraft: AgentDraft;
  setAgentDraft: (draft: AgentDraft) => void;
  modelOptions: ModelOption[];
  datasets: DatasetRecord[];
  runResult: Record<string, unknown> | null;
  runtimeKey: string;
  setRuntimeKey: (value: string) => void;
  validationReport: ValidationReport | null;
  releasePanelOpen: boolean;
  currentDraft: AppDraft | null;
  draftSaveState: "idle" | "unsaved" | "saving" | "saved" | "error";
  draftSaveMessage: string;
  pendingPublishDefinitionJson: string;
  setReleasePanelOpen: (open: boolean) => void;
  publishSelectedApp: () => Promise<void>;
  confirmPublishSelectedApp: () => Promise<void>;
  archiveApp: (app: AppRecord) => Promise<void>;
  updateAppInfo: (app: AppRecord, updates: { name: string; description?: string }) => Promise<AppRecord | null>;
  openApiDocs: (app: AppRecord) => void;
  openObservability: (app: AppRecord) => void;
  openExperience: (app: AppRecord) => void;
  back: () => void;
  workflowProps: WorkflowDesignerProps;
}) {
  if (!props.selectedApp) {
    return (
      <section className="workspacePane">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <StatePanel
          icon={props.appsLoading ? "loading" : "missing"}
          title={props.appsLoading ? "正在打开应用" : "未找到应用"}
          text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的基础信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"}
        />
      </section>
    );
  }

  const statusMeta = getAppStatusMeta(props.selectedApp);
  const appKindLabel = props.selectedApp.type === "workflow" ? "工作流" : "智能体";
  return (
    <section className="designerPane">
      <header className="designerHeader">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <div className="designerTitle">
          <span className={`tileIcon ${props.selectedApp.type}`}>{props.selectedApp.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span>
          <div>
            <h1>{props.selectedApp.name}</h1>
            <p>{appKindLabel} · {statusMeta.label}</p>
          </div>
          {props.definitionLoading && <span className="statusPill"><Loader2 className="spin" size={13} /> 同步版本</span>}
          {!props.definitionLoading && <DraftStatusPill draft={props.currentDraft} state={props.draftSaveState} message={props.draftSaveMessage} />}
        </div>
        <div className="designerActions">
          <AppInfoDrawerButton {...props} appKindLabel={appKindLabel} />
          <button className="primaryBtn" onClick={() => props.openExperience(props.selectedApp!)}><Play size={16} /> 对话体验</button>
          <button className="ghostBtn" onClick={() => props.openObservability(props.selectedApp!)}><Play size={16} /> 运行观测</button>
          <button className="ghostBtn" onClick={() => props.openApiDocs(props.selectedApp!)}><Code2 size={16} /> API 文档</button>
          <button className="primaryBtn" disabled={!!props.busyAction} onClick={() => void props.publishSelectedApp()}>{props.busyAction === "publish" ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />} 发布</button>
        </div>
      </header>
      {props.selectedApp.type === "agent" ? (
        <AgentDesigner draft={props.agentDraft} setDraft={props.setAgentDraft} modelOptions={props.modelOptions} datasets={props.datasets} runResult={props.runResult} runtimeKey={props.runtimeKey} setRuntimeKey={props.setRuntimeKey} />
      ) : (
        <WorkflowDesigner {...props.workflowProps} modelOptions={props.modelOptions} />
      )}
      {props.releasePanelOpen && <ReleaseCheckPanel report={props.validationReport} canPublish={!!props.pendingPublishDefinitionJson} busy={props.busyAction === "publish-confirm"} close={() => props.setReleasePanelOpen(false)} confirm={() => void props.confirmPublishSelectedApp()} />}
    </section>
  );
}

function DraftStatusPill({ draft, state, message }: { draft: AppDraft | null; state: "idle" | "unsaved" | "saving" | "saved" | "error"; message: string }) {
  if (!draft) return <span className="statusPill compact" title="草稿未同步"><Save size={13} /> 未同步</span>;
  if (state === "saving") return <span className="statusPill compact" title="草稿保存中"><Loader2 className="spin" size={13} /> 保存中</span>;
  if (state === "error") return <span className="statusPill compact danger" title={message || "草稿保存失败"}><X size={13} /> 保存失败</span>;
  if (state === "unsaved") return <span className="statusPill compact warning" title="草稿未保存"><Save size={13} /> 未保存</span>;
  return <span className="statusPill compact success" title={draft.dirty ? "草稿已保存，有未发布修改" : "草稿与线上版本一致"}><CheckCircle2 size={13} /> 已保存</span>;
}

function AppInfoDrawerButton(props: Parameters<typeof DesignerPage>[0] & { appKindLabel: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.selectedApp?.name || "");
  const [description, setDescription] = useState(props.selectedApp?.description || "");
  const app = props.selectedApp;

  useEffect(() => {
    setName(app?.name || "");
    setDescription(app?.description || "");
  }, [app?.id, app?.name, app?.description]);

  if (!app) return null;

  async function saveInfo() {
    if (!app) return;
    const updated = await props.updateAppInfo(app, { name: name.trim() || app.name, description });
    if (updated) setOpen(false);
  }

  return (
    <>
      <button className="ghostBtn compactAction" onClick={() => setOpen(true)}><Info size={16} /> 信息</button>
      <Drawer
        open={open}
        title={`${props.appKindLabel}信息`}
        description="集中管理名称、标识和危险操作，避免挤占设计器工具栏。"
        onClose={() => setOpen(false)}
        className="appInfoDrawer"
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={() => setOpen(false)}>关闭</button>
            <button className="primaryBtn" disabled={props.busyAction === "app-info"} onClick={() => void saveInfo()}>
              {props.busyAction === "app-info" ? <Loader2 className="spin" size={16} /> : <Edit3 size={16} />} 保存信息
            </button>
          </ActionBar>
        }
      >
        <section className="designCard compact appInfoSection">
          <Field label={`${props.appKindLabel}名称`}>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="描述">
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="补充应用用途、维护人或业务边界" />
          </Field>
        </section>
        <section className="designCard compact appInfoSection">
          <h3>标识信息</h3>
          <div className="sourceDocMeta">
            <span>{props.appKindLabel} ID</span><code>{app.id}</code>
            <span>类型</span><code>{props.appKindLabel}</code>
            <span>状态</span><code>{getAppStatusMeta(app).label}</code>
            <span>线上版本</span><code>{app.publishedVersionId || "未发布"}</code>
            <span>草稿版本</span><code>{props.currentDraft ? `r${props.currentDraft.revision}` : "未同步"}</code>
            <span>未发布修改</span><code>{props.currentDraft?.dirty ? "有" : "无"}</code>
          </div>
        </section>
        <section className="designCard compact appInfoDanger">
          <h3>危险操作</h3>
          <p>归档后会从应用列表移除，历史版本和运行记录仍会保留。</p>
          <PopConfirm
            title="删除应用"
            message={`确认删除（归档）应用「${app.name}」？`}
            confirmText="归档应用"
            placement="bottom-end"
            onConfirm={() => props.archiveApp(app)}
          >
            <button className="dangerBtn" disabled={!!props.busyAction}>{props.busyAction === `archive-${app.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} 删除 / 归档</button>
          </PopConfirm>
        </section>
      </Drawer>
    </>
  );
}

function ReleaseCheckPanel({ report, canPublish, busy, close, confirm }: { report: ValidationReport | null; canPublish: boolean; busy: boolean; close: () => void; confirm: () => void }) {
  const issues = report?.issues || [];
  return (
    <aside className="releasePanel">
      <div className="releasePanelHeader">
        <div>
          <h2>发布检查</h2>
          <p>{report ? (report.passed ? "无阻断错误，可以发布。" : "存在阻断错误，发布已停止。") : "尚未执行检查。"}</p>
        </div>
        <button className="iconBtn" onClick={close}><X size={18} /></button>
      </div>
      {report && (
        <div className="releaseSummary">
          <article className={report.blockingErrors ? "danger" : "success"}><strong>{report.blockingErrors}</strong><span>阻断错误</span></article>
          <article><strong>{report.warnings}</strong><span>警告</span></article>
          <article><strong>{report.suggestions}</strong><span>建议</span></article>
        </div>
      )}
      {!issues.length && <StatePanel title="检查通过" text="当前定义没有阻断错误。确认后才会创建版本并发布到 Runtime。" />}
      {issues.length > 0 && (
        <div className="releaseIssueList">
          {issues.map((issue) => (
            <article className={`releaseIssue ${issue.severity}`} key={`${issue.code}-${issue.target}-${issue.title}`}>
              <div><span>{issue.severity === "error" ? "阻断" : issue.severity === "warning" ? "警告" : "建议"}</span><code>{issue.code}</code></div>
              <strong>{issue.title}</strong>
              <p>{issue.detail}</p>
              <small>{issue.target}</small>
            </article>
          ))}
        </div>
      )}
      <div className="releasePanelFooter">
        <button className="ghostBtn" onClick={close}>取消</button>
        <button className="primaryBtn" disabled={!canPublish || busy} onClick={confirm}>
          {busy ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />} 确认发布
        </button>
      </div>
    </aside>
  );
}

function getAppStatusMeta(app: AppRecord) {
  if (app.status === "published") return { label: "已发布", tone: "success" };
  if (app.status === "published_with_draft") return { label: "有未发布变更", tone: "warning" };
  if (app.status === "disabled") return { label: "已禁用", tone: "danger" };
  if (app.status === "archived") return { label: "已归档", tone: "muted" };
  if (app.publishedVersionId) return { label: "有未发布变更", tone: "warning" };
  return { label: "草稿", tone: "draft" };
}
