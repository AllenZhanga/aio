import { useState } from "react";
import { Bot, BrainCircuit, Check, Code2, Database, KeyRound, PlayCircle, ShieldCheck, SlidersHorizontal, Workflow, X } from "lucide-react";
import { buildAgentDefinition } from "../appDefinitions";
import type { AgentDraft, DatasetRecord, ModelOption } from "../types";
import { Drawer, Field, Notice, PromptEditor } from "./ui";

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [knowledgeDrawerOpen, setKnowledgeDrawerOpen] = useState(false);
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
  const selectedDatasets = datasets.filter((dataset) =>
    draft.knowledgeDatasetIds.includes(dataset.id),
  );
  const loadedDatasetIds = new Set(datasets.map((dataset) => dataset.id));
  const missingDatasetIds = draft.knowledgeDatasetIds.filter((datasetId) => !loadedDatasetIds.has(datasetId));
  const selectedDatasetNames = selectedDatasets.map((dataset) => dataset.name);
  const knowledgeSummary = draft.knowledgeDatasetIds.length
    ? [
        ...selectedDatasetNames,
        ...(missingDatasetIds.length > 0 ? [`${missingDatasetIds.length} 个已选数据集未加载`] : []),
      ].join("、")
    : "未选择知识库";
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

  function removeDataset(datasetId: string) {
    setDraft({
      ...draft,
      knowledgeDatasetIds: draft.knowledgeDatasetIds.filter((id) => id !== datasetId),
    });
  }

  return (
    <div className="agentLayout simple">
      <section className="designCard mainDesignCard">
        <div className="sectionTitle">
          <Bot size={20} />
          <div>
            <h2>智能体设计</h2>
            <p>先配置能力，再定义回答规则；体验、策略和开发调试已聚合到侧边入口。</p>
          </div>
        </div>
        <div className="agentBlockTitle">
          <strong>能力配置</strong>
          <span>模型与知识库决定智能体能用什么能力回答。</span>
        </div>
        <div className="agentModelRow">
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
          </div>
          <button className="ghostBtn agentSettingsBtn" onClick={() => setAdvancedOpen(true)} title="高级行为" aria-label="高级行为">
            <SlidersHorizontal size={18} />
          </button>
        </div>
        <section className="promptEditor knowledgePicker">
          <div className="promptEditorHeader">
            <span className="promptEditorIcon"><Database size={18} /></span>
            <div>
              <small>Knowledge</small>
              <strong>知识库</strong>
              <p>选择后会在运行时检索知识片段，并注入到 Agent 系统提示词中。</p>
            </div>
            <em>{selectedDatasets.length} 个可用{missingDatasetIds.length ? ` · ${missingDatasetIds.length} 个未加载` : ""}</em>
          </div>
          <div className="knowledgeSummaryPanel">
            <div>
              <span>当前选择</span>
              <strong>{knowledgeSummary}</strong>
              <p>检索参数：Top K {draft.knowledgeTopK} · Score ≥ {draft.knowledgeScoreThreshold}</p>
            </div>
            <button className="ghostBtn" onClick={() => setKnowledgeDrawerOpen(true)}><Database size={16} /> 选择知识库</button>
          </div>
        </section>
        <div className="agentBlockTitle">
          <strong>回答规则</strong>
          <span>这部分会进入运行时系统提示词，直接影响 Agent 输出。</span>
        </div>
        <PromptEditor
          title="智能体角色 / 回答规则"
          label="System Prompt"
          description="定义智能体是谁、回答风格、边界约束、拒答条件和输出规范。"
          value={draft.system}
          onChange={(value) => setDraft({ ...draft, system: value })}
          icon={<ShieldCheck size={18} />}
        />
      </section>
      <aside className="previewStack">
        <section className="designCard devToolsCard">
          <h3>开发调试</h3>
          <p>Runtime Key、Definition 和 Run Result 已收纳到调试抽屉。</p>
          <button className="ghostBtn" onClick={() => setDebugOpen(true)}><Code2 size={16} /> 打开调试信息</button>
        </section>
      </aside>
      <Drawer
        open={advancedOpen}
        title="高级行为"
        description="规划策略会参与运行时系统提示；模型参数默认隐藏，避免干扰主流程。"
        onClose={() => setAdvancedOpen(false)}
        className="agentParameterDrawer"
        footer={<button className="primaryBtn" onClick={() => setAdvancedOpen(false)}><Check size={16} /> 完成</button>}
      >
        <Notice>规划策略、会话记忆和角色规则会一起组成运行时提示词；Temperature 会传给模型供应商。</Notice>
        <section className="memoryConfigPanel">
          <div className="promptEditorHeader compact">
            <span className="promptEditorIcon"><BrainCircuit size={18} /></span>
            <div>
              <small>Memory</small>
              <strong>会话记录与记忆</strong>
              <p>开启后，同一 conversation_id 下最近的用户问题和 AI 回复会注入下一轮对话。</p>
            </div>
            <label className="switchControl">
              <input
                type="checkbox"
                checked={draft.memoryEnabled}
                onChange={(event) => setDraft({ ...draft, memoryEnabled: event.target.checked })}
              />
              <span />
            </label>
          </div>
          <Field label="记忆窗口" hint="按消息条数计算，包含用户消息和 AI 回复。值越大上下文越完整，也越消耗 token。">
            <input
              type="number"
              min="0"
              max="40"
              disabled={!draft.memoryEnabled}
              value={draft.memoryWindowMessages}
              onChange={(event) => setDraft({ ...draft, memoryWindowMessages: Number(event.target.value) })}
            />
          </Field>
          <div className="formGrid two compactGrid">
            <Field label="长对话摘要" hint="开启后，超过阈值的历史会压缩为滚动摘要，下一轮继续注入。">
              <select
                disabled={!draft.memoryEnabled}
                value={draft.memorySummaryEnabled ? "enabled" : "disabled"}
                onChange={(event) => setDraft({ ...draft, memorySummaryEnabled: event.target.value === "enabled" })}
              >
                <option value="enabled">开启</option>
                <option value="disabled">关闭</option>
              </select>
            </Field>
            <Field label="摘要触发条数">
              <input
                type="number"
                min="4"
                max="80"
                disabled={!draft.memoryEnabled || !draft.memorySummaryEnabled}
                value={draft.memorySummaryTriggerMessages}
                onChange={(event) => setDraft({ ...draft, memorySummaryTriggerMessages: Number(event.target.value) })}
              />
            </Field>
          </div>
        </section>
        <PromptEditor
          title="任务规划策略"
          label="Planning"
          description="描述 Agent 如何拆解任务、选择知识库/工具、组织结论和下一步建议。"
          value={draft.toolPlan}
          onChange={(value) => setDraft({ ...draft, toolPlan: value })}
          icon={<Workflow size={18} />}
        />
        <Field label="Temperature" hint="值越高越发散，值越低越稳定。建议企业问答保持 0.2 - 0.5。">
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
      </Drawer>
      <Drawer
        open={debugOpen}
        title="开发调试"
        description="面向开发与集成调试，不占用智能体设计主路径。"
        onClose={() => setDebugOpen(false)}
        className="agentDebugDrawer"
        footer={<button className="primaryBtn" onClick={() => setDebugOpen(false)}><Check size={16} /> 完成</button>}
      >
        <section className="designCard compact debugSection">
          <h3><KeyRound size={16} /> Runtime Key</h3>
          <input
            value={runtimeKey}
            onChange={(event) => setRuntimeKey(event.target.value)}
            placeholder="sk_..."
          />
        </section>
        <section className="designCard preview debugSection">
          <h3><Code2 size={16} /> Definition</h3>
          <pre>{JSON.stringify(definition, null, 2)}</pre>
        </section>
        <section className="designCard preview debugSection">
          <h3><PlayCircle size={16} /> Run Result</h3>
          <pre>
            {JSON.stringify(
              runResult || { hint: "请先在 API Key 菜单创建 Runtime Key，再试运行或体验应用。" },
              null,
              2,
            )}
          </pre>
        </section>
      </Drawer>
      <Drawer
        open={knowledgeDrawerOpen}
        title="选择知识库"
        description="从左侧数据集列表选择，右侧调整检索参数和查看当前选择。"
        onClose={() => setKnowledgeDrawerOpen(false)}
        className="knowledgeSelectDrawer"
        footer={<button className="primaryBtn" onClick={() => setKnowledgeDrawerOpen(false)}><Check size={16} /> 使用当前选择</button>}
      >
        {!datasets.length && !missingDatasetIds.length ? (
          <Notice tone="warning">当前工作空间暂无知识库，可先到知识库页面创建数据集。</Notice>
        ) : (
          <div className="knowledgeDrawerGrid">
            <aside className="knowledgeDrawerSidebar">
              <strong>数据集</strong>
              <span>{selectedDatasets.length} / {datasets.length} 可用已选{missingDatasetIds.length ? ` · ${missingDatasetIds.length} 个未加载` : ""}</span>
              <div className="knowledgeOptionList">
                {datasets.length ? (
                  datasets.map((dataset) => {
                    const selected = draft.knowledgeDatasetIds.includes(dataset.id);
                    return (
                      <button key={dataset.id} className={`knowledgeSelectItem ${selected ? "active" : ""}`} onClick={() => toggleDataset(dataset.id)}>
                        <span>{selected && <Check size={13} />}</span>
                        <div>
                          <strong>{dataset.name}</strong>
                          <small>{dataset.id} · {dataset.status}</small>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <Notice tone="warning">当前工作空间暂无可用知识库。</Notice>
                )}
              </div>
            </aside>
            <section className="knowledgeDrawerMain">
              <div className="knowledgeDrawerSummary">
                <span>当前选择</span>
                <strong>{knowledgeSummary}</strong>
                <p>知识片段会在运行时注入 Agent 系统提示词。未选择时，Agent 仅使用模型能力和系统提示回答。</p>
              </div>
              <div className="selectedDatasetChips">
                {selectedDatasets.length || missingDatasetIds.length ? (
                  <>
                    {selectedDatasets.map((dataset) => (
                      <button key={dataset.id} className="selectedDatasetChip" onClick={() => removeDataset(dataset.id)}>
                        <span>{dataset.name}</span>
                        <X size={13} />
                      </button>
                    ))}
                    {missingDatasetIds.map((datasetId) => (
                      <button key={datasetId} className="selectedDatasetChip missing" onClick={() => removeDataset(datasetId)}>
                        <span>{datasetId}</span>
                        <small>未加载，可能已删除</small>
                        <X size={13} />
                      </button>
                    ))}
                  </>
                ) : <em>未选择知识库</em>}
              </div>
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
          </div>
        )}
      </Drawer>
    </div>
  );
}
