import { AlertCircle, ClipboardCheck, Code2, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { ApiKeyRecord, AppRecord, AuthSession } from "../types";
import { ActionBar, CopyButton, Drawer, EntityList, EntityRow, Field, StatePanel } from "./ui";

export function ApiKeyPage(props: {
  apiKeys: ApiKeyRecord[];
  loading: boolean;
  error: string;
  session: AuthSession;
  apps: AppRecord[];
  runtimeKey: string;
  newName: string;
  scopeType: "workspace" | "app";
  selectedAppId: string;
  createdApiKey: string;
  formOpen: boolean;
  busyAction: string;
  setNewName: (value: string) => void;
  setRuntimeKey: (value: string) => void;
  setScopeType: (value: "workspace" | "app") => void;
  setSelectedAppId: (value: string) => void;
  openCreateForm: () => void;
  closeForm: () => void;
  refreshApiKeys: () => Promise<void>;
  createApiKey: () => Promise<void>;
  revokeApiKey: (key: ApiKeyRecord) => Promise<void>;
  deleteApiKey: (key: ApiKeyRecord) => Promise<void>;
}) {
  const activeKeys = props.apiKeys.filter((key) => key.status === "active").length;
  const runtimePrefix = props.runtimeKey ? props.runtimeKey.slice(0, 10) : "";
  const matchedRuntimeKey = runtimePrefix ? props.apiKeys.find((key) => key.keyPrefix === runtimePrefix) : undefined;
  return (
    <section className="workspacePane apiKeyPane">
      <div className="pageHeader">
        <div>
          <h1>API Key 管理</h1>
          <p>管理当前工作空间的 Runtime API 调用凭据、scope、状态和最近使用时间。</p>
        </div>
        <div className="headerActions">
          <button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshApiKeys()}>
            {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新
          </button>
          <button className="primaryBtn" onClick={props.openCreateForm}>
            <Plus size={16} /> 创建 Key
          </button>
        </div>
      </div>
      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshApiKeys()}>重试</button>
        </div>
      )}
      <section className="designCard apiKeySummary">
          <div className="sectionTitle">
            <Code2 size={18} />
            <div><h2>凭据概览</h2><p>外部系统通过 Bearer Key 调用 `/v1/**`。</p></div>
          </div>
          <div className="orgKpiGrid compact">
            <article><span>全部 Key</span><strong>{props.apiKeys.length}</strong><p>当前可见范围</p></article>
            <article><span>Active</span><strong>{activeKeys}</strong><p>可继续调用</p></article>
            <article><span>体验 Key</span><strong>{runtimePrefix || "未设置"}</strong><p>{matchedRuntimeKey ? `${matchedRuntimeKey.name} · ${matchedRuntimeKey.status}` : "创建成功后自动填入"}</p></article>
          </div>
          <div className="runtimeKeyEditor">
            <Field label="当前体验 Key 明文">
              <input type="password" value={props.runtimeKey} onChange={(event) => props.setRuntimeKey(event.target.value)} placeholder="sk_..." />
            </Field>
            {props.runtimeKey && <CopyButton text={props.runtimeKey} />}
            <p className="mutedText">Key 列表只显示前缀，不能用于调用；体验页会使用这里的完整 Bearer Key。</p>
          </div>
      </section>
      <section className="designCard">
        <div className="sectionTitle">
          <ClipboardCheck size={18} />
          <div><h2>Key 列表</h2><p>查看前缀、scope、最后调用时间，并吊销不再使用的 Key。</p></div>
        </div>
        <EntityList>
          {props.apiKeys.map((key) => (
            <EntityRow
              key={key.id}
              title={key.name}
              subtitle={`${key.keyPrefix}*** · ${key.appId ? "应用级" : "空间级"} · ${key.id}`}
              status={key.status}
              statusTone={key.status === "active" ? "success" : "cancelled"}
              meta={`${key.appId ? `仅 ${key.appId}` : `空间 ${key.workspaceId || props.session.workspaceId}`} · last used: ${formatDate(key.lastUsedAt)}`}
              actions={
                <>
                  <CopyButton text={key.keyPrefix} />
                  {key.status === "active" ? (
                    <button className="dangerTextBtn" disabled={props.busyAction === `api-key-revoke-${key.id}`} onClick={() => void props.revokeApiKey(key)}>
                      {props.busyAction === `api-key-revoke-${key.id}` ? <Loader2 className="spin" size={14} /> : <X size={14} />} 吊销
                    </button>
                  ) : (
                    <button className="dangerTextBtn" disabled={props.busyAction === `api-key-delete-${key.id}`} onClick={() => void props.deleteApiKey(key)}>
                      {props.busyAction === `api-key-delete-${key.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} 删除
                    </button>
                  )}
                </>
              }
            />
          ))}
        </EntityList>
        {!props.apiKeys.length && !props.loading && <StatePanel title="暂无 API Key" text="创建一个 workspace key 后，外部系统即可调用 Runtime API。" />}
      </section>
      <Drawer
        open={props.formOpen}
        title="创建 Runtime API Key"
        description="选择 Key 的可访问范围。明文只显示一次，创建成功后会自动设为体验 Key。"
        onClose={props.closeForm}
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>{props.createdApiKey ? "完成" : "取消"}</button>
            {!props.createdApiKey && (
              <button className="primaryBtn" disabled={props.busyAction === "api-key-create"} onClick={() => void props.createApiKey()}>
                {props.busyAction === "api-key-create" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} 创建
              </button>
            )}
          </ActionBar>
        }
      >
        {props.createdApiKey ? (
          <div className="keyCreatedPanel">
            <div className="keySecretBox">
              <strong>新 Key</strong>
              <code>{props.createdApiKey}</code>
              <CopyButton text={props.createdApiKey} />
            </div>
            <p className="mutedText">明文只显示这一次。关闭侧边栏后，只能看到 Key 前缀和状态。</p>
          </div>
        ) : (
          <>
            <Field label="Key 名称">
              <input value={props.newName} onChange={(event) => props.setNewName(event.target.value)} placeholder="例如 Production Runtime Key" autoFocus />
            </Field>
            <div className="radioGrid compact">
              <label className={`radioCard ${props.scopeType === "workspace" ? "active" : ""}`}>
                <input type="radio" name="api-key-scope" checked={props.scopeType === "workspace"} onChange={() => props.setScopeType("workspace")} />
                <span><strong>Workspace Key</strong><small>可访问当前工作空间下全部已发布应用。</small></span>
              </label>
              <label className={`radioCard ${props.scopeType === "app" ? "active" : ""}`}>
                <input type="radio" name="api-key-scope" checked={props.scopeType === "app"} onChange={() => props.setScopeType("app")} />
                <span><strong>App Key</strong><small>只允许访问一个指定应用。</small></span>
              </label>
            </div>
            {props.scopeType === "app" && (
              <Field label="允许访问的应用">
                <select value={props.selectedAppId} onChange={(event) => props.setSelectedAppId(event.target.value)}>
                  <option value="">请选择应用</option>
                  {props.apps.map((app) => <option key={app.id} value={app.id}>{app.name} · {app.type} · {app.id}</option>)}
                </select>
              </Field>
            )}
            <p className="mutedText">Tenant：{props.session.tenantId} / Workspace：{props.session.workspaceId}</p>
          </>
        )}
      </Drawer>
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
