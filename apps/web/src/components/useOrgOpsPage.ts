import { useState } from "react";
import type {
  ApiKeyRecord,
  AuditEvent,
  TenantRecord,
  UserRecord,
  UsageSummary,
  WorkspaceRecord,
} from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

export function useOrgOpsPage({
  call,
  setStatus,
}: {
  call: ConsoleCall;
  setStatus: (value: string) => void;
}) {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState<"tenant" | "workspace" | "user" | "">("");
  const [busyAction, setBusyAction] = useState("");
  const [newTenantName, setNewTenantName] = useState("企业租户");
  const [newTenantCode, setNewTenantCode] = useState("enterprise");
  const [newTenantPlan, setNewTenantPlan] = useState("private");
  const [workspaceTenantId, setWorkspaceTenantId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("默认空间");
  const [userTenantId, setUserTenantId] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("member");
  const [selectedUserWorkspaceIds, setSelectedUserWorkspaceIds] = useState<string[]>([]);

  async function refreshOrg() {
    setLoading(true);
    setError("");
    try {
      const [nextTenants, nextWorkspaces, nextUsers, nextKeys, nextUsage, nextAudit] =
        await Promise.all([
          call<TenantRecord[]>("/api/aio/admin/tenants"),
          call<WorkspaceRecord[]>("/api/aio/admin/workspaces?scope=all"),
          call<UserRecord[]>("/api/aio/admin/users?scope=all"),
          call<ApiKeyRecord[]>("/api/aio/admin/api-keys"),
          call<UsageSummary>("/api/aio/admin/usage-summary"),
          call<AuditEvent[]>("/api/aio/admin/audit-events"),
        ]);
      setTenants(nextTenants);
      setWorkspaces(nextWorkspaces);
      setUsers(nextUsers);
      setApiKeys(nextKeys);
      setUsage(nextUsage);
      setAuditEvents(nextAudit);
      setStatus("组织、用量与审计已同步");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "组织运营数据加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshWorkspaceOptions() {
    try {
      const nextWorkspaces = await call<WorkspaceRecord[]>(
        "/api/aio/admin/workspaces",
      );
      setWorkspaces(nextWorkspaces);
    } catch {
      setWorkspaces([]);
    }
  }

  function openTenantForm() {
    setFormOpen("tenant");
  }

  function openWorkspaceForm(tenantId?: string) {
    setWorkspaceTenantId(tenantId || tenants[0]?.id || "");
    setFormOpen("workspace");
  }

  function openUserForm(tenantId?: string) {
    const targetTenantId = tenantId || tenants[0]?.id || "";
    selectUserTenant(targetTenantId);
    setNewUserEmail("");
    setNewUserName("");
    setNewUserPassword("");
    setNewUserRole("member");
    setFormOpen("user");
  }

  function selectUserTenant(tenantId: string) {
    setUserTenantId(tenantId);
    setSelectedUserWorkspaceIds(workspaces.filter((workspace) => workspace.tenantId === tenantId).slice(0, 1).map((workspace) => workspace.id));
  }

  function closeForm() {
    setFormOpen("");
  }

  async function createTenant() {
    if (!newTenantName.trim() || !newTenantCode.trim()) {
      setStatus("请填写租户名称和租户编码");
      return;
    }
    setBusyAction("tenant-create");
    try {
      const tenant = await call<TenantRecord>("/api/aio/admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: newTenantName.trim(),
          code: newTenantCode.trim(),
          plan: newTenantPlan.trim() || "private",
        }),
      });
      setWorkspaceTenantId(tenant.id);
      setStatus(`已创建租户 ${tenant.name}`);
      closeForm();
      await refreshOrg();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "租户创建失败");
    } finally {
      setBusyAction("");
    }
  }

  async function createWorkspace() {
    if (!workspaceTenantId || !newWorkspaceName.trim()) {
      setStatus("请选择租户并填写空间名称");
      return;
    }
    setBusyAction("workspace-create");
    try {
      const workspace = await call<WorkspaceRecord>("/api/aio/admin/workspaces", {
        method: "POST",
        body: JSON.stringify({
          tenantId: workspaceTenantId,
          name: newWorkspaceName.trim(),
        }),
      });
      setStatus(`已创建空间 ${workspace.name}`);
      closeForm();
      await refreshOrg();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "空间创建失败");
    } finally {
      setBusyAction("");
    }
  }

  function toggleUserWorkspace(workspaceId: string) {
    setSelectedUserWorkspaceIds((current) => current.includes(workspaceId)
      ? current.filter((item) => item !== workspaceId)
      : [...current, workspaceId]);
  }

  async function createUser() {
    if (!userTenantId || !newUserEmail.trim() || !newUserPassword.trim() || selectedUserWorkspaceIds.length === 0) {
      setStatus("请选择租户、空间，并填写邮箱和密码");
      return;
    }
    setBusyAction("user-create");
    try {
      const user = await call<UserRecord>("/api/aio/admin/users", {
        method: "POST",
        body: JSON.stringify({
          tenantId: userTenantId,
          email: newUserEmail.trim(),
          displayName: newUserName.trim() || newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
          workspaceIds: selectedUserWorkspaceIds,
        }),
      });
      setStatus(`已创建用户 ${user.displayName}`);
      closeForm();
      await refreshOrg();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "用户创建失败");
    } finally {
      setBusyAction("");
    }
  }

  return {
    tenants,
    workspaces,
    users,
    apiKeys,
    usage,
    auditEvents,
    loading,
    error,
    formOpen,
    busyAction,
    newTenantName,
    newTenantCode,
    newTenantPlan,
    workspaceTenantId,
    newWorkspaceName,
    userTenantId,
    newUserEmail,
    newUserName,
    newUserPassword,
    newUserRole,
    selectedUserWorkspaceIds,
    setNewTenantName,
    setNewTenantCode,
    setNewTenantPlan,
    setWorkspaceTenantId,
    setNewWorkspaceName,
    setUserTenantId: selectUserTenant,
    setNewUserEmail,
    setNewUserName,
    setNewUserPassword,
    setNewUserRole,
    openTenantForm,
    openWorkspaceForm,
    openUserForm,
    closeForm,
    createTenant,
    createWorkspace,
    createUser,
    toggleUserWorkspace,
    refreshOrg,
    refreshWorkspaceOptions,
  };
}
