import { AlertCircle, ClipboardCheck, Loader2, RefreshCw, Zap } from "lucide-react";
import type { WaitTaskRecord } from "../types";
import { CodeBlock, StatePanel } from "./ui";

export function TaskCenterPage(props: {
  tasks: WaitTaskRecord[];
  loading: boolean;
  error: string;
  filter: string;
  busyAction: string;
  setFilter: (value: string) => void;
  refreshTasks: () => Promise<void>;
  submitTask: (task: WaitTaskRecord, action?: string) => Promise<void>;
}) {
  const pending = props.tasks.filter((task) => task.status === "pending").length;
  return (
    <section className="workspacePane opsPane">
      <div className="pageHeader">
        <div>
          <h1>流程等待</h1>
          <p>这是 Workflow 在人工确认、表单补充等节点暂停后生成的待处理项；可由业务操作员在这里提交，流程会自动恢复。</p>
        </div>
        <button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshTasks()}>
          {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新
        </button>
      </div>
      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshTasks()}>重试</button>
        </div>
      )}
      <div className="runStats">
        <article><span>等待项</span><strong>{props.tasks.length}</strong><p>当前空间</p></article>
        <article><span>待用户操作</span><strong>{pending}</strong><p>pending</p></article>
        <article><span>已处理</span><strong>{props.tasks.length - pending}</strong><p>submitted/rejected</p></article>
        <article><span>筛选</span><strong>{props.filter}</strong><p>状态过滤</p></article>
        <article><span>用途</span><strong><Zap size={24} /></strong><p>流程恢复</p></article>
      </div>
      <div className="filterTabs opsFilters">
        {["all", "pending", "submitted", "rejected", "cancelled", "expired"].map((item) => (
          <button key={item} className={props.filter === item ? "active" : ""} onClick={() => props.setFilter(item)}>{item}</button>
        ))}
      </div>
      {props.loading && <StatePanel icon="loading" title="正在同步等待项" text="正在读取当前空间的流程等待任务。" />}
      {!props.loading && !props.tasks.length && <StatePanel title="暂无流程等待" text="运行包含人工确认节点的 Workflow 后，会在这里出现 pending 等待项；外部用户端也可以通过 API 对接处理。" />}
      {!props.loading && props.tasks.length > 0 && (
        <div className="taskGrid">
          {props.tasks.map((task) => (
            <article className="designCard taskCard" key={task.id}>
              <div className="taskHeader">
                <span className={`runStatus ${task.status}`}>{task.status}</span>
                <small>{formatDate(task.createdAt)}</small>
              </div>
              <h2>{task.title || task.nodeId}</h2>
              <p>{task.description || "等待业务用户或操作员处理。"}</p>
              <dl>
                <dt>应用</dt><dd>{task.appName}</dd>
                <dt>Run</dt><dd>{task.runId}</dd>
                <dt>节点</dt><dd>{task.nodeId} / {task.nodeType}</dd>
                <dt>过期</dt><dd>{formatDate(task.expiresAt)}</dd>
              </dl>
              <CodeBlock title="上下文" code={JSON.stringify(task.context || {}, null, 2)} />
              {task.status === "pending" && (
                <div className="buttonRow">
                  <button className="primaryBtn" disabled={props.busyAction === `wait-${task.id}`} onClick={() => void props.submitTask(task, "approve")}>
                    {props.busyAction === `wait-${task.id}` ? <Loader2 className="spin" size={16} /> : <ClipboardCheck size={16} />} 确认继续
                  </button>
                  <button className="dangerBtn" disabled={props.busyAction === `wait-${task.id}`} onClick={() => void props.submitTask(task, "reject")}>拒绝</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "刚刚";
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}
