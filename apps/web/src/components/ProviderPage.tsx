import {
  AlertCircle,
  Bot,
  Edit3,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type { ProviderForm, ProviderRecord } from "../types";
import { ActionBar, Drawer, EntityList, EntityRow, Field, FormSection, StatePanel } from "./ui";

const dashScopePreset: ProviderForm = {
  name: "阿里云 DashScope",
  providerType: "dashscope",
  baseUrl: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
  apiKey: "",
  defaultChatModel: "deepseek-v4-pro",
  defaultEmbeddingModel: "text-embedding-v4",
  configJson: "{}",
  llmBaseUrl: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
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
  embeddingBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
  embeddingApiKey: "",
  embeddingModel: "text-embedding-v4",
  embeddingConfigJson: JSON.stringify({ dimensions: 1024, encoding_format: "float" }, null, 2),
  rerankBaseUrl: "",
  rerankApiKey: "",
  rerankModel: "",
  rerankConfigJson: "{}",
};

const openAiCompatiblePreset: ProviderForm = {
  name: "OpenAI Compatible",
  providerType: "openai_compatible",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  defaultChatModel: "gpt-4o-mini",
  defaultEmbeddingModel: "text-embedding-3-small",
  configJson: "{}",
  llmBaseUrl: "https://api.openai.com/v1",
  llmApiKey: "",
  llmModel: "gpt-4o-mini",
  llmConfigJson: "{}",
  embeddingBaseUrl: "https://api.openai.com/v1/embeddings",
  embeddingApiKey: "",
  embeddingModel: "text-embedding-3-small",
  embeddingConfigJson: "{}",
  rerankBaseUrl: "",
  rerankApiKey: "",
  rerankModel: "",
  rerankConfigJson: "{}",
};

export function ProviderPage(props: {
  providers: ProviderRecord[];
  loading: boolean;
  error: string;
  form: ProviderForm;
  busyAction: string;
  editingProviderId: string;
  formOpen: boolean;
  setForm: (form: ProviderForm) => void;
  openCreateForm: () => void;
  closeForm: () => void;
  resetForm: () => void;
  refreshProviders: () => Promise<void>;
  createProvider: () => Promise<void>;
  editProvider: (provider: ProviderRecord) => void;
  testProvider: (provider: ProviderRecord) => Promise<void>;
  disableProvider: (provider: ProviderRecord) => Promise<void>;
  deleteProvider: (provider: ProviderRecord) => Promise<void>;
}) {
  const activeCount = props.providers.filter((provider) => provider.status === "active").length;
  const selectedProvider = props.providers.find((provider) => provider.id === props.editingProviderId);
  const isEditing = !!props.editingProviderId;
  const providerTypes = ["dashscope", "openai_compatible", "openai", "azure_openai", "deepseek", "ollama", "custom"];

  function applyPreset(preset: ProviderForm) {
    props.setForm({ ...preset, apiKey: props.form.apiKey });
  }

  function syncSharedApiKey(value: string) {
    props.setForm({
      ...props.form,
      apiKey: value,
      llmApiKey: value,
      embeddingApiKey: value,
      rerankApiKey: value,
    });
  }

  return (
    <section className="workspacePane opsPane">
      <div className="pageHeader">
        <div>
          <h1>模型供应商</h1>
          <p>按 LLM、Embedding、Rerank 分别配置真实 API 地址、模型、密钥和请求参数。</p>
        </div>
        <div className="headerActions">
          <button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshProviders()}>
            {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新
          </button>
          <button className="primaryBtn" onClick={props.openCreateForm}>
            <Plus size={16} /> 新增供应商
          </button>
        </div>
      </div>

      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshProviders()}>重试</button>
        </div>
      )}

      <div className="runStats">
        <article><span>供应商</span><strong>{props.providers.length}</strong><p>当前空间</p></article>
        <article><span>Active</span><strong>{activeCount}</strong><p>可用于运行</p></article>
        <article><span>LLM 模型</span><strong>{props.providers.filter((item) => item.llmModel || item.defaultChatModel).length}</strong><p>Agent 下拉来源</p></article>
        <article><span>Embedding</span><strong>{props.providers.filter((item) => item.embeddingModel || item.defaultEmbeddingModel).length}</strong><p>知识索引能力</p></article>
        <article><span>配置方式</span><strong>分能力</strong><p>独立 endpoint / key</p></article>
      </div>

      <section className="designCard providerAccountsCard">
        <div className="sectionTitle">
          <Bot size={18} />
          <div>
            <h2>供应商账号</h2>
            <p>编辑已有账号时，密钥留空表示继续使用后端已保存的密文。</p>
          </div>
        </div>
        {props.loading && <StatePanel icon="loading" title="正在同步供应商" text="正在读取当前空间的模型供应商账号。" />}
        {!props.loading && !props.providers.length && <StatePanel title="暂无模型供应商" text="点击右上角新增供应商，用 DashScope 预设快速创建一个账号。" />}
        {!props.loading && props.providers.length > 0 && (
          <EntityList className="providerList">
            {props.providers.map((provider) => (
              <EntityRow
                key={provider.id}
                active={provider.id === props.editingProviderId}
                title={provider.name}
                subtitle={`${provider.providerType} · ${provider.id}`}
                details={`LLM: ${provider.llmModel || provider.defaultChatModel || "-"} · Embedding: ${provider.embeddingModel || provider.defaultEmbeddingModel || "-"} · Rerank: ${provider.rerankModel || "-"}`}
                status={provider.status}
                statusTone={provider.status === "active" ? "success" : "cancelled"}
                meta={provider.hasLlmApiKey || provider.hasEmbeddingApiKey || provider.hasRerankApiKey || provider.hasApiKey ? "已配置 Key" : "未配置 Key"}
                actions={
                  <>
                    <button className="ghostBtn" disabled={!!props.busyAction} onClick={() => props.editProvider(provider)}><Edit3 size={16} /> 编辑</button>
                    <button className="ghostBtn" disabled={!!props.busyAction} onClick={() => void props.testProvider(provider)}>{props.busyAction === `provider-test-${provider.id}` ? <Loader2 className="spin" size={16} /> : <Play size={16} />} 测试</button>
                    <button className="dangerBtn" disabled={!!props.busyAction || provider.status !== "active"} onClick={() => void props.disableProvider(provider)}>禁用</button>
                    <button className="dangerTextBtn" disabled={!!props.busyAction} onClick={() => void props.deleteProvider(provider)}>{props.busyAction === `provider-delete-${provider.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} 删除</button>
                  </>
                }
              />
            ))}
          </EntityList>
        )}
      </section>

      <Drawer
        open={props.formOpen}
        title={isEditing ? "编辑供应商" : "新增供应商"}
        description={isEditing ? `正在编辑 ${selectedProvider?.name || props.editingProviderId}` : "选择预设后填入 API Key 即可保存。"}
        onClose={props.closeForm}
        className="providerDrawer"
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>取消</button>
            <button className="primaryBtn" disabled={props.busyAction === "provider-create"} onClick={() => void props.createProvider()}>
              {props.busyAction === "provider-create" ? <Loader2 className="spin" size={16} /> : <Save size={16} />} {isEditing ? "保存修改" : "保存供应商"}
            </button>
          </ActionBar>
        }
      >
            <div className="providerForm">
              <div className="buttonRow providerPresetRow">
                <button className="ghostBtn" disabled={isEditing} onClick={() => applyPreset(dashScopePreset)}>DashScope 预设</button>
                <button className="ghostBtn" disabled={isEditing} onClick={() => applyPreset(openAiCompatiblePreset)}>OpenAI Compatible</button>
                <button className="ghostBtn" onClick={props.resetForm}><RotateCcw size={15} /> 重置</button>
              </div>

              <Field label="名称"><input value={props.form.name} onChange={(event) => props.setForm({ ...props.form, name: event.target.value })} /></Field>
              <Field label="类型">
                <select value={props.form.providerType} onChange={(event) => props.setForm({ ...props.form, providerType: event.target.value })}>
                  {providerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="共用 API Key"><input type="password" value={props.form.apiKey} onChange={(event) => syncSharedApiKey(event.target.value)} placeholder="DashScope: sk-... / OpenAI: sk-..." /></Field>

              <FormSection title="LLM 对话" description="DashScope 使用 /api/v1/services/aigc/text-generation/generation；OpenAI Compatible 使用 /chat/completions。">
                <Field label="Endpoint"><input value={props.form.llmBaseUrl} onChange={(event) => props.setForm({ ...props.form, llmBaseUrl: event.target.value, baseUrl: event.target.value })} placeholder="https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation" /></Field>
                <Field label="API Key"><input type="password" value={props.form.llmApiKey} onChange={(event) => props.setForm({ ...props.form, llmApiKey: event.target.value })} placeholder="不填则沿用共用 API Key" /></Field>
                <Field label="模型"><input value={props.form.llmModel} onChange={(event) => props.setForm({ ...props.form, llmModel: event.target.value, defaultChatModel: event.target.value })} placeholder="deepseek-v4-pro" /></Field>
                <Field label="请求参数 JSON"><textarea value={props.form.llmConfigJson} onChange={(event) => props.setForm({ ...props.form, llmConfigJson: event.target.value, configJson: event.target.value })} /></Field>
              </FormSection>

              <FormSection title="Embedding" description="DashScope 兼容模式使用 /compatible-mode/v1/embeddings，支持 dimensions 和 encoding_format。">
                <Field label="Endpoint"><input value={props.form.embeddingBaseUrl} onChange={(event) => props.setForm({ ...props.form, embeddingBaseUrl: event.target.value })} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings" /></Field>
                <Field label="API Key"><input type="password" value={props.form.embeddingApiKey} onChange={(event) => props.setForm({ ...props.form, embeddingApiKey: event.target.value })} placeholder="不填则沿用共用 API Key" /></Field>
                <Field label="模型"><input value={props.form.embeddingModel} onChange={(event) => props.setForm({ ...props.form, embeddingModel: event.target.value, defaultEmbeddingModel: event.target.value })} placeholder="text-embedding-v4" /></Field>
                <Field label="请求参数 JSON"><textarea value={props.form.embeddingConfigJson} onChange={(event) => props.setForm({ ...props.form, embeddingConfigJson: event.target.value })} /></Field>
              </FormSection>

              <FormSection title="Rerank" description="可选能力；当前未配置时不会影响 Agent 发布。">
                <Field label="Endpoint"><input value={props.form.rerankBaseUrl} onChange={(event) => props.setForm({ ...props.form, rerankBaseUrl: event.target.value })} /></Field>
                <Field label="API Key"><input type="password" value={props.form.rerankApiKey} onChange={(event) => props.setForm({ ...props.form, rerankApiKey: event.target.value })} placeholder="不填则沿用共用 API Key" /></Field>
                <Field label="模型"><input value={props.form.rerankModel} onChange={(event) => props.setForm({ ...props.form, rerankModel: event.target.value })} /></Field>
                <Field label="请求参数 JSON"><textarea value={props.form.rerankConfigJson} onChange={(event) => props.setForm({ ...props.form, rerankConfigJson: event.target.value })} /></Field>
              </FormSection>
            </div>
      </Drawer>
    </section>
  );
}
