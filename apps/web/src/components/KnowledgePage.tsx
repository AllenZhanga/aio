import { AlertCircle, ArrowLeft, Boxes, Code2, Database, Edit3, Eye, FileText, Hash, Info, Loader2, Plus, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import type { ChunkInspectResponse, DatasetRecord, DocumentRecord, ProviderRecord, RetrieveRecord } from "../types";
import { ActionBar, CodeBlock, CopyButton, Drawer, Field, FormSection, PopConfirm, PromptEditor, StatePanel } from "./ui";

export function KnowledgePage(props: {
  datasets: DatasetRecord[];
  documents: DocumentRecord[];
  sourceDocument: DocumentRecord | null;
  chunkInspect: ChunkInspectResponse | null;
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
  formOpen: "dataset" | "datasetEdit" | "document" | "debug" | "api" | "source" | "chunks" | "datasetInfo" | "";
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
  openDatasetEdit: () => void;
  openDocumentForm: () => void;
  openDebugDrawer: () => void;
  openApiDrawer: () => void;
  openDatasetInfo: () => void;
  backToDatasetList: () => void;
  openSourceDocument: (document: DocumentRecord) => Promise<void>;
  openDocumentChunks: (document: DocumentRecord) => Promise<void>;
  closeForm: () => void;
  refreshKnowledge: () => Promise<void>;
  selectDataset: (datasetId: string) => Promise<void>;
  createDataset: () => Promise<void>;
  updateDataset: () => Promise<void>;
  deleteDataset: (dataset: DatasetRecord) => Promise<void>;
  addDocument: () => Promise<void>;
  uploadDocumentFile: () => Promise<void>;
  deleteDocument: (document: DocumentRecord) => Promise<void>;
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
                  <PopConfirm
                    title="删除知识库"
                    message={`确认删除知识库「${dataset.name}」？删除后会同时清理该知识库下的文档和索引片段。`}
                    confirmText="删除知识库"
                    onConfirm={() => props.deleteDataset(dataset)}
                  >
                    <button className="dangerTextBtn" disabled={props.busyAction === `dataset-delete-${dataset.id}`}>
                      {props.busyAction === `dataset-delete-${dataset.id}` ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />} 删除
                    </button>
                  </PopConfirm>
                </div>
              </article>
            ))}
          </div>
          {!props.datasets.length && !props.loading && <StatePanel title="暂无知识库" text="点击创建知识库后，通过侧边栏录入数据集名称。" />}
        </section>
      ) : (
        <div className="knowledgeDetailGrid">
          <aside className="designCard knowledgeDatasetSummary compactIdentity">
            <div className="datasetIdentityHead">
              <span className={`runStatus ${selected.status === "active" || selected.status === "ready" ? "success" : "running"}`}>{selected.status}</span>
              <button className="iconBtn" onClick={props.openDatasetInfo} title="查看知识库信息" aria-label="查看知识库信息">
                <Info size={16} />
              </button>
            </div>
            <div className="datasetIdentityMark"><Database size={22} /></div>
            <h2>{selected.name}</h2>
            <dl>
              <dt>ID</dt><dd>{selected.id}</dd>
              <dt>文档</dt><dd>{props.documents.length} 个</dd>
            </dl>
            <button className="ghostBtn" onClick={props.openDatasetInfo}><Info size={16} /> 详情与设置</button>
            <button className="ghostBtn" onClick={props.openDatasetEdit}><Edit3 size={16} /> 编辑属性</button>
          </aside>
          <main className="opsMain">
            <section className="designCard knowledgeDocsCard">
              <div className="knowledgeDocsHeader">
                <div className="sectionTitle">
                  <FileText size={18} />
                  <div>
                    <h2>知识库文件</h2>
                    <p>每个文档都可以查看源文档、分块结果、解析过程和向量/索引信息。</p>
                  </div>
                </div>
                <div className="knowledgeDocsToolbar">
                  <button className="primaryBtn" onClick={props.openDocumentForm}>
                    <Plus size={16} /> 新增文档
                  </button>
                </div>
              </div>
              <div className="knowledgeDocumentList">
                {props.documents.map((document) => (
                  <article key={document.id} className="knowledgeDocumentRow">
                    <div className="documentIcon"><FileText size={18} /></div>
                    <div className="documentMain">
                      <div className="documentTitleLine">
                        <strong>{document.name}</strong>
                        <span className={`runStatus ${document.indexStatus === "success" ? "success" : "running"}`}>{document.indexStatus}</span>
                      </div>
                      <small>{document.id}</small>
                      <div className="documentMetaLine">
                        <span>{document.sourceType}</span>
                        <span>parse: {document.parseStatus}</span>
                        <span>{formatDate(document.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="documentActions">
                      <PopConfirm
                        title="删除文档"
                        message={`确认删除文档「${document.name}」？将同时清理该文档的分块与向量索引数据。`}
                        confirmText="删除文档"
                        onConfirm={() => props.deleteDocument(document)}
                      >
                        <button className="dangerTextBtn" disabled={props.busyAction === `document-delete-${document.id}`}>
                          {props.busyAction === `document-delete-${document.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} 删除
                        </button>
                      </PopConfirm>
                      <button className="ghostBtn" disabled={props.busyAction === `document-chunks-${document.id}`} onClick={() => void props.openDocumentChunks(document)}>
                        {props.busyAction === `document-chunks-${document.id}` ? <Loader2 className="spin" size={16} /> : <Boxes size={16} />} 分块 / 向量
                      </button>
                      <button className="ghostBtn" disabled={props.busyAction === `document-source-${document.id}`} onClick={() => void props.openSourceDocument(document)}>
                        {props.busyAction === `document-source-${document.id}` ? <Loader2 className="spin" size={16} /> : <Eye size={16} />} 源文档
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!props.documents.length && <StatePanel title="暂无文档" text="点击新增文档，从侧边栏写入文本或上传文件。" />}
            </section>
          </main>
        </div>
      )}
      <Drawer
        open={props.formOpen === "datasetInfo" && !!selected}
        title="知识库信息"
        description={selected ? `${selected.name} · ${selected.id}` : "查看知识库元数据。"}
        onClose={props.closeForm}
        className="knowledgeInfoDrawer"
        footer={<ActionBar><button className="ghostBtn" onClick={props.closeForm}>关闭</button></ActionBar>}
      >
        {selected && (
          <>
            <FormSection title="标识与状态" description="主页面左侧只保留必要标识，完整信息统一收纳在这里。">
              <div className="sourceDocMeta">
                <span>Dataset ID</span><code>{selected.id}</code>
                <span>Status</span><code>{selected.status}</code>
                <span>Workspace</span><code>{selected.workspaceId || "default"}</code>
                <span>Tenant</span><code>{selected.tenantId || "default"}</code>
              </div>
            </FormSection>
            <FormSection title="解析与索引配置" description={selected.description || "暂无描述"}>
              <div className="sourceDocMeta">
                <span>分块策略</span><code>{chunkStrategyLabel(selected.chunkStrategy)}</code>
                <span>Embedding Provider</span><code>{selected.embeddingProviderId || "未指定"}</code>
                <span>Embedding Model</span><code>{selected.embeddingModel || "未指定"}</code>
                <span>更新时间</span><code>{formatDate(selected.updatedAt)}</code>
              </div>
            </FormSection>
            <button className="ghostBtn" onClick={props.openDatasetEdit}><Edit3 size={16} /> 编辑知识库属性</button>
            <PopConfirm
              title="删除知识库"
              message={`确认删除知识库「${selected.name}」？删除后会同时清理该知识库下的文档和索引片段。`}
              confirmText="删除知识库"
              placement="bottom-end"
              onConfirm={() => props.deleteDataset(selected)}
            >
              <button className="dangerBtn" disabled={props.busyAction === `dataset-delete-${selected.id}`}>
                {props.busyAction === `dataset-delete-${selected.id}` ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} 删除知识库
              </button>
            </PopConfirm>
          </>
        )}
      </Drawer>
      <Drawer
        open={props.formOpen === "dataset" || props.formOpen === "datasetEdit"}
        title={props.formOpen === "datasetEdit" ? "编辑知识库属性" : "创建知识库"}
        description={props.formOpen === "datasetEdit" ? "修改名称、描述、Embedding 和分块策略。已存在文档如需套用新策略，可后续重新上传或重建索引。" : "创建后会出现在数据集列表，并可继续上传文件或写入文本文档。"}
        onClose={props.closeForm}
        footer={
          <ActionBar>
            <button className="ghostBtn" onClick={props.closeForm}>取消</button>
            <button className="primaryBtn" disabled={props.busyAction === "dataset" || props.busyAction === "dataset-update"} onClick={() => void (props.formOpen === "datasetEdit" ? props.updateDataset() : props.createDataset())}>
              {props.busyAction === "dataset" || props.busyAction === "dataset-update" ? <Loader2 className="spin" size={16} /> : <Database size={16} />} {props.formOpen === "datasetEdit" ? "保存修改" : "创建"}
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
        <FormSection title="索引属性" description="可在这里选择分块策略；文件上传会默认沿用知识库策略，手动文本写入也可单独指定文本分块模式。">
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
              { value: "ai", title: "AI 智能分块", text: "调用模型按语义主题、标题层级、问答边界智能拆分；需选择可用模型供应商。" },
              { value: "paragraph", title: "段落分块", text: "更重视自然段边界，适合说明文档和手册。" },
              { value: "qa", title: "问答分块", text: "适合 FAQ 或一问一答资料，便于精准召回。" },
              { value: "raw", title: "原文区块", text: "尽量保留解析结果为单个 chunk，适合短文本或结构化输入。" },
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
            {props.documentSourceMode === "file" && <button type="button" className="primaryBtn" disabled={!props.selectedDatasetId || !props.knowledgeFile || uploadBusy} onClick={() => void props.uploadDocumentFile()}>
              {uploadBusy ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />} 上传文件
            </button>}
            {props.documentSourceMode === "text" && <button type="button" className="primaryBtn" disabled={!props.selectedDatasetId || documentBusy} onClick={() => void props.addDocument()}>
              {documentBusy ? <Loader2 className="spin" size={16} /> : <FileText size={16} />} 写入文本
            </button>}
          </ActionBar>
        }
      >
        <div className="segmentedControl">
          <button type="button" className={props.documentSourceMode === "file" ? "active" : ""} onClick={() => props.setDocumentSourceMode("file")}><UploadCloud size={15} /> 文件上传</button>
          <button type="button" className={props.documentSourceMode === "text" ? "active" : ""} onClick={() => props.setDocumentSourceMode("text")}><FileText size={15} /> 文本写入</button>
        </div>
        {props.documentSourceMode === "file" && <FormSection title="上传文件" description={selected ? `支持 PDF、Excel、Word、PPT、图片和文本类资料；上传后会按当前知识库「${chunkStrategyLabel(selected.chunkStrategy)}」解析、拆分并进入向量入口。` : "支持 PDF、Excel、Word、PPT、图片和文本类资料；上传后自动解析、拆分并进入向量入口。"}>
          <div className={`fileUploadBox uploadDropzone ${props.knowledgeFile ? "selected" : ""}`}>
            <div className="uploadDropzoneMain">
              <span className="uploadIcon"><UploadCloud size={24} /></span>
              <div>
                <strong>{props.knowledgeFile ? props.knowledgeFile.name : "选择知识库资料上传"}</strong>
                {props.knowledgeFile ? <small>{formatFileSize(props.knowledgeFile.size)} · 准备解析、拆分并写入向量入口</small> : <p>可上传 Excel、PDF、图片、Office 文档、CSV、JSON、Markdown、TXT；图片文字会在服务端 OCR 可用时自动抽取。</p>}
              </div>
            </div>
            <input
              id="knowledge-file-input"
              className="visuallyHiddenInput"
              type="file"
              accept=".txt,.md,.csv,.json,.pdf,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.bmp,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*"
              onChange={(event) => props.setKnowledgeFile(event.target.files?.[0] || null)}
            />
            <div className="uploadActions">
              <label className="filePickBtn" htmlFor="knowledge-file-input">选择文件</label>
              {props.knowledgeFile && <button type="button" className="ghostTinyBtn" disabled={uploadBusy} onClick={() => props.setKnowledgeFile(null)}>移除</button>}
            </div>
            <div className="uploadCapabilityTags">
              {['PDF', 'Excel', '图片 OCR', 'Office', '文本'].map((item) => <span key={item}>{item}</span>)}
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
        open={props.formOpen === "chunks"}
        title="分块与向量"
        description={props.chunkInspect ? `${props.chunkInspect.document.name} · ${props.chunkInspect.chunks.length} 个 chunk` : "查看文档解析、分块和向量/索引信息。"}
        onClose={props.closeForm}
        className="chunkInspectDrawer"
        footer={<ActionBar><button className="ghostBtn" onClick={props.closeForm}>关闭</button></ActionBar>}
      >
        {props.chunkInspect ? (
          <>
            <div className="chunkInspectSummary">
              <article><span>实际分块</span><strong>{props.chunkInspect.parse.actual_strategy || "fixed"}</strong></article>
              <article><span>Chunk 数</span><strong>{props.chunkInspect.parse.total_chunks ?? props.chunkInspect.chunks.length}</strong></article>
              <article><span>原文字符</span><strong>{formatNumber(props.chunkInspect.parse.source_chars)}</strong></article>
              <article><span>向量状态</span><strong>{vectorStatusLabel(props.chunkInspect.parse.vector_status)}</strong></article>
              <article><span>已向量化</span><strong>{formatNumber(props.chunkInspect.parse.embedded_chunks)} / {formatNumber(props.chunkInspect.parse.total_chunks ?? props.chunkInspect.chunks.length)}</strong></article>
            </div>
            <FormSection title="如何分块解析" description={props.chunkInspect.parse.algorithm || "按当前文档类型执行分块。"}>
              <div className="chunkPipeline">
                <article><strong>1. 原文解析</strong><span>{props.chunkInspect.parse.source_type || props.chunkInspect.document.sourceType}</span></article>
                <article><strong>2. 分块规则</strong><span>{chunkStrategyLabel(props.chunkInspect.parse.actual_strategy)}</span></article>
                <article><strong>3. 写入索引</strong><span>{props.chunkInspect.document.indexStatus}</span></article>
              </div>
            </FormSection>
            <div className="vectorNotice">
              <Hash size={16} />
              <span>{props.chunkInspect.parse.vector_note || "当前展示 chunk 级 vector id、索引状态和 Embedding 配置。"}</span>
            </div>
            <div className="chunkExplorerList">
              {props.chunkInspect.chunks.map((chunk) => (
                <article key={chunk.id} className="chunkCard">
                  <header>
                    <div><strong>Chunk #{chunk.chunkNo + 1}</strong><small>{chunk.id}</small></div>
                    <span>{formatNumber(chunk.tokenCount)} tokens · {formatNumber(chunk.contentChars)} chars</span>
                  </header>
                  <p>{chunk.content}</p>
                  <div className="chunkVectorGrid">
                    <span>Vector ID</span><code>{chunk.vectorId || "未生成"}</code>
                    <span>Vector Status</span><code>{vectorStatusLabel(chunk.vectorStatus)}</code>
                    <span>Embedding</span><code>{chunk.embeddingModel || "未配置真实 embedding"}</code>
                    <span>维度</span><code>{chunk.embeddingDimension ? `${chunk.embeddingDimension} dim` : "—"}</code>
                    <span>Metadata</span><code>{chunk.metadata || "{}"}</code>
                  </div>
                </article>
              ))}
            </div>
            {!props.chunkInspect.chunks.length && <StatePanel title="暂无 Chunk" text="文档尚未写入索引或解析结果为空，可尝试重新上传/写入文档。" />}
          </>
        ) : (
          <StatePanel icon="loading" title="正在加载分块" text="正在读取文档 chunk 和向量/索引信息。" />
        )}
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
        <CodeBlock title="上传二进制文件" code={[
          `curl -X POST '${baseUrl}/v1/datasets/${datasetIdForApi}/documents/upload'`,
          `  -H 'Authorization: Bearer ${apiKey}'`,
          `  -F 'file=@./knowledge.xlsx'`,
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
  if (value === "ai") return "AI 智能分块";
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

function formatNumber(value?: number) {
  return value === undefined ? "—" : new Intl.NumberFormat("zh-CN").format(value);
}

function vectorStatusLabel(value?: string) {
  if (value === "lightweight_text_index") return "轻量文本索引";
  if (value === "embedded") return "已向量化";
  if (value === "partial") return "部分向量化";
  if (value === "embedding_failed") return "向量失败";
  if (value === "not_indexed") return "未索引";
  if (!value) return "未生成";
  return value;
}
