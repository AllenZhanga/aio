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

  async function refreshOrg() {
    setLoading(true);
    setError("");
    try {
      const [nextTenants, nextWorkspaces, nextKeys, nextUsage, nextAudit] =
        await Promise.all([
          call<TenantRecord[]>("/api/aio/admin/tenants"),
          call<WorkspaceRecord[]>("/api/aio/admin/workspaces"),
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

  return {
    tenants,
    workspaces,
    apiKeys,
    usage,
    auditEvents,
    loading,
    error,
    refreshOrg,
    refreshWorkspaceOptions,
  };
}
