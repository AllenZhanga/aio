import { useState } from "react";
import type { ApiKeyRecord } from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

export function useApiKeyPage({
  call,
  setRuntimeKey,
  setStatus,
  workspaceId,
}: {
  call: ConsoleCall;
  setRuntimeKey: (value: string) => void;
  setStatus: (value: string) => void;
  workspaceId: string;
}) {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("Workspace Runtime Key");
  const [scopeType, setScopeType] = useState<"workspace" | "app">("workspace");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [createdApiKey, setCreatedApiKey] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  async function refreshApiKeys() {
    setLoading(true);
    setError("");
    try {
      const nextKeys = await call<ApiKeyRecord[]>("/api/aio/admin/api-keys");
      setApiKeys(nextKeys);
      setStatus("API Key 已同步");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "API Key 加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function createApiKey() {
    if (!newName.trim()) {
      setStatus("请先填写 Key 名称");
      return;
    }
    if (scopeType === "app" && !selectedAppId) {
      setStatus("请选择该 Key 允许访问的应用");
      return;
    }
    setBusyAction("api-key-create");
    setCreatedApiKey("");
    try {
      const key = await call<{ apiKey: string }>("/api/aio/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          workspaceId,
          appId: scopeType === "app" ? selectedAppId : undefined,
        }),
      });
      setCreatedApiKey(key.apiKey);
      setRuntimeKey(key.apiKey);
      setStatus(scopeType === "app" ? "App API Key 已创建，已设为体验 Key" : "Workspace API Key 已创建，已设为体验 Key");
      await refreshApiKeys();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "API Key 创建失败");
    } finally {
      setBusyAction("");
    }
  }

  async function revokeApiKey(key: ApiKeyRecord) {
    if (
      !window.confirm(
        `确认吊销 API Key「${key.name}」？吊销后外部调用会立即失效。`,
      )
    ) {
      return;
    }
    setBusyAction(`api-key-revoke-${key.id}`);
    try {
      await call(`/api/aio/admin/api-keys/${key.id}/revoke`, {
        method: "POST",
      });
      setStatus(`已吊销 ${key.name}`);
      await refreshApiKeys();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "API Key 吊销失败");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteApiKey(key: ApiKeyRecord) {
    if (key.status === "active") {
      setStatus("请先吊销 API Key，再删除记录");
      return;
    }
    if (!window.confirm(`确认删除已吊销的 API Key「${key.name}」？删除后列表中不再展示该记录。`)) {
      return;
    }
    setBusyAction(`api-key-delete-${key.id}`);
    try {
      await call(`/api/aio/admin/api-keys/${key.id}`, { method: "DELETE" });
      setStatus(`已删除 ${key.name}`);
      await refreshApiKeys();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "API Key 删除失败");
    } finally {
      setBusyAction("");
    }
  }

  return {
    apiKeys,
    loading,
    error,
    newName,
    scopeType,
    selectedAppId,
    createdApiKey,
    formOpen,
    busyAction,
    setNewName,
    setScopeType,
    setSelectedAppId,
    openCreateForm: () => {
      setCreatedApiKey("");
      setScopeType("workspace");
      setSelectedAppId("");
      setFormOpen(true);
    },
    closeForm: () => setFormOpen(false),
    refreshApiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
  };
}
