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
    setBusyAction("api-key-create");
    setCreatedApiKey("");
    try {
      const key = await call<{ apiKey: string }>("/api/aio/admin/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          workspaceId,
        }),
      });
      setCreatedApiKey(key.apiKey);
      setRuntimeKey(key.apiKey);
      setFormOpen(false);
      setStatus("Workspace API Key 已创建，明文仅显示一次");
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

  return {
    apiKeys,
    loading,
    error,
    newName,
    createdApiKey,
    formOpen,
    busyAction,
    setNewName,
    openCreateForm: () => setFormOpen(true),
    closeForm: () => setFormOpen(false),
    refreshApiKeys,
    createApiKey,
    revokeApiKey,
  };
}
