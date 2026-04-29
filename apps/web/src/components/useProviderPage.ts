import { useState } from "react";
import type { ProviderForm, ProviderRecord } from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

const dashScopeProviderForm: ProviderForm = {
  name: "阿里云 DashScope",
  providerType: "dashscope",
  baseUrl:
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
  apiKey: "",
  defaultChatModel: "deepseek-v4-pro",
  defaultEmbeddingModel: "text-embedding-v4",
  configJson: "{}",
  llmBaseUrl:
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
  llmApiKey: "",
  llmModel: "deepseek-v4-pro",
  llmConfigJson: JSON.stringify(
    {
      protocol: "dashscope_generation",
      parameters: {
        enable_thinking: true,
        incremental_output: false,
        result_format: "message",
      },
    },
    null,
    2,
  ),
  embeddingBaseUrl:
    "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
  embeddingApiKey: "",
  embeddingModel: "text-embedding-v4",
  embeddingConfigJson: JSON.stringify(
    { dimensions: 1024, encoding_format: "float" },
    null,
    2,
  ),
  rerankBaseUrl: "",
  rerankApiKey: "",
  rerankModel: "",
  rerankConfigJson: "{}",
};

export function useProviderPage({
  call,
  setStatus,
  workspaceId,
}: {
  call: ConsoleCall;
  setStatus: (value: string) => void;
  workspaceId: string;
}) {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProviderForm>(dashScopeProviderForm);
  const [editingProviderId, setEditingProviderId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [busyAction, setBusyAction] = useState("");

  async function refreshProviders() {
    setLoading(true);
    setError("");
    try {
      const nextProviders = await call<ProviderRecord[]>(
        "/api/aio/admin/providers",
      );
      setProviders(nextProviders);
      setStatus("模型供应商已同步");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "模型供应商加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function createProvider() {
    setBusyAction("provider-create");
    try {
      await call<ProviderRecord>(
        editingProviderId
          ? `/api/aio/admin/providers/${editingProviderId}`
          : "/api/aio/admin/providers",
        {
          method: editingProviderId ? "PUT" : "POST",
          body: JSON.stringify({
            ...form,
            workspaceId,
            apiKey: form.apiKey || undefined,
          }),
        },
      );
      setForm((current) => ({
        ...current,
        apiKey: "",
        llmApiKey: "",
        embeddingApiKey: "",
        rerankApiKey: "",
      }));
      setEditingProviderId("");
      setFormOpen(false);
      setStatus(editingProviderId ? "模型供应商已更新" : "模型供应商已保存");
      await refreshProviders();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "模型供应商保存失败");
    } finally {
      setBusyAction("");
    }
  }

  function editProvider(provider: ProviderRecord) {
    setEditingProviderId(provider.id);
    setFormOpen(true);
    setForm({
      name: provider.name,
      providerType: provider.providerType,
      baseUrl: provider.baseUrl || provider.llmBaseUrl || "",
      apiKey: "",
      defaultChatModel: provider.defaultChatModel || provider.llmModel || "",
      defaultEmbeddingModel:
        provider.defaultEmbeddingModel || provider.embeddingModel || "",
      configJson: provider.configJson || "{}",
      llmBaseUrl: provider.llmBaseUrl || provider.baseUrl || "",
      llmApiKey: "",
      llmModel: provider.llmModel || provider.defaultChatModel || "",
      llmConfigJson: provider.llmConfigJson || "{}",
      embeddingBaseUrl: provider.embeddingBaseUrl || "",
      embeddingApiKey: "",
      embeddingModel:
        provider.embeddingModel || provider.defaultEmbeddingModel || "",
      embeddingConfigJson: provider.embeddingConfigJson || "{}",
      rerankBaseUrl: provider.rerankBaseUrl || "",
      rerankApiKey: "",
      rerankModel: provider.rerankModel || "",
      rerankConfigJson: provider.rerankConfigJson || "{}",
    });
  }

  function resetForm() {
    setEditingProviderId("");
    setForm(dashScopeProviderForm);
  }

  function openCreateForm() {
    setEditingProviderId("");
    setForm(dashScopeProviderForm);
    setFormOpen(true);
  }

  async function deleteProvider(provider: ProviderRecord) {
    if (
      !window.confirm(
        `确认永久删除模型供应商「${provider.name}」？已发布应用如果仍引用该供应商，运行时会失败。`,
      )
    ) {
      return;
    }
    setBusyAction(`provider-delete-${provider.id}`);
    try {
      await call(`/api/aio/admin/providers/${provider.id}`, { method: "DELETE" });
      if (editingProviderId === provider.id) {
        resetForm();
        setFormOpen(false);
      }
      setStatus(`已删除 ${provider.name}`);
      await refreshProviders();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "供应商删除失败");
    } finally {
      setBusyAction("");
    }
  }

  async function testProvider(provider: ProviderRecord) {
    setBusyAction(`provider-test-${provider.id}`);
    try {
      const result = await call<Record<string, unknown>>(
        `/api/aio/admin/providers/${provider.id}/test`,
        { method: "POST" },
      );
      setStatus(
        `供应商测试完成：${String(result.status || result.message || "ok")}`,
      );
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "供应商测试失败");
    } finally {
      setBusyAction("");
    }
  }

  async function disableProvider(provider: ProviderRecord) {
    if (!window.confirm(`确认禁用模型供应商「${provider.name}」？`)) return;
    setBusyAction(`provider-disable-${provider.id}`);
    try {
      await call<ProviderRecord>(
        `/api/aio/admin/providers/${provider.id}/disable`,
        { method: "POST" },
      );
      setStatus(`已禁用 ${provider.name}`);
      await refreshProviders();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "供应商禁用失败");
    } finally {
      setBusyAction("");
    }
  }

  return {
    providers,
    loading,
    error,
    form,
    busyAction,
    editingProviderId,
    formOpen,
    setForm,
    openCreateForm,
    closeForm: () => setFormOpen(false),
    resetForm,
    refreshProviders,
    createProvider,
    editProvider,
    testProvider,
    disableProvider,
    deleteProvider,
  };
}
