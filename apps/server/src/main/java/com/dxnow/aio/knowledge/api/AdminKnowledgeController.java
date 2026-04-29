package com.dxnow.aio.knowledge.api;

import com.dxnow.aio.knowledge.domain.KbDataset;
import com.dxnow.aio.knowledge.domain.KbDocument;
import com.dxnow.aio.knowledge.service.KnowledgeService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    DocumentRequest request = new DocumentRequest();
    request.name = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank() ? "Uploaded Document" : file.getOriginalFilename();
    request.sourceType = detectSourceType(request.name);
    request.text = new String(file.getBytes(), StandardCharsets.UTF_8);
    return DocumentResponse.from(knowledgeService.addDocument(tenantId, datasetId, request.toMutation()));
  }

  @GetMapping("/datasets/{datasetId}/documents")
  public List<DocumentResponse> listDocuments(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String datasetId) {
    return knowledgeService.listDocuments(tenantId, datasetId).stream().map(DocumentResponse::from).collect(Collectors.toList());
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

  private static String detectSourceType(String name) {
    String lower = name == null ? "" : name.toLowerCase();
    if (lower.endsWith(".md")) return "markdown";
    if (lower.endsWith(".csv")) return "csv";
    if (lower.endsWith(".json")) return "json";
    return "file";
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
      response.parseStatus = document.getParseStatus();
      response.indexStatus = document.getIndexStatus();
      response.errorMessage = document.getErrorMessage();
      response.createdAt = document.getCreatedAt();
      response.updatedAt = document.getUpdatedAt();
      return response;
    }
  }
}