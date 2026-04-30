import { AlertCircle, Bot, Boxes, Building2, Database, KeyRound, Loader2, PanelLeftClose, PanelLeftOpen, Play, Plus, Settings2, ShieldCheck, Sparkles, UserCheck, X } from "lucide-react";
import type { AuthSession, CenterView, WorkspaceRecord } from "../types";
import { Field } from "./ui";

export function LoginPage(props: {
  username: string;
  password: string;
  error: string;
  loggingIn: boolean;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  login: () => Promise<void>;
}) {
  return (
    <main className="loginShell">
      <section className="loginCard">
        <div className="loginBrand">
          <div className="logoGem">A</div>
          <div>
            <strong>Aio Console</strong>
            <span>私有化部署 · 控制台登录</span>
          </div>
        </div>
        <h1>登录管理控制台</h1>
        <p>请输入管理员账号和密码。</p>
        {props.error && (
          <div className="errorBanner">
            <AlertCircle size={16} />
            <span>{props.error}</span>
          </div>
        )}
        <Field label="用户名">
          <input
            value={props.username}
            onChange={(event) => props.setUsername(event.target.value)}
            placeholder="用户名"
            autoFocus
          />
        </Field>
        <Field label="密码">
          <input
            type="password"
            value={props.password}
            onChange={(event) => props.setPassword(event.target.value)}
            placeholder="请输入控制台密码"
            onKeyDown={(event) => {
              if (event.key === "Enter") void props.login();
            }}
          />
        </Field>
        <button
          className="primaryBtn loginBtn"
          disabled={props.loggingIn}
          onClick={() => void props.login()}
        >
          {props.loggingIn ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <ShieldCheck size={16} />
          )} 登录
        </button>
      </section>
    </main>
  );
}

export function TopNav({
  status,
  session,
  workspaces,
  menuOpen,
  settingsOpen,
  switching,
  setMenuOpen,
  setSettingsOpen,
  switchWorkspace,
  openProviders,
  logout,
}: {
  status: string;
  session: AuthSession;
  workspaces: WorkspaceRecord[];
  menuOpen: boolean;
  settingsOpen: boolean;
  switching: boolean;
  setMenuOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  openProviders: () => void;
  logout: () => void;
}) {
  const displayName = session.displayName || session.userId;
  const roleLabel = session.role === "admin" || (!session.role && session.userId === "admin") ? "管理员" : "成员";
  const options = workspaces.some((workspace) => workspace.id === session.workspaceId)
    ? workspaces
    : [{ id: session.workspaceId, tenantId: session.tenantId, name: session.workspaceId, status: "active" }, ...workspaces];

  return (
    <header className="topNav">
      <div className="logoGroup">
        <div className="logoGem">A</div>
        <strong>Aio</strong>
      </div>
      <div className="statusDot">
        <Sparkles size={14} />
        <span>{status}</span>
      </div>
      <div className="topActions">
        <div className="settingsWrap">
          <button
            className="settingsBtn"
            title="系统设置"
            onClick={() => {
              setSettingsOpen(!settingsOpen);
              setMenuOpen(false);
            }}
          >
            <Settings2 size={17} />
          </button>
          {settingsOpen && (
            <div className="settingsMenu">
              <strong>系统设置</strong>
              <button
                onClick={() => {
                  setSettingsOpen(false);
                  openProviders();
                }}
              >
                <Bot size={16} />
                <span>
                  <b>模型供应商</b>
                  <small>配置 LLM 网关、模型和 API Key</small>
                </span>
              </button>
            </div>
          )}
        </div>
        <div className="avatarWrap">
          <button
            className="avatar"
            title="账号菜单"
            onClick={() => {
              setMenuOpen(!menuOpen);
              setSettingsOpen(false);
            }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </button>
          {menuOpen && (
            <div className="avatarMenu">
              <strong>基本信息</strong>
              <dl>
                <dt>账号</dt><dd>{session.userId}</dd>
                <dt>名称</dt><dd>{displayName}</dd>
                <dt>角色</dt><dd>{roleLabel}</dd>
                <dt>租户</dt><dd>{session.tenantId}</dd>
                <dt>工作空间</dt><dd>{session.workspaceId}</dd>
              </dl>
              <label className="menuField">
                <span>切换工作空间</span>
                <select
                  value={session.workspaceId}
                  disabled={switching || options.length <= 1}
                  onChange={(event) => void switchWorkspace(event.target.value)}
                >
                  {options.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name || workspace.id} · {workspace.id}
                    </option>
                  ))}
                </select>
              </label>
              <button className="dangerTextBtn" onClick={logout}>
                <X size={14} /> 退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function SideNav({
  activeView,
  session,
  collapsed,
  onCreate,
  onToggleCollapsed,
  openApps,
  openObservability,
  openTasks,
  openKnowledge,
  openProviders,
  openApiKeys,
  openOrg,
}: {
  activeView: CenterView;
  session: AuthSession;
  collapsed: boolean;
  onCreate: () => void;
  onToggleCollapsed: () => void;
  openApps: () => void;
  openObservability: () => void;
  openTasks: () => void;
  openKnowledge: () => void;
  openProviders: () => void;
  openApiKeys: () => void;
  openOrg: () => void;
}) {
  const appActive = activeView === "center" || activeView === "designer" || activeView === "experience" || activeView === "api";
  return (
    <aside className={`sideNav ${collapsed ? "collapsed" : ""}`} aria-label="主菜单">
      <div className="sideNavTools">
        <button className="createBtn" onClick={onCreate} title="创建应用"><Plus size={17} /> <span>创建应用</span></button>
        <button className="iconBtn sideCollapseBtn" onClick={onToggleCollapsed} title={collapsed ? "展开菜单" : "隐藏菜单"} aria-label={collapsed ? "展开菜单" : "隐藏菜单"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <p className="sideSectionLabel">构建</p>
      <button className={`sideItem ${appActive ? "active" : ""}`} onClick={openApps} title="应用"><Boxes size={18} /> <span>应用</span></button>
      <button className={`sideItem ${activeView === "knowledge" ? "active" : ""}`} onClick={openKnowledge} title="知识库"><Database size={18} /> <span>知识库</span></button>
      <p className="sideSectionLabel">运行</p>
      <button className={`sideItem ${activeView === "observability" ? "active" : ""}`} onClick={openObservability} title="运行记录"><Play size={18} /> <span>运行记录</span></button>
      <button className={`sideItem ${activeView === "tasks" ? "active" : ""}`} onClick={openTasks} title="人工任务"><UserCheck size={18} /> <span>人工任务</span></button>
      <p className="sideSectionLabel">集成配置</p>
      <button className={`sideItem ${activeView === "providers" ? "active" : ""}`} onClick={openProviders} title="模型供应商"><Bot size={18} /> <span>模型供应商</span></button>
      <button className={`sideItem ${activeView === "apiKeys" ? "active" : ""}`} onClick={openApiKeys} title="API Key"><KeyRound size={18} /> <span>API Key</span></button>
      <p className="sideSectionLabel">组织</p>
      <button className={`sideItem ${activeView === "org" ? "active" : ""}`} onClick={openOrg} title="组织设置"><Building2 size={18} /> <span>组织设置</span></button>
      <p className="sideGroup">当前空间：{session.workspaceId}<br />账号：{session.displayName || session.userId}</p>
    </aside>
  );
}
