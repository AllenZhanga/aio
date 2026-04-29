import { Bot, Database, Workflow } from "lucide-react";
import { buildAgentDefinition } from "../appDefinitions";
import type { AgentDraft, DatasetRecord, ModelOption } from "../types";
import { Field, Notice, PromptEditor } from "./ui";

export function AgentDesigner({
  draft,
  setDraft,
  modelOptions,
  datasets,
  runResult,
  runtimeKey,
  setRuntimeKey,
}: {
  draft: AgentDraft;
  setDraft: (draft: AgentDraft) => void;
  modelOptions: ModelOption[];
  datasets: DatasetRecord[];
  runResult: Record<string, unknown> | null;
  runtimeKey: string;
  setRuntimeKey: (value: string) => void;
}) {
  const definition = buildAgentDefinition(draft);
  const selectedProviderOptions = modelOptions.filter(
    (option) => option.providerId === draft.providerAccountId,
  );
  const modelValues = selectedProviderOptions.length
    ? selectedProviderOptions.map((option) => option.model)
    : modelOptions.map((option) => option.model);
  const options = modelValues.includes(draft.model)
    ? modelValues
    : [draft.model, ...modelValues].filter(Boolean);

  function selectProvider(providerId: string) {
    const firstModel =
      modelOptions.find((option) => option.providerId === providerId)?.model ||
      draft.model;
    setDraft({ ...draft, providerAccountId: providerId, model: firstModel });
  }

  function toggleDataset(datasetId: string) {
    const selected = draft.knowledgeDatasetIds.includes(datasetId);
    setDraft({
      ...draft,
      knowledgeDatasetIds: selected
        ? draft.knowledgeDatasetIds.filter((id) => id !== datasetId)
        : [...draft.knowledgeDatasetIds, datasetId],
    });
  }

  return (
    <div className="agentLayout">
      <section className="designCard mainDesignCard">
        <div className="sectionTitle">
          <Bot size={20} />
          <div>
            <h2>智能体设计</h2>
            <p>适合自主规划、工具调用、知识问答和任务执行。</p>
          </div>
        </div>
        <div className="formGrid two">
          <Field label="模型供应商">
            <select
              value={draft.providerAccountId}
              onChange={(event) => selectProvider(event.target.value)}
            >
              <option value="">请选择供应商</option>
              {modelOptions.map((option) => (
                <option key={option.providerId} value={option.providerId}>
                  {option.providerName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="模型">
            <select
              value={draft.model}
              onChange={(event) =>
                setDraft({ ...draft, model: event.target.value })
              }
            >
              <option value="">请选择模型</option>
              {options.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Temperature">
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={draft.temperature}
              onChange={(event) =>
                setDraft({ ...draft, temperature: Number(event.target.value) })
              }
            />
          </Field>
        </div>
        <section className="promptEditor knowledgePicker">
          <div className="promptEditorHeader">
            <span className="promptEditorIcon"><Database size={18} /></span>
            <div>
              <small>Knowledge</small>
              <strong>知识库</strong>
              <p>选择后会在运行时检索知识片段，并注入到 Agent 系统提示词中。</p>
            </div>
            <em>{draft.knowledgeDatasetIds.length} 个</em>
          </div>
          {!datasets.length ? (
            <Notice tone="warning">当前工作空间暂无知识库，可先到知识库页面创建数据集。</Notice>
          ) : (
            <div className="knowledgeOptionList">
              {datasets.map((dataset) => (
                <label key={dataset.id} className="checkRow">
                  <input
                    type="checkbox"
                    checked={draft.knowledgeDatasetIds.includes(dataset.id)}
                    onChange={() => toggleDataset(dataset.id)}
                  />
                  <span>
                    <strong>{dataset.name}</strong>
                    <small>{dataset.id} · {dataset.status}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div className="formGrid two compactGrid">
            <Field label="Top K">
              <input
                type="number"
                min="1"
                max="20"
                value={draft.knowledgeTopK}
                onChange={(event) => setDraft({ ...draft, knowledgeTopK: Number(event.target.value) })}
              />
            </Field>
            <Field label="Score 阈值">
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={draft.knowledgeScoreThreshold}
                onChange={(event) => setDraft({ ...draft, knowledgeScoreThreshold: Number(event.target.value) })}
              />
            </Field>
          </div>
        </section>
        <AutonomousAgentForm draft={draft} setDraft={setDraft} />
        <Field label="开场白">
          <input
            value={draft.opening}
            onChange={(event) =>
              setDraft({ ...draft, opening: event.target.value })
            }
          />
        </Field>
      </section>
      <aside className="previewStack">
        <section className="designCard compact">
          <h3>Runtime Key</h3>
          <input
            value={runtimeKey}
            onChange={(event) => setRuntimeKey(event.target.value)}
            placeholder="sk_..."
          />
        </section>
        <section className="designCard preview">
          <h3>Definition</h3>
          <pre>{JSON.stringify(definition, null, 2)}</pre>
        </section>
        <section className="designCard preview">
          <h3>Run Result</h3>
          <pre>
            {JSON.stringify(
              runResult || { hint: "请先在 API Key 菜单创建 Runtime Key，再试运行或体验应用。" },
              null,
              2,
            )}
          </pre>
        </section>
      </aside>
    </div>
  );
}

function AutonomousAgentForm({
  draft,
  setDraft,
}: {
  draft: AgentDraft;
  setDraft: (draft: AgentDraft) => void;
}) {
  return (
    <>
      <PromptEditor
        title="Agent 规划策略"
        label="策略提示"
        description="描述 Agent 如何拆解任务、选择工具、检索知识和组织回答。"
        value={draft.toolPlan}
        onChange={(value) => setDraft({ ...draft, toolPlan: value })}
        icon={<Workflow size={18} />}
      />
      <PromptEditor
        title="角色与约束"
        label="系统提示"
        description="定义角色边界、语气、安全约束和输出要求，会写入发布定义。"
        value={draft.system}
        onChange={(value) => setDraft({ ...draft, system: value })}
        icon={<Bot size={18} />}
      />
    </>
  );
}
