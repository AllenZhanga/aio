package com.dxnow.aio.knowledge.api;

import com.dxnow.aio.knowledge.domain.KbChunk;
import com.dxnow.aio.knowledge.domain.KbDataset;
import com.dxnow.aio.knowledge.domain.KbDocument;
import com.dxnow.aio.knowledge.service.KnowledgeService;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/aio/admin")
public class AdminKnowledgeController {

  private final KnowledgeService knowledgeService;

  public AdminKnowledgeController(KnowledgeService knowledgeService) {
    this.knowledgeService = knowledgeService;
  }

  @GetMapping("/datasets")
  public List<DatasetResponse> listDatasets(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    return knowledgeService.listDatasets(tenantId, workspaceId).stream().map(DatasetResponse::from).collect(Collectors.toList());
  }

  @PostMapping("/datasets")
  public DatasetResponse createDataset(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @Valid @RequestBody DatasetRequest request) {
    return DatasetResponse.from(knowledgeService.createDataset(tenantId, workspaceId, request.toMutation()));
  }

  @GetMapping("/datasets/{datasetId}")
  public DatasetResponse getDataset(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId) {
    return DatasetResponse.from(knowledgeService.getDataset(tenantId, datasetId));
  }

  @PutMapping("/datasets/{datasetId}")
  public DatasetResponse updateDataset(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId,
      @Valid @RequestBody DatasetRequest request) {
    return DatasetResponse.from(knowledgeService.updateDataset(tenantId, datasetId, request.toMutation()));
  }

  @DeleteMapping("/datasets/{datasetId}")
  public void deleteDataset(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId) {
    knowledgeService.deleteDataset(tenantId, datasetId);
  }

  @PostMapping("/datasets/{datasetId}/documents")
  public DocumentResponse addDocument(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId,
      @Valid @RequestBody DocumentRequest request) {
    return DocumentResponse.from(knowledgeService.addDocument(tenantId, datasetId, request.toMutation()));
  }

  @PostMapping("/datasets/{datasetId}/documents/upload")
  public DocumentResponse uploadDocument(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId,
      @RequestParam("file") MultipartFile file) throws IOException {
    KnowledgeService.UploadedDocumentMutation request = new KnowledgeService.UploadedDocumentMutation();
    request.name = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank() ? "Uploaded Document" : file.getOriginalFilename();
    request.contentType = file.getContentType();
    request.bytes = file.getBytes();
    return DocumentResponse.from(knowledgeService.addUploadedDocument(tenantId, datasetId, request));
  }

  @GetMapping("/datasets/{datasetId}/documents")
  public List<DocumentResponse> listDocuments(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId) {
    return knowledgeService.listDocuments(tenantId, datasetId).stream().map(DocumentResponse::from).collect(Collectors.toList());
  }

  @GetMapping("/documents/{documentId}")
  public DocumentResponse getDocument(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String documentId) {
    return DocumentResponse.from(knowledgeService.getDocument(tenantId, documentId));
  }

  @DeleteMapping("/documents/{documentId}")
  public void deleteDocument(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String documentId) {
    knowledgeService.deleteDocument(tenantId, documentId);
  }

  @GetMapping("/documents/{documentId}/chunks")
  public ChunkInspectResponse getDocumentChunks(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String documentId) {
    KbDocument document = knowledgeService.getDocument(tenantId, documentId);
    KbDataset dataset = knowledgeService.getDataset(tenantId, document.getDatasetId());
    return ChunkInspectResponse.from(document, dataset, knowledgeService.listDocumentChunks(tenantId, documentId));
  }

  @PostMapping("/documents/{documentId}/reindex")
  public DocumentResponse reindex(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String documentId) {
    return DocumentResponse.from(knowledgeService.reindex(tenantId, documentId));
  }

