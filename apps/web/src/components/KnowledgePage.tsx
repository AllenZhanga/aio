import { AlertCircle, ArrowLeft, Code2, Database, Eye, FileText, Loader2, Plus, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import type { DatasetRecord, DocumentRecord, ProviderRecord, RetrieveRecord } from "../types";
import { ActionBar, CodeBlock, CopyButton, Drawer, EntityList, EntityRow, Field, FormSection, PromptEditor, StatePanel } from "./ui";

export function KnowledgePage(props: {
  datasets: DatasetRecord[];
  documents: DocumentRecord[];
  sourceDocument: DocumentRecord | null;
  retrieveRecords: RetrieveRecord[];
  selectedDatasetId: string;
  loading: boolean;
  error: string;
  newDatasetName: string;
  newDatasetDescription: string;
  newDatasetEmbeddingProviderId: string;
  newDatasetEmbeddingModel: string;
  newDatasetChunkStrategy: string;
  newDocumentName: string;
  newDocumentText: string;
  retrieveQuery: string;
  documentSourceMode: "file" | "text";
  textChunkMode: string;
  knowledgeFile: File | null;
  formOpen: "dataset" | "document" | "debug" | "api" | "source" | "";
  busyAction: string;
  providerOptions: ProviderRecord[];
  runtimeKey: string;
  setNewDatasetName: (value: string) => void;
  setNewDatasetDescription: (value: string) => void;
  setNewDatasetEmbeddingProviderId: (value: string) => void;
  setNewDatasetEmbeddingModel: (value: string) => void;
  setNewDatasetChunkStrategy: (value: string) => void;
  setNewDocumentName: (value: string) => void;
  setNewDocumentText: (value: string) => void;
  setRetrieveQuery: (value: string) => void;
  setDocumentSourceMode: (value: "file" | "text") => void;
  setTextChunkMode: (value: string) => void;
  setKnowledgeFile: (file: File | null) => void;
  openDatasetForm: () => void;
  openDocumentForm: () => void;
  openDebugDrawer: () => void;
  openApiDrawer: () => void;
  backToDatasetList: () => void;
  openSourceDocument: (document: DocumentRecord) => Promise<void>;
  closeForm: () => void;
  refreshKnowledge: () => Promise<void>;
  selectDataset: (datasetId: string) => Promise<void>;
  createDataset: () => Promise<void>;
  deleteDataset: (dataset: DatasetRecord) => Promise<void>;
  addDocument: () => Promise<void>;
  uploadDocumentFile: () => Promise<void>;
  retrieveTest: () => Promise<void>;
}) {
  const selected = props.datasets.find((dataset) => dataset.id === props.selectedDatasetId);
  const uploadBusy = props.busyAction === "document-upload";
  const documentBusy = props.busyAction === "document";
  const datasetIdForApi = props.selectedDatasetId || "{dataset_id}";
  const baseUrl = typeof window === "undefined" ? "" : window.location.origin;
  const apiKey = props.runtimeKey || "sk_REPLACE_ME";
  const embeddingProviders = props.providerOptions.filter((provider) => provider.status === "active" && (provider.embeddingModel || provider.defaultEmbeddingModel));

  return (
    <section className="workspacePane opsPane">
      <div className="pageHeader">
        <div>
          <h1>{selected ? selected.name : "知识库"}</h1>
          <p>{selected ? `${selected.id} · ${props.documents.length} 个文档` : "进入后先看到全部知识库卡片，点击卡片后管理文档、调试和 API。"}</p>
        </div>
        <div className="headerActions">
          {selected && <button className="ghostBtn" onClick={props.backToDatasetList}>
            <ArrowLeft size={16} /> 返回知识库主页
          </button>}
          <button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshKnowledge()}>
            {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新
          </button>
          {selected && <button className="ghostBtn" onClick={props.openApiDrawer}>
            <Code2 size={16} /> API
          </button>}
          {selected && <button className="ghostBtn" onClick={props.openDebugDrawer}>
            <Search size={16} /> 调试
          </button>}
          {selected && <button className="ghostBtn" onClick={props.openDocumentForm}>
            <Plus size={16} /> 新增文档
          </button>}
          <button className="primaryBtn" onClick={props.openDatasetForm}>
            <Database size={16} /> 创建知识库
          </button>
        </div>
      </div>
      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshKnowledge()}>重试</button>
        </div>
      )}
      {!selected ? (
        <section className="knowledgeHome">
          <div className="sectionTitle">
            <Database size={18} />
            <div><h2>知识库列表</h2><p>卡片平铺展示每个知识库的分块策略、Embedding 模型、状态和最近更新时间。</p></div>
          </div>
          <div className="knowledgeCardGrid">
            {props.datasets.map((dataset) => (
              <article key={dataset.id} className="knowledgeDatasetCard">
                <span className={`runStatus ${dataset.status === "active" || dataset.status === "ready" ? "success" : "running"}`}>{dataset.status}</span>
                <strong>{dataset.name}</strong>
                <small>{dataset.id}</small>
                <p>{dataset.description || "暂无描述"}</p>
                <dl>
                  <dt>分块</dt><dd>{chunkStrategyLabel(dataset.chunkStrategy)}</dd>
                  <dt>Embedding</dt><dd>{dataset.embeddingModel || "未指定"}</dd>
                  <dt>更新</dt><dd>{formatDate(dataset.updatedAt)}</dd>
                </dl>
                <div className="knowledgeCardActions">
                  <button className="ghostBtn" onClick={() => void props.selectDataset(dataset.id)}>进入</button>
                  <button className="dangerTextBtn" disabled={props.busyAction === `dataset-delete-${dataset.id}`} onClick={() => void props.deleteDataset(dataset)}>
                    {props.busyAction === `dataset-delete-${dataset.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} 删除
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!props.datasets.length && !props.loading && <StatePanel title="暂无知识库" text="点击创建知识库后，通过侧边栏录入数据集名称。" />}
        </section>
      ) : (
        <div className="knowledgeDetailGrid">
          <aside className="designCard knowledgeDatasetSummary">
            <span className={`runStatus ${selected.status === "active" || selected.status === "ready" ? "success" : "running"}`}>{selected.status}</span>
            <h2>{selected.name}</h2>
            <p>{selected.description || "暂无描述"}</p>
            <dl>
              <dt>知识库 ID</dt><dd>{selected.id}</dd>
              <dt>分块策略</dt><dd>{chunkStrategyLabel(selected.chunkStrategy)}</dd>
              <dt>Embedding</dt><dd>{selected.embeddingModel || "未指定"}</dd>
              <dt>更新时间</dt><dd>{formatDate(selected.updatedAt)}</dd>
            </dl>
            <button className="dangerBtn" disabled={props.busyAction === `dataset-delete-${selected.id}`} onClick={() => void props.deleteDataset(selected)}>
              {props.busyAction === `dataset-delete-${selected.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} 删除知识库
            </button>
          </aside>
          <main className="opsMain">
            <section className="designCard">
              <div className="sectionTitle">
                <FileText size={18} />
                <div>
                  <h2>知识库文件</h2>
                  <p>查看源文档、解析状态、索引状态和更新时间。</p>
                </div>
              </div>
              <div className="stackPanel horizontal">
                <button className="primaryBtn" onClick={props.openDocumentForm}>
                  <Plus size={16} /> 新增文档
                </button>
                <button className="ghostBtn" onClick={props.openDebugDrawer}>
                  <Search size={16} /> 检索调试
                </button>
                <button className="ghostBtn" onClick={props.openApiDrawer}>
                  <Code2 size={16} /> API 调用
                </button>
              </div>
              <EntityList>
                {props.documents.map((document) => (
                  <EntityRow
                    key={document.id}
                    title={document.name}
                    subtitle={document.id}
                    status={document.indexStatus}
                    statusTone={document.indexStatus === "success" ? "success" : "running"}
                    meta={`${document.sourceType} · ${formatDate(document.updatedAt)}`}
                    details={`parse: ${document.parseStatus}`}
                    actions={
                      <button className="ghostBtn" disabled={props.busyAction === `document-source-${document.id}`} onClick={() => void props.openSourceDocument(document)}>
                        {props.busyAction === `document-source-${document.id}` ? <Loader2 className="spin" size={16} /> : <Eye size={16} />} 查看源文档
                      </button>
                    }
                  />
                ))}
              </EntityList>
              {!props.documents.length && <StatePanel title="暂无文档" text="点击新增文档，从侧边栏写入文本或上传文件。" />}
            </section>
          </main>
        </div>
      )}
      <Drawer
        open={props.formOpen === "dataset"}
        title="创建知识库"
        description="创建后会出现在数据集列表，并可继续上传文件或写入文本文档。"
        onClose={props.closeForm}
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>取消</button>
            <button className="primaryBtn" disabled={props.busyAction === "dataset"} onClick={() => void props.createDataset()}>
              {props.busyAction === "dataset" ? <Loader2 className="spin" size={16} /> : <Database size={16} />} 创建
            </button>
          </ActionBar>
        }
      >
        <Field label="知识库名称">
          <input value={props.newDatasetName} onChange={(event) => props.setNewDatasetName(event.target.value)} autoFocus />
        </Field>
        <Field label="描述">
          <textarea value={props.newDatasetDescription} onChange={(event) => props.setNewDatasetDescription(event.target.value)} placeholder="说明知识库覆盖的业务范围、维护人或适用场景" />
        </Field>
        <FormSection title="索引属性" description="这些属性会写入数据集配置，后续 Agent 和 Workflow 可按同一知识库复用。">
          <Field label="Embedding 供应商">
            <select value={props.newDatasetEmbeddingProviderId} onChange={(event) => {
              const provider = props.providerOptions.find((item) => item.id === event.target.value);
              props.setNewDatasetEmbeddingProviderId(event.target.value);
              if (provider?.embeddingModel || provider?.defaultEmbeddingModel) props.setNewDatasetEmbeddingModel(provider.embeddingModel || provider.defaultEmbeddingModel || "");
            }}>
              <option value="">暂不指定</option>
              {embeddingProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} · {provider.embeddingModel || provider.defaultEmbeddingModel}</option>)}
            </select>
          </Field>
          <Field label="Embedding 模型">
            <input value={props.newDatasetEmbeddingModel} onChange={(event) => props.setNewDatasetEmbeddingModel(event.target.value)} placeholder="text-embedding-v4" />
          </Field>
          <div className="radioGrid">
            {[
              { value: "fixed", title: "固定分块", text: "适合文档、政策、FAQ，按长度和段落生成稳定片段。" },
              { value: "paragraph", title: "段落分块", text: "更重视自然段边界，适合说明文档和手册。" },
              { value: "qa", title: "问答分块", text: "适合 FAQ 或一问一答资料，便于精准召回。" },
            ].map((item) => (
              <label key={item.value} className={`radioCard ${props.newDatasetChunkStrategy === item.value ? "active" : ""}`}>
                <input type="radio" name="dataset-chunk" value={item.value} checked={props.newDatasetChunkStrategy === item.value} onChange={() => props.setNewDatasetChunkStrategy(item.value)} />
                <span><strong>{item.title}</strong><small>{item.text}</small></span>
              </label>
            ))}
          </div>
        </FormSection>
      </Drawer>
      <Drawer
        open={props.formOpen === "document"}
        title="新增文档"
        description={selected ? `写入到 ${selected.name}` : "请先选择一个知识库。"}
        onClose={props.closeForm}
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>取消</button>
            {props.documentSourceMode === "file" && <button className="primaryBtn" disabled={!props.selectedDatasetId || !props.knowledgeFile || uploadBusy} onClick={() => void props.uploadDocumentFile()}>
              {uploadBusy ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />} 上传文件
            </button>}
            {props.documentSourceMode === "text" && <button className="primaryBtn" disabled={!props.selectedDatasetId || documentBusy} onClick={() => void props.addDocument()}>
              {documentBusy ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} 写入文本
            </button>}
          </ActionBar>
        }
      >
        <div className="segmentedControl">
          <button className={props.documentSourceMode === "file" ? "active" : ""} onClick={() => props.setDocumentSourceMode("file")}><UploadCloud size={15} /> 文件上传</button>
          <button className={props.documentSourceMode === "text" ? "active" : ""} onClick={() => props.setDocumentSourceMode("text")}><FileText size={15} /> 文本写入</button>
        </div>
        {props.documentSourceMode === "file" && <FormSection title="上传文件" description="适合 txt、md、csv、json 等文本类资料，上传后自动解析并写入索引。">
          <div className={`fileUploadBox uploadDropzone ${props.knowledgeFile ? "selected" : ""}`}>
            <div className="uploadDropzoneMain">
              <span className="uploadIcon"><UploadCloud size={24} /></span>
              <div>
                <strong>{props.knowledgeFile ? props.knowledgeFile.name : "选择文本资料上传"}</strong>
                {props.knowledgeFile && <small>{formatFileSize(props.knowledgeFile.size)} · 准备上传并索引</small>}
              </div>
            </div>
            <input
              id="knowledge-file-input"
              className="visuallyHiddenInput"
              type="file"
              accept=".txt,.md,.csv,.json,text/plain,text/markdown,application/json,text/csv"
              onChange={(event) => props.setKnowledgeFile(event.target.files?.[0] || null)}
            />
            <div className="uploadActions">
              <label className="filePickBtn" htmlFor="knowledge-file-input">选择文件</label>
              {props.knowledgeFile && <button className="ghostTinyBtn" disabled={uploadBusy} onClick={() => props.setKnowledgeFile(null)}>移除</button>}
            </div>
          </div>
        </FormSection>}
        {props.documentSourceMode === "text" && <FormSection title="文本文档" description="适合快速录入政策、FAQ、流程说明；写入后可立即检索测试。">
          <Field label="文档名称">
            <input value={props.newDocumentName} onChange={(event) => props.setNewDocumentName(event.target.value)} />
          </Field>
          <div className="radioGrid compact">
            {[
              { value: "paragraph", title: "段落区块", text: "按空行和自然段切分。" },
              { value: "qa", title: "问答区块", text: "适合一问一答资料。" },
              { value: "raw", title: "原文区块", text: "尽量保留输入结构。" },
            ].map((item) => (
              <label key={item.value} className={`radioCard ${props.textChunkMode === item.value ? "active" : ""}`}>
                <input type="radio" name="text-chunk-mode" value={item.value} checked={props.textChunkMode === item.value} onChange={() => props.setTextChunkMode(item.value)} />
                <span><strong>{item.title}</strong><small>{item.text}</small></span>
              </label>
            ))}
          </div>
          <PromptEditor
            title="文档内容"
            label="文本"
            description="输入会被写入当前知识库并生成轻量索引。"
            value={props.newDocumentText}
            onChange={props.setNewDocumentText}
            icon={<FileText size={18} />}
          />
        </FormSection>}
      </Drawer>
      <Drawer
        open={props.formOpen === "debug"}
        title="知识库调试"
        description={selected ? `检索 ${selected.name} 的命中片段、score 和来源文档。` : "请先选择知识库。"}
        onClose={props.closeForm}
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>关闭</button>
            <button className="primaryBtn" disabled={!props.selectedDatasetId || props.busyAction === "retrieve"} onClick={() => void props.retrieveTest()}>
              {props.busyAction === "retrieve" ? <Loader2 className="spin" size={16} /> : <Search size={16} />} 运行检索
            </button>
          </ActionBar>
        }
      >
        <Field label="Query">
          <textarea value={props.retrieveQuery} onChange={(event) => props.setRetrieveQuery(event.target.value)} placeholder="输入要调试的问题或关键词" />
        </Field>
        <div className="resultCards debugResults">
          {props.retrieveRecords.map((record) => (
            <article key={record.chunk_id}>
              <strong>score {record.score.toFixed(2)}</strong>
              <p>{record.content}</p>
              <small>{record.document_id} / {record.chunk_id}</small>
            </article>
          ))}
        </div>
        {!props.retrieveRecords.length && <StatePanel title="暂无调试结果" text="输入 Query 后运行检索，查看真实召回片段和分数。" />}
      </Drawer>
      <Drawer
        open={props.formOpen === "source"}
        title="源文档"
        description={props.sourceDocument ? `${props.sourceDocument.name} · ${props.sourceDocument.id}` : "正在读取源文档。"}
        onClose={props.closeForm}
        footer={<ActionBar><button className="ghostBtn" onClick={props.closeForm}>关闭</button></ActionBar>}
      >
        {props.sourceDocument ? (
          <>
            <FormSection title="文档信息" description="这里展示写入知识库时保留的原始文本和对象路径。">
              <div className="sourceDocMeta">
                <span>Source Type</span><code>{props.sourceDocument.sourceType}</code>
                <span>Object Key</span><code>{props.sourceDocument.objectKey || "-"}</code>
                <span>Parse</span><code>{props.sourceDocument.parseStatus}</code>
                <span>Index</span><code>{props.sourceDocument.indexStatus}</code>
              </div>
            </FormSection>
            <CodeBlock title="源文档内容" code={props.sourceDocument.contentText || ""} />
          </>
        ) : (
          <StatePanel icon="loading" title="正在加载源文档" text="正在读取文档原始内容。" />
        )}
      </Drawer>
      <Drawer
        open={props.formOpen === "api"}
        title="知识库 API"
        description="面向外部系统的知识写入和检索接口，使用 Runtime API Key 鉴权。"
        onClose={props.closeForm}
        footer={<ActionBar><button className="ghostBtn" onClick={props.closeForm}>关闭</button></ActionBar>}
      >
        <FormSection title="调用信息" description="这些接口是知识库专用 Runtime API，不依赖具体 Agent。">
          <div className="apiMetaList">
            <span>Base URL</span><code>{baseUrl}</code><CopyButton text={baseUrl} />
            <span>Dataset ID</span><code>{datasetIdForApi}</code><CopyButton text={datasetIdForApi} />
            <span>鉴权</span><code>Authorization: Bearer {apiKey}</code><CopyButton text={`Authorization: Bearer ${apiKey}`} />
          </div>
        </FormSection>
        <CodeBlock title="写入文档" code={[
          `curl -X POST '${baseUrl}/v1/datasets/${datasetIdForApi}/documents'`,
          `  -H 'Authorization: Bearer ${apiKey}'`,
          "  -H 'Content-Type: application/json'",
          `  -d '{"name":"FAQ","sourceType":"text:paragraph","text":"退款政策：客户可在 7 天内申请退款。"}'`,
        ].join("\n")} />
        <CodeBlock title="检索知识" code={[
          `curl -X POST '${baseUrl}/v1/datasets/${datasetIdForApi}/retrieve'`,
          `  -H 'Authorization: Bearer ${apiKey}'`,
          "  -H 'Content-Type: application/json'",
          `  -d '{"query":"退款政策","topK":5,"scoreThreshold":0}'`,
        ].join("\n")} />
        <CodeBlock title="JavaScript" code={[
          `const response = await fetch("${baseUrl}/v1/datasets/${datasetIdForApi}/retrieve", {`,
          '  method: "POST",',
          `  headers: { "Authorization": "Bearer ${apiKey}", "Content-Type": "application/json" },`,
          '  body: JSON.stringify({ query: "退款政策", topK: 5, scoreThreshold: 0 })',
          '});',
          'const result = await response.json();',
        ].join("\n")} />
      </Drawer>
    </section>
  );
}

function chunkStrategyLabel(value?: string) {
  if (value === "paragraph") return "段落分块";
  if (value === "qa") return "问答分块";
  if (value === "raw") return "原文区块";
  return "固定分块";
}

function formatDate(value?: string) {
  if (!value) return "刚刚";
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
