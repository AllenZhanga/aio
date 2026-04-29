import { useState } from "react";
import type { DatasetRecord, DocumentRecord, RetrieveRecord } from "../types";

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
  const [formOpen, setFormOpen] = useState<"dataset" | "document" | "debug" | "api" | "source" | "">("");
  const [busyAction, setBusyAction] = useState("");

  function openDatasetForm() {
    setFormOpen("dataset");
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

  function backToDatasetList() {
    setSelectedDatasetId("");
    setDocuments([]);
    setRetrieveRecords([]);
    setSourceDocument(null);
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

  async function deleteDataset(dataset: DatasetRecord) {
    if (!window.confirm(`确认删除知识库「${dataset.name}」？删除后会同时清理该知识库下的文档和索引片段。`)) return;
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
      setStatus("文件已上传、解析并写入索引");
      await selectDataset(selectedDatasetId);
      closeForm();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "文件上传失败");
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
    openDocumentForm,
    openDebugDrawer,
    openApiDrawer,
    backToDatasetList,
    openSourceDocument,
    closeForm,
    refreshKnowledge,
    selectDataset,
    createDataset,
    deleteDataset,
    addDocument,
    uploadDocumentFile,
    retrieveTest,
  };
}
