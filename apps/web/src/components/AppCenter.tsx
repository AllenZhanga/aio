import { AlertCircle, Bot, Loader2, Play, Plus, RefreshCw, Search, Trash2, Workflow } from "lucide-react";
import type { AgentMode, AppKind, AppRecord, AuthSession } from "../types";
import { ActionBar, Modal, PopConfirm, StatePanel } from "./ui";

const agentModes: Array<{
  mode: AgentMode;
  title: string;
  typeLabel: string;
  description: string;
  icon: typeof Bot;
}> = [
  {
    mode: "agent",
    title: "Agent",
    typeLabel: "智能体",
    description: "适合自主规划、工具调用、知识问答和任务执行。",
    icon: Bot,
  },
];

export function AppCenter(props: {
  apps: AppRecord[];
  visibleApps: AppRecord[];
  loading: boolean;
  error: string;
  filter: "all" | AppKind;
  query: string;
  session: AuthSession;
  setFilter: (filter: "all" | AppKind) => void;
  setQuery: (query: string) => void;
  refreshApps: () => Promise<void>;
  openCreateModal: (type: AppKind, mode?: AgentMode) => void;
  openDesigner: (app: AppRecord) => void;
  openExperience: (app: AppRecord) => void;
  archiveApp: (app: AppRecord) => Promise<void>;
  busyAction: string;
}) {
  const isFilteredEmpty = !props.loading && !props.error && props.apps.length > 0 && props.visibleApps.length === 0;
  return (
    <section className="workspacePane">
      <div className="pageHeader">
        <div>
          <h1>应用管理</h1>
          <p>当前账号只看到工作空间 {props.session.workspaceId} 的应用和数据。</p>
        </div>
        <div className="headerActions">
          <button className="primaryBtn" onClick={() => props.openCreateModal("agent", "agent")}>
            <Plus size={17} /> 创建应用
          </button>
        </div>
      </div>
      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshApps()}>重试</button>
        </div>
      )}
      <div className="toolbar">
        <div className="filterTabs">
          {([
            { key: "all", label: "全部" },
            { key: "agent", label: "Agent" },
            { key: "workflow", label: "工作流" },
          ] as const).map((item) => (
            <button key={item.key} className={props.filter === item.key ? "active" : ""} onClick={() => props.setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="searchInput">
          <Search size={16} />
          <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="搜索应用名称" />
        </div>
        <button className="iconBtn" disabled={props.loading} onClick={() => void props.refreshApps()}>
          {props.loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
        </button>
      </div>
      {props.loading && <StatePanel icon="loading" title="正在同步应用列表" text="正在读取当前空间的应用、发布状态和最近更新时间。" />}
      {!props.loading && !props.error && (
        <div className="appGrid">
          {props.visibleApps.map((app) => (
            <AppTile
              key={app.id}
              app={app}
              openDesigner={props.openDesigner}
              openExperience={props.openExperience}
              archiveApp={props.archiveApp}
              archiving={props.busyAction === `archive-${app.id}`}
            />
          ))}
        </div>
      )}
      {!props.loading && !props.error && !props.apps.length && <StatePanel title="暂无应用" text="当前账号的工作空间还没有应用，可先创建 Agent 或 Workflow。" />}
      {isFilteredEmpty && <StatePanel title="没有匹配的应用" text="请调整筛选条件或搜索关键字。" />}
    </section>
  );
}

function AppTile({
  app,
  openDesigner,
  openExperience,
  archiveApp,
  archiving,
}: {
  app: AppRecord;
  openDesigner: (app: AppRecord) => void;
  openExperience: (app: AppRecord) => void;
  archiveApp: (app: AppRecord) => Promise<void>;
  archiving: boolean;
}) {
  const statusMeta = getAppStatusMeta(app);
  return (
    <article
      className="appTile"
      role="button"
      tabIndex={0}
      onClick={() => openDesigner(app)}
      onKeyDown={(event) => {
        if (event.key === "Enter") openDesigner(app);
      }}
    >
      <div className="tileHeader">
        <span className={`tileIcon ${app.type}`}>
          {app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}
        </span>
        <strong className="tileTitle">{app.name}</strong>
        <span className={`publishState ${statusMeta.tone}`}>
          <i /> {statusMeta.label}
        </span>
      </div>
      <dl>
        <dt>应用 ID</dt>
        <dd>{app.id}</dd>
        <dt>应用类型</dt>
        <dd>{app.type === "workflow" ? "工作流" : "Agent"}</dd>
      </dl>
      <div className="tileActions">
        <p>更新于 {formatDate(app.updatedAt)}</p>
        <div className="tileActionButtons">
          <button
            className="ghostTinyBtn"
            onClick={(event) => {
              event.stopPropagation();
              openExperience(app);
            }}
          >
            <Play size={14} /> 体验
          </button>
          <PopConfirm
            title="删除应用"
            message={`确认删除（归档）应用「${app.name}」？归档后会从当前应用列表移除，历史版本和运行记录仍保留。`}
            confirmText="归档应用"
            onConfirm={() => archiveApp(app)}
          >
            <button className="dangerTextBtn" disabled={archiving}>
              {archiving ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} 删除
            </button>
          </PopConfirm>
        </div>
      </div>
    </article>
  );
}

export function CreateAppModal(props: {
  createType: AppKind;
  createMode: AgentMode;
  createName: string;
  creating: boolean;
  setCreateType: (type: AppKind) => void;
  setCreateMode: (mode: AgentMode) => void;
  setCreateName: (name: string) => void;
  close: () => void;
  createApp: () => Promise<void>;
}) {
  return (
    <Modal
      open
      title="创建应用"
      description="选择应用类型，创建后进入对应设计页面。"
      onClose={props.close}
      footer={
        <ActionBar>
          <button className="ghostBtn" disabled={props.creating} onClick={props.close}>取消</button>
          <button className="primaryBtn" disabled={props.creating} onClick={() => void props.createApp()}>
            {props.creating ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} 创建
          </button>
        </ActionBar>
      }
    >
      <div className="createTypeGrid">
        {agentModes.map((item) => (
          <CreateTypeCard
            key={item.mode}
            active={props.createType === "agent" && props.createMode === item.mode}
            icon={item.icon}
            title={item.title}
            text={item.description}
            onClick={() => {
              props.setCreateType("agent");
              props.setCreateMode(item.mode);
            }}
          />
        ))}
        <CreateTypeCard
          active={props.createType === "workflow"}
          icon={Workflow}
          title="Workflow"
          text="可视化拖拽节点、连线、条件分支和人工确认。"
          onClick={() => props.setCreateType("workflow")}
        />
      </div>
      <label className="field">
        <span>应用名称</span>
        <input value={props.createName} onChange={(event) => props.setCreateName(event.target.value)} placeholder="输入应用名称" />
      </label>
    </Modal>
  );
}

function CreateTypeCard({
  active,
  icon: Icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: typeof Bot;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className={`typeCard ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{text}</span>
    </button>
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

function getAppStatusMeta(app: AppRecord) {
  if (app.status === "published") return { label: "已发布", tone: "success" };
  if (app.status === "published_with_draft") return { label: "有未发布变更", tone: "warning" };
  if (app.status === "disabled") return { label: "已禁用", tone: "danger" };
  if (app.status === "archived") return { label: "已归档", tone: "muted" };
  if (app.publishedVersionId) return { label: "有未发布变更", tone: "warning" };
  return { label: "草稿", tone: "draft" };
}
