import { AlertCircle, ArrowLeft, Bot, ClipboardCheck, Loader2, Play, Settings2, Sparkles, Workflow } from "lucide-react";
import type { AppRecord, ExperienceMessage, RuntimeWaitTask } from "../types";
import { Field, StatePanel } from "./ui";

export function ExperiencePage(props: {
  selectedApp?: AppRecord;
  selectedAppId: string;
  appsLoading: boolean;
  messages: ExperienceMessage[];
  input: string;
  feedback: string;
  runtimeKey: string;
  busyAction: string;
  setInput: (value: string) => void;
  setFeedback: (value: string) => void;
  sendMessage: () => Promise<void>;
  submitWait: (task: RuntimeWaitTask, action?: string) => Promise<void>;
  openDesigner: (app: AppRecord) => void;
  back: () => void;
}) {
  if (!props.selectedApp) {
    return (
      <section className="workspacePane">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开应用体验" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的体验信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} />
      </section>
    );
  }

  const app = props.selectedApp;
  const canSend = !!props.runtimeKey && app.status === "published" && !!props.input.trim() && props.busyAction !== "experience-send";
  return (
    <section className="experiencePane">
      <div className="experienceHero">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <div className="experienceHeroText">
          <span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span>
          <div>
            <h1>{app.name}</h1>
            <p>{app.type === "workflow" ? "像最终用户一样发起流程，对话中直接提交反馈，AI 会自动续跑。" : "像最终用户一样直接和 Agent 对话，不需要先看 API 文档。"}</p>
          </div>
        </div>
        <div className="designerActions">
          <button className="ghostBtn" onClick={() => props.openDesigner(app)}><Settings2 size={16} /> 返回设计</button>
        </div>
      </div>
      {app.status !== "published" && <div className="warningBox"><AlertCircle size={16} /> 当前应用尚未发布。请先发布应用，体验界面会调用已发布版本。</div>}
      <div className="experienceShell">
        <aside className="experienceBrief">
          <strong>体验通道</strong>
          <dl>
            <dt>App ID</dt><dd>{app.id}</dd>
            <dt>类型</dt><dd>{app.type === "workflow" ? "Workflow" : "Agent"}</dd>
            <dt>状态</dt><dd>{getAppStatusMeta(app).label}</dd>
            <dt>Runtime Key</dt><dd>{props.runtimeKey ? "已选择" : "未选择"}</dd>
          </dl>
          <p>{app.type === "workflow" ? "体验页使用 API Key 菜单中创建的 Key。流程到达人工确认节点时，等待卡片会直接出现在对话流里。" : "体验页使用 API Key 菜单中创建的 Key，并通过流式响应展示 Agent 回复。"}</p>
        </aside>
        <main className="chatConsole">
          <div className="chatFeed">
            {!props.messages.length && (
              <div className="chatEmpty">
                <Sparkles size={26} />
                <strong>开始一次真实应用体验</strong>
                <span>{app.type === "workflow" ? "输入业务问题，流程暂停时会在这里等待用户反馈。" : "输入问题，直接查看 Agent 的最终回复。"}</span>
              </div>
            )}
            {props.messages.map((message) => <ExperienceBubble key={message.id} message={message} feedback={props.feedback} busyAction={props.busyAction} setFeedback={props.setFeedback} submitWait={props.submitWait} />)}
            {props.busyAction === "experience-send" && <div className="chatThinking"><Loader2 className="spin" size={16} /> AI 应用正在处理...</div>}
          </div>
          <div className="chatComposer">
            <textarea
              value={props.input}
              onChange={(event) => props.setInput(event.target.value)}
              placeholder={app.type === "workflow" ? "输入流程问题，例如：这个退款请求应该怎么处理？" : "输入你想问 Agent 的问题"}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void props.sendMessage();
              }}
            />
            <button className="primaryBtn" disabled={!canSend} onClick={() => void props.sendMessage()}>
              {props.busyAction === "experience-send" ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 发送
            </button>
          </div>
        </main>
      </div>
    </section>
  );
}

function ExperienceBubble(props: {
  message: ExperienceMessage;
  feedback: string;
  busyAction: string;
  setFeedback: (value: string) => void;
  submitWait: (task: RuntimeWaitTask, action?: string) => Promise<void>;
}) {
  const message = props.message;
  if (message.role === "wait" && message.waitTask) {
    const waitTask = message.waitTask;
    const actions = waitTaskActions(waitTask);
    const pending = !waitTask.status || waitTask.status === "pending";
    return (
      <article className="chatBubble wait">
        <div className="bubbleMeta"><ClipboardCheck size={15} /> {message.meta} · {waitTask.status || "pending"}</div>
        <strong>{waitTask.title || "等待用户反馈"}</strong>
        <p>{message.text}</p>
        {pending ? <Field label="反馈内容"><textarea value={props.feedback} onChange={(event) => props.setFeedback(event.target.value)} /></Field> : <p className="mutedText">该等待项已处理，流程已继续。</p>}
        <div className="buttonRow">
          {actions.map((action) => (
            <button key={action.key} className={action.key === "reject" ? "dangerBtn" : "primaryBtn"} disabled={!pending || props.busyAction === `experience-wait-${waitTask.id}`} onClick={() => void props.submitWait(waitTask, action.key)}>
              {props.busyAction === `experience-wait-${waitTask.id}` ? <Loader2 className="spin" size={16} /> : <ClipboardCheck size={16} />} {action.label}
            </button>
          ))}
        </div>
      </article>
    );
  }
  return (
    <article className={`chatBubble ${message.role}`}>
      <div className="bubbleMeta">{message.role === "user" ? "用户" : message.role === "assistant" ? "AI 应用" : "系统"}{message.meta ? ` · ${message.meta}` : ""}</div>
      <p>{message.text}</p>
    </article>
  );
}

function waitTaskActions(task: RuntimeWaitTask) {
  const raw = task.actions;
  if (Array.isArray(raw)) {
    const actions = raw
      .map((item) => {
        if (typeof item === "string") return { key: item, label: item };
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const key = String(record.key || record.value || record.action || "approve");
          return { key, label: String(record.label || record.name || key) };
        }
        return null;
      })
      .filter((item): item is { key: string; label: string } => !!item);
    if (actions.length) return actions;
  }
  return [{ key: "approve", label: "确认继续" }, { key: "reject", label: "拒绝" }];
}

function getAppStatusMeta(app: AppRecord) {
  if (app.status === "published") return { label: "已发布", tone: "success" };
  if (app.status === "published_with_draft") return { label: "有未发布变更", tone: "warning" };
  if (app.status === "disabled") return { label: "已禁用", tone: "danger" };
  if (app.status === "archived") return { label: "已归档", tone: "muted" };
  if (app.publishedVersionId) return { label: "有未发布变更", tone: "warning" };
  return { label: "草稿", tone: "draft" };
}
