import { useState } from "react";
import type { ChunkInspectResponse, DatasetRecord, DocumentRecord, RetrieveRecord } from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

type UploadForm = <T>(path: string, formData: FormData) => Promise<T>;

export function useKnowledgePage({
  call,
  uploadForm,
  setStatus,
}: {
  call: ConsoleCall;
  uploadForm: UploadForm;
  setStatus: (value: string) => void;
}) {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [sourceDocument, setSourceDocument] = useState<DocumentRecord | null>(null);
  const [chunkInspect, setChunkInspect] = useState<ChunkInspectResponse | null>(null);
  const [retrieveQuery, setRetrieveQuery] = useState("退款政策");
  const [retrieveRecords, setRetrieveRecords] = useState<RetrieveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newDatasetName, setNewDatasetName] = useState("企业知识库");
  const [newDatasetDescription, setNewDatasetDescription] = useState("用于企业问答、售后政策和流程指引。");
  const [newDatasetEmbeddingProviderId, setNewDatasetEmbeddingProviderId] = useState("");
  const [newDatasetEmbeddingModel, setNewDatasetEmbeddingModel] = useState("text-embedding-v4");
  const [newDatasetChunkStrategy, setNewDatasetChunkStrategy] = useState("fixed");
  const [newDocumentName, setNewDocumentName] = useState("控制台文本文档");
  const [newDocumentText, setNewDocumentText] = useState(
    "退款政策：客户可在 7 天内申请退款。请先核验订单状态，再确认处理方案。",
  );
  const [documentSourceMode, setDocumentSourceMode] = useState<"file" | "text">("file");
  const [textChunkMode, setTextChunkMode] = useState("paragraph");
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [formOpen, setFormOpen] = useState<"dataset" | "datasetEdit" | "document" | "debug" | "api" | "source" | "chunks" | "datasetInfo" | "">("");
  const [busyAction, setBusyAction] = useState("");

  function openDatasetForm() {
    setNewDatasetName("企业知识库");
    setNewDatasetDescription("用于企业问答、售后政策和流程指引。");
    setNewDatasetEmbeddingProviderId("");
    setNewDatasetEmbeddingModel("text-embedding-v4");
    setNewDatasetChunkStrategy("fixed");
    setFormOpen("dataset");
  }

  function openDatasetEdit() {
    const dataset = datasets.find((item) => item.id === selectedDatasetId);
    if (!dataset) return;
    setNewDatasetName(dataset.name || "");
    setNewDatasetDescription(dataset.description || "");
    setNewDatasetEmbeddingProviderId(dataset.embeddingProviderId || "");
    setNewDatasetEmbeddingModel(dataset.embeddingModel || "");
    setNewDatasetChunkStrategy(dataset.chunkStrategy || "fixed");
    setFormOpen("datasetEdit");
  }

  function openDocumentForm() {
    setFormOpen("document");
  }

  function openDebugDrawer() {
    setFormOpen("debug");
  }

  function openApiDrawer() {
    setFormOpen("api");
  }

  function openDatasetInfo() {
    setFormOpen("datasetInfo");
  }

  function backToDatasetList() {
    setSelectedDatasetId("");
    setDocuments([]);
    setRetrieveRecords([]);
    setSourceDocument(null);
    setChunkInspect(null);
    setFormOpen("");
  }

  async function openSourceDocument(document: DocumentRecord) {
    setBusyAction(`document-source-${document.id}`);
    try {
      const nextDocument = await call<DocumentRecord>(`/api/aio/admin/documents/${document.id}`);
      setSourceDocument(nextDocument);
      setFormOpen("source");
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "源文档加载失败");
    } finally {
      setBusyAction("");
    }
  }

  async function openDocumentChunks(document: DocumentRecord) {
    setBusyAction(`document-chunks-${document.id}`);
    try {
      const nextInspect = await call<ChunkInspectResponse>(`/api/aio/admin/documents/${document.id}/chunks`);
      setChunkInspect(nextInspect);
      setFormOpen("chunks");
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "文档分块加载失败");
    } finally {
      setBusyAction("");
    }
  }

  function closeForm() {
    setFormOpen("");
  }

  async function refreshKnowledge() {
    setLoading(true);
    setError("");
    try {
      const nextDatasets = await call<DatasetRecord[]>(
        "/api/aio/admin/datasets",
      );
      setDatasets(nextDatasets);
      const nextDatasetId =
        selectedDatasetId &&
        nextDatasets.some((dataset) => dataset.id === selectedDatasetId)
          ? selectedDatasetId
          : "";
      setSelectedDatasetId(nextDatasetId);
      if (nextDatasetId) {
        const nextDocuments = await call<DocumentRecord[]>(
          `/api/aio/admin/datasets/${nextDatasetId}/documents`,
        );
        setDocuments(nextDocuments);
      } else {
        setDocuments([]);
        setRetrieveRecords([]);
        setSourceDocument(null);
        setChunkInspect(null);
      }
      setStatus("知识库已同步");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "知识库加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function selectDataset(datasetId: string) {
    setSelectedDatasetId(datasetId);
    setLoading(true);
    setError("");
    try {
      const nextDocuments = await call<DocumentRecord[]>(
        `/api/aio/admin/datasets/${datasetId}/documents`,
      );
      setDocuments(nextDocuments);
      setRetrieveRecords([]);
      setSourceDocument(null);
      setChunkInspect(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "文档加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function createDataset() {
    setBusyAction("dataset");
    try {
      const created = await call<DatasetRecord>("/api/aio/admin/datasets", {
        method: "POST",
        body: JSON.stringify({
          name: newDatasetName,
          description: newDatasetDescription,
          embeddingProviderId: newDatasetEmbeddingProviderId || undefined,
          embeddingModel: newDatasetEmbeddingModel || undefined,
          chunkStrategy: newDatasetChunkStrategy,
        }),
      });
      setSelectedDatasetId(created.id);
      setStatus(`已创建知识库 ${created.name}`);
      await refreshKnowledge();
      setSelectedDatasetId(created.id);
      await selectDataset(created.id);
      closeForm();
    } catch (nextError) {
      setStatus(
        nextError instanceof Error ? nextError.message : "知识库创建失败",
      );
    } finally {
      setBusyAction("");
    }
  }

  async function updateDataset() {
    if (!selectedDatasetId) return;
    setBusyAction("dataset-update");
    try {
      const updated = await call<DatasetRecord>(`/api/aio/admin/datasets/${selectedDatasetId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: newDatasetName,
          description: newDatasetDescription,
          embeddingProviderId: newDatasetEmbeddingProviderId,
          embeddingModel: newDatasetEmbeddingModel,
          chunkStrategy: newDatasetChunkStrategy,
        }),
      });
      setDatasets((current) => current.map((dataset) => dataset.id === updated.id ? updated : dataset));
      setStatus(`已更新知识库 ${updated.name}`);
      await refreshKnowledge();
      setSelectedDatasetId(updated.id);
      await selectDataset(updated.id);
      closeForm();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "知识库更新失败");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteDataset(dataset: DatasetRecord) {
    setBusyAction(`dataset-delete-${dataset.id}`);
    try {
      await call(`/api/aio/admin/datasets/${dataset.id}`, { method: "DELETE" });
      if (selectedDatasetId === dataset.id) {
        backToDatasetList();
      }
      setStatus(`已删除知识库 ${dataset.name}`);
      await refreshKnowledge();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "知识库删除失败");
    } finally {
      setBusyAction("");
    }
  }

  async function addDocument() {
    if (!selectedDatasetId) return;
    setBusyAction("document");
    try {
      await call(`/api/aio/admin/datasets/${selectedDatasetId}/documents`, {
        method: "POST",
        body: JSON.stringify({
          name: newDocumentName.trim() || "控制台文本文档",
          sourceType: `text:${textChunkMode}`,
          text: newDocumentText,
        }),
      });
      setStatus("文档已写入并完成轻量索引");
      await selectDataset(selectedDatasetId);
      closeForm();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "文档写入失败");
    } finally {
      setBusyAction("");
    }
  }

  async function uploadDocumentFile() {
    if (!selectedDatasetId || !knowledgeFile) return;
    setBusyAction("document-upload");
    try {
      const formData = new FormData();
      formData.append("file", knowledgeFile);
      await uploadForm(
        `/api/aio/admin/datasets/${selectedDatasetId}/documents/upload`,
        formData,
      );
      setKnowledgeFile(null);
      setStatus("文件已上传，已完成解析、拆分并写入向量入口");
      await selectDataset(selectedDatasetId);
      closeForm();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "文件上传失败");
    } finally {
      setBusyAction("");
    }
  }

  async function deleteDocument(document: DocumentRecord) {
    setBusyAction(`document-delete-${document.id}`);
    try {
      await call(`/api/aio/admin/documents/${document.id}`, { method: "DELETE" });
      if (sourceDocument?.id === document.id) {
        setSourceDocument(null);
      }
      if (chunkInspect?.document?.id === document.id) {
        setChunkInspect(null);
        setFormOpen("");
      }
      setStatus(`已删除文档 ${document.name}，并清理关联分块/索引数据`);
      await selectDataset(document.datasetId || selectedDatasetId);
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "文档删除失败");
    } finally {
      setBusyAction("");
    }
  }

  async function retrieveTest() {
    if (!selectedDatasetId) return;
    setBusyAction("retrieve");
    try {
      const response = await call<{ records: RetrieveRecord[] }>(
        `/api/aio/admin/datasets/${selectedDatasetId}/retrieve-test`,
        {
          method: "POST",
          body: JSON.stringify({ query: retrieveQuery, topK: 5, scoreThreshold: 0 }),
        },
      );
      setRetrieveRecords(response.records || []);
      setStatus(`检索完成：${response.records?.length || 0} 条命中`);
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "检索测试失败");
    } finally {
      setBusyAction("");
    }
  }

  return {
    datasets,
    documents,
    sourceDocument,
    chunkInspect,
    retrieveRecords,
    selectedDatasetId,
    loading,
    error,
    newDatasetName,
    newDatasetDescription,
    newDatasetEmbeddingProviderId,
    newDatasetEmbeddingModel,
    newDatasetChunkStrategy,
    newDocumentName,
    newDocumentText,
    retrieveQuery,
    documentSourceMode,
    textChunkMode,
    knowledgeFile,
    formOpen,
    busyAction,
    setNewDatasetName,
    setNewDatasetDescription,
    setNewDatasetEmbeddingProviderId,
    setNewDatasetEmbeddingModel,
    setNewDatasetChunkStrategy,
    setNewDocumentName,
    setNewDocumentText,
    setRetrieveQuery,
    setDocumentSourceMode,
    setTextChunkMode,
    setKnowledgeFile,
    openDatasetForm,
    openDatasetEdit,
    openDocumentForm,
    openDebugDrawer,
    openApiDrawer,
    openDatasetInfo,
    backToDatasetList,
    openSourceDocument,
    openDocumentChunks,
    closeForm,
    refreshKnowledge,
    selectDataset,
    createDataset,
    updateDataset,
    deleteDataset,
    addDocument,
    uploadDocumentFile,
    deleteDocument,
    retrieveTest,
  };
}
