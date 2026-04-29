import { ArrowLeft, Bot, Code2, Loader2, Play, Rocket, Trash2, Workflow, X } from "lucide-react";
import type { AgentDraft, AppRecord, DatasetRecord, ModelOption, ValidationReport, WorkflowDesignerProps } from "../types";
import { AgentDesigner } from "./AgentDesigner";
import { StatePanel } from "./ui";
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
  pendingPublishDefinitionJson: string;
  setReleasePanelOpen: (open: boolean) => void;
  publishSelectedApp: () => Promise<void>;
  confirmPublishSelectedApp: () => Promise<void>;
  invokeSelectedApp: () => Promise<void>;
  archiveApp: (app: AppRecord) => Promise<void>;
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
  return (
    <section className="designerPane">
      <header className="designerHeader">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <div className="designerTitle">
          <span className={`tileIcon ${props.selectedApp.type}`}>{props.selectedApp.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span>
          <div>
            <h1>{props.selectedApp.name}</h1>
            <p>{props.selectedApp.type} · {statusMeta.label} · {props.selectedApp.id}</p>
          </div>
          {props.definitionLoading && <span className="statusPill"><Loader2 className="spin" size={13} /> 同步版本</span>}
        </div>
        <div className="designerActions">
          <button className="primaryBtn" onClick={() => props.openExperience(props.selectedApp!)}><Play size={16} /> 对话体验</button>
          <button className="ghostBtn" onClick={() => props.openObservability(props.selectedApp!)}><Play size={16} /> 运行观测</button>
          <button className="ghostBtn" onClick={() => props.openApiDocs(props.selectedApp!)}><Code2 size={16} /> API 文档</button>
          <button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.invokeSelectedApp()}>{props.busyAction === "run" ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 试运行</button>
          <button className="dangerBtn" disabled={!!props.busyAction} onClick={() => void props.archiveApp(props.selectedApp!)}>{props.busyAction === `archive-${props.selectedApp.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} 删除</button>
          <button className="primaryBtn" disabled={!!props.busyAction} onClick={() => void props.publishSelectedApp()}>{props.busyAction === "publish" ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />} 发布</button>
        </div>
      </header>
      {props.selectedApp.type === "agent" ? (
        <AgentDesigner draft={props.agentDraft} setDraft={props.setAgentDraft} modelOptions={props.modelOptions} datasets={props.datasets} runResult={props.runResult} runtimeKey={props.runtimeKey} setRuntimeKey={props.setRuntimeKey} />
      ) : (
        <WorkflowDesigner {...props.workflowProps} />
      )}
      {props.releasePanelOpen && <ReleaseCheckPanel report={props.validationReport} canPublish={!!props.pendingPublishDefinitionJson} busy={props.busyAction === "publish-confirm"} close={() => props.setReleasePanelOpen(false)} confirm={() => void props.confirmPublishSelectedApp()} />}
    </section>
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
