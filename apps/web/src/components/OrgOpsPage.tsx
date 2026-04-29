import { AlertCircle, Building2, ClipboardCheck, Code2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ApiKeyRecord, AuditEvent, AuthSession, TenantRecord, UsageSummary, WorkspaceRecord } from "../types";
import { EntityList, EntityRow, StatePanel } from "./ui";

export function OrgOpsPage(props: {
  tenants: TenantRecord[];
  workspaces: WorkspaceRecord[];
  apiKeys: ApiKeyRecord[];
  usage: UsageSummary | null;
  auditEvents: AuditEvent[];
  session: AuthSession;
  loading: boolean;
  error: string;
  refreshOrg: () => Promise<void>;
}) {
  const usage = props.usage;
  const roleLabel = props.session.role === "admin" || (!props.session.role && props.session.userId === "admin") ? "管理员" : "成员";
  const activeKeys = props.apiKeys.filter((key) => key.status === "active").length;

  return (
    <section className="workspacePane orgPane">
      <div className="pageHeader">
        <div>
          <h1>组织运营</h1>
          <p>用于确认当前空间的权限边界、资源消耗、集成凭据和最近关键操作。</p>
        </div>
        <button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshOrg()}>
          {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新
        </button>
      </div>
      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshOrg()}>重试</button>
        </div>
      )}
      <div className="orgHero">
        <div className="orgHeroText">
          <span><Building2 size={18} /> 当前组织上下文</span>
          <h2>{props.session.tenantId} / {props.session.workspaceId}</h2>
          <p>这里不是业务配置入口，而是管理员看“谁在什么空间、用了多少、开放了哪些 Key、最近做了什么”的运营视图。</p>
        </div>
        <div className="orgHeroCards">
          <article><small>账号角色</small><strong>{roleLabel}</strong><p>{props.session.displayName || props.session.userId}</p></article>
          <article><small>可见空间</small><strong>{props.workspaces.length}</strong><p>{roleLabel === "管理员" ? "管理员可查看全部授权空间" : "成员仅查看授权空间"}</p></article>
          <article><small>活跃 Key</small><strong>{activeKeys}</strong><p>外部系统调用 Runtime API 的凭据</p></article>
        </div>
      </div>
      <div className="orgKpiGrid">
        <article><span>应用总数</span><strong>{usage?.applications ?? 0}</strong><p>已发布 {usage?.publishedApps ?? 0}</p></article>
        <article><span>知识资产</span><strong>{usage?.datasets ?? 0}</strong><p>文档 {usage?.documents ?? 0}</p></article>
        <article><span>运行次数</span><strong>{usage?.runs ?? 0}</strong><p>失败 {usage?.failedRuns ?? 0} · 等待 {usage?.waitingRuns ?? 0}</p></article>
        <article><span>等待任务</span><strong>{usage?.pendingWaitTasks ?? 0}</strong><p>待处理 / 总计 {usage?.waitTasks ?? 0}</p></article>
        <article><span>Token</span><strong>{usage?.totalTokens ?? 0}</strong><p>累计消耗</p></article>
        <article><span>平均耗时</span><strong>{usage?.averageLatencyMs ?? 0}ms</strong><p>端到端运行</p></article>
      </div>
      <div className="orgPanelGrid">
        <section className="designCard">
          <div className="sectionTitle">
            <ShieldCheck size={18} />
            <div><h2>空间与权限边界</h2><p>应用、知识库、模型供应商、Key 和运行记录都按 workspace 隔离。</p></div>
          </div>
          <EntityList className="scopeStack">
            {props.tenants.map((tenant) => (
              <EntityRow
                key={tenant.id}
                title={tenant.name}
                subtitle={`${tenant.code} · ${tenant.plan}`}
                status={tenant.status}
                statusTone="success"
                meta="Tenant"
              />
            ))}
            {props.workspaces.map((workspace) => (
              <EntityRow
                key={workspace.id}
                active={workspace.id === props.session.workspaceId}
                title={workspace.name || workspace.id}
                subtitle={workspace.tenantId}
                status={workspace.id === props.session.workspaceId ? "当前空间" : workspace.status}
                statusTone={workspace.status === "active" ? "success" : "cancelled"}
                meta="Workspace"
              />
            ))}
          </EntityList>
        </section>
        <section className="designCard">
          <div className="sectionTitle">
            <Code2 size={18} />
            <div><h2>API Key 与集成范围</h2><p>外部系统通过这些 Key 调用 Runtime API；明文只在创建时返回。</p></div>
          </div>
          <EntityList>
            {props.apiKeys.map((key) => (
              <EntityRow
                key={key.id}
                title={key.name}
                subtitle={`${key.keyPrefix}*** · ${key.appId ? "应用级" : "空间级"}`}
                status={key.status}
                statusTone={key.status === "active" ? "success" : "cancelled"}
                meta={key.appId || key.workspaceId || props.session.workspaceId}
              />
            ))}
            {!props.apiKeys.length && <StatePanel title="暂无 API Key" text="在 API Key 菜单创建 Key 后，会在这里看到 scope 和状态。" />}
          </EntityList>
        </section>
        <section className="designCard orgAuditCard">
          <div className="sectionTitle">
            <ClipboardCheck size={18} />
            <div><h2>最近审计事件</h2><p>追踪发布、Key 创建、知识索引等会影响运行的操作。</p></div>
          </div>
          <div className="auditTimeline">
            {props.auditEvents.map((event) => (
              <article key={`${event.type}-${event.id}`}>
                <span>{event.type}</span>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
                <small>{event.actor} · {event.target} · {formatDate(event.createdAt)}</small>
              </article>
            ))}
          </div>
          {!props.auditEvents.length && <StatePanel title="暂无审计事件" text="发布应用、创建 Key 或写入知识文档后会生成审计摘要。" />}
        </section>
      </div>
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