  @PostMapping("/datasets/{datasetId}/retrieve-test")
  public Map<String, Object> retrieveTest(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId,
      @RequestBody RetrieveRequest request) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("records", knowledgeService.retrieve(tenantId, datasetId, request.query, request.topK, request.scoreThreshold));
    return response;
  }

  public static class DatasetRequest {
    @NotBlank @Size(max = 160) public String name;
    public String description;
    public String embeddingProviderId;
    public String embeddingModel;
    public String chunkStrategy;

    KnowledgeService.DatasetMutation toMutation() {
      KnowledgeService.DatasetMutation mutation = new KnowledgeService.DatasetMutation();
      mutation.name = name;
      mutation.description = description;
      mutation.embeddingProviderId = embeddingProviderId;
      mutation.embeddingModel = embeddingModel;
      mutation.chunkStrategy = chunkStrategy;
      return mutation;
    }
  }

  public static class DocumentRequest {
    @Size(max = 220) public String name;
    public String sourceType;
    public String text;

    KnowledgeService.DocumentMutation toMutation() {
      KnowledgeService.DocumentMutation mutation = new KnowledgeService.DocumentMutation();
      mutation.name = name;
      mutation.sourceType = sourceType;
      mutation.text = text;
      return mutation;
    }
  }

  public static class RetrieveRequest {
    public String query;
    public int topK = 5;
    public double scoreThreshold = 0.0;
  }

  public static class DatasetResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String name;
    public String description;
    public String embeddingProviderId;
    public String embeddingModel;
    public String chunkStrategy;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static DatasetResponse from(KbDataset dataset) {
      DatasetResponse response = new DatasetResponse();
      response.id = dataset.getId();
      response.tenantId = dataset.getTenantId();
      response.workspaceId = dataset.getWorkspaceId();
      response.name = dataset.getName();
      response.description = dataset.getDescription();
      response.embeddingProviderId = dataset.getEmbeddingProviderId();
      response.embeddingModel = dataset.getEmbeddingModel();
      response.chunkStrategy = dataset.getChunkStrategy();
      response.status = dataset.getStatus();
      response.createdAt = dataset.getCreatedAt();
      response.updatedAt = dataset.getUpdatedAt();
      return response;
    }
  }

  public static class DocumentResponse {
    public String id;
    public String datasetId;
    public String name;
    public String sourceType;
    public String objectKey;
    public String contentText;
    public String parseStatus;
    public String indexStatus;
    public String errorMessage;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static DocumentResponse from(KbDocument document) {
      DocumentResponse response = new DocumentResponse();
      response.id = document.getId();
      response.datasetId = document.getDatasetId();
      response.name = document.getName();
      response.sourceType = document.getSourceType();
      response.objectKey = document.getObjectKey();
      response.contentText = document.getContentText();
      response.parseStatus = document.getParseStatus();
      response.indexStatus = document.getIndexStatus();
      response.errorMessage = document.getErrorMessage();
      response.createdAt = document.getCreatedAt();
      response.updatedAt = document.getUpdatedAt();
      return response;
    }
  }

  public static class ChunkInspectResponse {
    public DocumentResponse document;
    public DatasetResponse dataset;
    public Map<String, Object> parse;
    public List<ChunkResponse> chunks;

    static ChunkInspectResponse from(KbDocument document, KbDataset dataset, List<KbChunk> chunks) {
      ChunkInspectResponse response = new ChunkInspectResponse();
      response.document = DocumentResponse.from(document);
      response.dataset = DatasetResponse.from(dataset);
      response.parse = parseSummary(document, dataset, chunks);
      response.chunks = chunks.stream()
          .map(chunk -> ChunkResponse.from(chunk, dataset))
          .collect(Collectors.toList());
      return response;
    }

    private static Map<String, Object> parseSummary(KbDocument document, KbDataset dataset, List<KbChunk> chunks) {
      Map<String, Object> summary = new LinkedHashMap<>();
      String sourceType = document.getSourceType() == null ? "text" : document.getSourceType();
      String actualStrategy = actualStrategy(sourceType, dataset.getChunkStrategy());
      summary.put("source_type", sourceType);
      summary.put("dataset_strategy", dataset.getChunkStrategy());
      summary.put("actual_strategy", actualStrategy);
      summary.put("algorithm", algorithmDescription(sourceType, actualStrategy));
      summary.put("chunk_size", 1200);
      summary.put("source_chars", document.getContentText() == null ? 0 : document.getContentText().length());
      summary.put("total_chunks", chunks.size());
      summary.put("parse_status", document.getParseStatus());
      summary.put("index_status", document.getIndexStatus());
      summary.put("embedding_provider_id", dataset.getEmbeddingProviderId());
      summary.put("embedding_model", dataset.getEmbeddingModel());
      summary.put("vector_status", aggregateVectorStatus(chunks));
      summary.put("embedded_chunks", chunks.stream().filter(chunk -> "embedded".equals(chunk.getVectorStatus())).count());
      summary.put("vector_note", vectorNote(aggregateVectorStatus(chunks)));
      return summary;
    }

    private static String aggregateVectorStatus(List<KbChunk> chunks) {
      if (chunks.isEmpty()) return "not_indexed";
      long embedded = chunks.stream().filter(chunk -> "embedded".equals(chunk.getVectorStatus())).count();
      long failed = chunks.stream().filter(chunk -> "embedding_failed".equals(chunk.getVectorStatus())).count();
      if (embedded == chunks.size()) return "embedded";
      if (failed > 0 && embedded > 0) return "partial";
      if (failed > 0) return "embedding_failed";
      return "lightweight_text_index";
    }

    private static String vectorNote(String status) {
      if ("embedded".equals(status)) return "所有 chunk 已通过配置的 Embedding Provider 生成向量并写入向量入口。";
      if ("partial".equals(status)) return "部分 chunk 已生成真实 embedding，失败项保留轻量索引入口，可检查文档错误信息后重试。";
      if ("embedding_failed".equals(status)) return "已完成解析和分块，但 Embedding Provider 调用失败，当前仅保留轻量索引入口。";
      return "未配置可用 Embedding Provider 时，系统会先保存 chunk 级向量入口 ID 与文本检索特征。";
    }

    private static String actualStrategy(String sourceType, String datasetStrategy) {
      if ("text:raw".equals(sourceType) || "text:single".equals(sourceType)) return "raw";
      if ("text:paragraph".equals(sourceType) || "text:qa".equals(sourceType)) return sourceType.substring("text:".length());
      if ("raw".equals(datasetStrategy) || "paragraph".equals(datasetStrategy) || "qa".equals(datasetStrategy) || "ai".equals(datasetStrategy)) return datasetStrategy;
      return "fixed";
    }

    private static String algorithmDescription(String sourceType, String actualStrategy) {
      if ("text:raw".equals(sourceType) || "text:single".equals(sourceType)) {
        return "保留原文为单个 chunk，不做二次切分。";
      }
      String parser = "";
      if ("pdf".equals(sourceType)) parser = "先使用 Apache Tika 提取 PDF 文本和元数据；扫描版 PDF 需部署 OCR 组件后才能抽取图片文字。";
      if ("excel".equals(sourceType)) parser = "先使用 Apache Tika 读取工作簿单元格文本，并将表格内容线性化。";
      if ("image".equals(sourceType)) parser = "先提取图片元数据；部署环境安装 Tesseract OCR 后会尝试抽取中英文图片文字。";
      if ("raw".equals(actualStrategy)) return parser + "随后保留解析结果为单个 chunk。";
      if ("ai".equals(actualStrategy)) return parser + "随后调用知识库绑定模型供应商的 LLM 进行语义智能分块，按主题、标题层级、问答边界和条款连续性生成 chunk；LLM 不可用时自动回退到固定分块。";
      if ("paragraph".equals(actualStrategy)) return parser + "随后按空行和自然段切分，保留段落边界；超长段落按 1200 字符兜底切分。";
      if ("qa".equals(actualStrategy)) return parser + "随后按 Q/A、问/答、Question/Answer 标记聚合问答对；未识别标记时退化为段落分块。";
      return parser + "随后先按空行识别段落，再按约 1200 字符上限合并；超长段落按固定长度切分。";
    }
  }

  public static class ChunkResponse {
    public String id;
    public String documentId;
    public int chunkNo;
    public String content;
    public int contentChars;
    public Integer tokenCount;
    public String metadata;
    public String vectorId;
    public String vectorStatus;
    public String embeddingProviderId;
    public String embeddingModel;
    public Integer embeddingDimension;
    public OffsetDateTime createdAt;

    static ChunkResponse from(KbChunk chunk, KbDataset dataset) {
      ChunkResponse response = new ChunkResponse();
      response.id = chunk.getId();
      response.documentId = chunk.getDocumentId();
      response.chunkNo = chunk.getChunkNo();
      response.content = chunk.getContent();
      response.contentChars = chunk.getContent() == null ? 0 : chunk.getContent().length();
      response.tokenCount = chunk.getTokenCount();
      response.metadata = chunk.getMetadataJson();
      response.vectorId = chunk.getVectorId();
      response.vectorStatus = chunk.getVectorStatus() == null ? "lightweight_text_index" : chunk.getVectorStatus();
      response.embeddingProviderId = chunk.getEmbeddingProviderId() == null ? dataset.getEmbeddingProviderId() : chunk.getEmbeddingProviderId();
      response.embeddingModel = chunk.getEmbeddingModel() == null ? dataset.getEmbeddingModel() : chunk.getEmbeddingModel();
      response.embeddingDimension = chunk.getEmbeddingDimension();
      response.createdAt = chunk.getCreatedAt();
      return response;
    }
  }
}