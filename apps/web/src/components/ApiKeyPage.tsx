import { AlertCircle, ClipboardCheck, Code2, Loader2, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { ApiKeyRecord, AuthSession } from "../types";
import { ActionBar, CopyButton, Drawer, EntityList, EntityRow, Field, StatePanel } from "./ui";

export function ApiKeyPage(props: {
  apiKeys: ApiKeyRecord[];
  loading: boolean;
  error: string;
  session: AuthSession;
  newName: string;
  createdApiKey: string;
  formOpen: boolean;
  busyAction: string;
  setNewName: (value: string) => void;
  openCreateForm: () => void;
  closeForm: () => void;
  refreshApiKeys: () => Promise<void>;
  createApiKey: () => Promise<void>;
  revokeApiKey: (key: ApiKeyRecord) => Promise<void>;
}) {
  const activeKeys = props.apiKeys.filter((key) => key.status === "active").length;
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
      <div className="apiKeyGrid">
        <section className="designCard">
          <div className="sectionTitle">
            <ShieldCheck size={18} />
            <div><h2>创建结果</h2><p>明文只在创建后显示一次，后续只能吊销后重建。</p></div>
          </div>
          {props.createdApiKey && (
            <div className="keySecretBox">
              <strong>新 Key</strong>
              <code>{props.createdApiKey}</code>
              <CopyButton text={props.createdApiKey} />
            </div>
          )}
          {!props.createdApiKey && <StatePanel title="暂无新 Key" text="点击右上角创建 Key，生成后的明文会在这里显示一次。" />}
        </section>
        <section className="designCard apiKeySummary">
          <div className="sectionTitle">
            <Code2 size={18} />
            <div><h2>凭据概览</h2><p>外部系统通过 Bearer Key 调用 `/v1/**`。</p></div>
          </div>
          <div className="orgKpiGrid compact">
            <article><span>全部 Key</span><strong>{props.apiKeys.length}</strong><p>当前可见范围</p></article>
            <article><span>Active</span><strong>{activeKeys}</strong><p>可继续调用</p></article>
            <article><span>Revoked</span><strong>{props.apiKeys.filter((key) => key.status !== "active").length}</strong><p>已停用</p></article>
          </div>
        </section>
      </div>
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
              meta={`${key.appId || key.workspaceId || props.session.workspaceId} · last used: ${formatDate(key.lastUsedAt)}`}
              actions={
                <button className="dangerTextBtn" disabled={key.status !== "active" || props.busyAction === `api-key-revoke-${key.id}`} onClick={() => void props.revokeApiKey(key)}>
                  {props.busyAction === `api-key-revoke-${key.id}` ? <Loader2 className="spin" size={14} /> : <X size={14} />} 吊销
                </button>
              }
            />
          ))}
        </EntityList>
        {!props.apiKeys.length && !props.loading && <StatePanel title="暂无 API Key" text="创建一个 workspace key 后，外部系统即可调用 Runtime API。" />}
      </section>
      <Drawer
        open={props.formOpen}
        title="创建 Workspace Key"
        description="新 Key 明文只显示一次，请创建后立即保存到调用方系统。"
        onClose={props.closeForm}
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>取消</button>
            <button className="primaryBtn" disabled={props.busyAction === "api-key-create"} onClick={() => void props.createApiKey()}>
              {props.busyAction === "api-key-create" ? <Loader2 className="spin" size={16} /> : <Plus size={16} />} 创建
            </button>
          </ActionBar>
        }
      >
        <Field label="Key 名称">
          <input value={props.newName} onChange={(event) => props.setNewName(event.target.value)} placeholder="例如 Production Runtime Key" autoFocus />
        </Field>
        <p className="mutedText">Scope：{props.session.tenantId} / {props.session.workspaceId}</p>
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
