import { useState } from "react";
import type {
  ApiKeyRecord,
  AuditEvent,
  TenantRecord,
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
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState<"tenant" | "workspace" | "">("");
  const [busyAction, setBusyAction] = useState("");
  const [newTenantName, setNewTenantName] = useState("企业租户");
  const [newTenantCode, setNewTenantCode] = useState("enterprise");
  const [newTenantPlan, setNewTenantPlan] = useState("private");
  const [workspaceTenantId, setWorkspaceTenantId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("默认空间");

  async function refreshOrg() {
    setLoading(true);
    setError("");
    try {
      const [nextTenants, nextWorkspaces, nextKeys, nextUsage, nextAudit] =
        await Promise.all([
          call<TenantRecord[]>("/api/aio/admin/tenants"),
          call<WorkspaceRecord[]>("/api/aio/admin/workspaces?scope=all"),
          call<ApiKeyRecord[]>("/api/aio/admin/api-keys"),
          call<UsageSummary>("/api/aio/admin/usage-summary"),
          call<AuditEvent[]>("/api/aio/admin/audit-events"),
        ]);
      setTenants(nextTenants);
      setWorkspaces(nextWorkspaces);
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

  return {
    tenants,
    workspaces,
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
    setNewTenantName,
    setNewTenantCode,
    setNewTenantPlan,
    setWorkspaceTenantId,
    setNewWorkspaceName,
    openTenantForm,
    openWorkspaceForm,
    closeForm,
    createTenant,
    createWorkspace,
    refreshOrg,
    refreshWorkspaceOptions,
  };
}
