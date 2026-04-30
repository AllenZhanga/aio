package com.dxnow.aio.knowledge.service;

import com.dxnow.aio.common.CryptoService;
import com.dxnow.aio.common.Ids;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import com.dxnow.aio.knowledge.domain.KbChunk;
import com.dxnow.aio.knowledge.domain.KbDataset;
import com.dxnow.aio.knowledge.domain.KbDocument;
import com.dxnow.aio.knowledge.repository.KbChunkRepository;
import com.dxnow.aio.knowledge.repository.KbDatasetRepository;
import com.dxnow.aio.knowledge.repository.KbDocumentRepository;
import com.dxnow.aio.provider.domain.ModelProviderAccount;
import com.dxnow.aio.provider.repository.ModelProviderAccountRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import javax.persistence.EntityNotFoundException;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class KnowledgeService {

  private static final int DEFAULT_CHUNK_SIZE = 1200;
  private static final int MAX_EXTRACTED_CHARS = 500_000;

  private final WorkspaceRepository workspaceRepository;
  private final KbDatasetRepository datasetRepository;
  private final KbDocumentRepository documentRepository;
  private final KbChunkRepository chunkRepository;
  private final ModelProviderAccountRepository providerRepository;
  private final CryptoService cryptoService;
  private final ObjectMapper objectMapper;
  private final RestTemplate restTemplate = new RestTemplate();
  private final Tika tika = new Tika();

  public KnowledgeService(
      WorkspaceRepository workspaceRepository,
      KbDatasetRepository datasetRepository,
      KbDocumentRepository documentRepository,
      KbChunkRepository chunkRepository,
      ModelProviderAccountRepository providerRepository,
      CryptoService cryptoService,
      ObjectMapper objectMapper) {
    this.workspaceRepository = workspaceRepository;
    this.datasetRepository = datasetRepository;
    this.documentRepository = documentRepository;
    this.chunkRepository = chunkRepository;
    this.providerRepository = providerRepository;
    this.cryptoService = cryptoService;
    this.objectMapper = objectMapper;
  }

  public List<KbDataset> listDatasets(String tenantId, String workspaceId) {
    requireWorkspace(tenantId, workspaceId);
    return datasetRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
  }

  public KbDataset getDataset(String tenantId, String datasetId) {
    return datasetRepository.findByTenantIdAndId(tenantId, datasetId)
        .orElseThrow(() -> new EntityNotFoundException("Dataset not found"));
  }

  @Transactional
  public KbDataset createDataset(String tenantId, String workspaceId, DatasetMutation request) {
    requireWorkspace(tenantId, workspaceId);
    KbDataset dataset = new KbDataset();
    dataset.setId(Ids.prefixed("kb"));
    dataset.setTenantId(tenantId);
    dataset.setWorkspaceId(workspaceId);
    dataset.setName(request.name);
    dataset.setDescription(request.description);
    dataset.setEmbeddingProviderId(request.embeddingProviderId);
    dataset.setEmbeddingModel(request.embeddingModel);
    dataset.setChunkStrategy(request.chunkStrategy == null || request.chunkStrategy.isBlank() ? "fixed" : request.chunkStrategy);
    dataset.setStatus("active");
    return datasetRepository.save(dataset);
  }

  @Transactional
  public KbDataset updateDataset(String tenantId, String datasetId, DatasetMutation request) {
    KbDataset dataset = getDataset(tenantId, datasetId);
    if (request.name != null && !request.name.isBlank()) dataset.setName(request.name);
    if (request.description != null) dataset.setDescription(request.description);
    if (request.embeddingProviderId != null) dataset.setEmbeddingProviderId(blankToNull(request.embeddingProviderId));
    if (request.embeddingModel != null) dataset.setEmbeddingModel(blankToNull(request.embeddingModel));
    if (request.chunkStrategy != null && !request.chunkStrategy.isBlank()) dataset.setChunkStrategy(request.chunkStrategy);
    return datasetRepository.save(dataset);
  }

  @Transactional
  public void deleteDataset(String tenantId, String datasetId) {
    KbDataset dataset = getDataset(tenantId, datasetId);
    chunkRepository.deleteByTenantIdAndDatasetId(tenantId, dataset.getId());
    documentRepository.deleteByTenantIdAndDatasetId(tenantId, dataset.getId());
    datasetRepository.delete(dataset);
  }

  public List<KbDocument> listDocuments(String tenantId, String datasetId) {
    getDataset(tenantId, datasetId);
    return documentRepository.findByTenantIdAndDatasetIdOrderByCreatedAtDesc(tenantId, datasetId);
  }

  public KbDocument getDocument(String tenantId, String documentId) {
    return documentRepository.findByTenantIdAndId(tenantId, documentId)
        .orElseThrow(() -> new EntityNotFoundException("Document not found"));
  }

  @Transactional
  public void deleteDocument(String tenantId, String documentId) {
    KbDocument document = getDocument(tenantId, documentId);
    chunkRepository.deleteByTenantIdAndDocumentId(tenantId, document.getId());
    documentRepository.delete(document);
  }

  public List<KbChunk> listDocumentChunks(String tenantId, String documentId) {
    getDocument(tenantId, documentId);
    return chunkRepository.findByTenantIdAndDocumentIdOrderByChunkNoAsc(tenantId, documentId);
  }

  @Transactional
  public KbDocument addDocument(String tenantId, String datasetId, DocumentMutation request) {
    KbDataset dataset = getDataset(tenantId, datasetId);
    KbDocument document = newDocument(dataset, request.name, request.sourceType == null || request.sourceType.isBlank() ? "text" : request.sourceType);
    document.setContentText(request.text == null ? "" : request.text);
    document.setParseStatus("success");
    document.setIndexStatus("running");
    KbDocument saved = documentRepository.save(document);
    IndexResult result = indexDocument(saved, dataset);
    saved.setIndexStatus(result.documentStatus());
    saved.setErrorMessage(result.errorMessage());
    return documentRepository.save(saved);
  }

  @Transactional
  public KbDocument addUploadedDocument(String tenantId, String datasetId, UploadedDocumentMutation request) {
    KbDataset dataset = getDataset(tenantId, datasetId);
    String name = request.name == null || request.name.isBlank() ? "Uploaded Document" : request.name;
    String sourceType = detectSourceType(name, request.contentType);
    KbDocument document = newDocument(dataset, name, sourceType);
    try {
      ParsedDocument parsed = parseUploadedDocument(request, sourceType);
      document.setContentText(parsed.text);
      document.setParseStatus("success");
      document.setIndexStatus("running");
      KbDocument saved = documentRepository.save(document);
      IndexResult result = indexDocument(saved, dataset);
      saved.setIndexStatus(result.documentStatus());
      saved.setErrorMessage(result.errorMessage());
      return documentRepository.save(saved);
    } catch (IOException | TikaException exception) {
      document.setContentText(fileFallbackText(name, sourceType, request.contentType, request.bytes == null ? 0 : request.bytes.length, null));
      document.setParseStatus("failed");
      document.setIndexStatus("failed");
      document.setErrorMessage("文件解析失败: " + exception.getMessage());
      return documentRepository.save(document);
    }
  }

  @Transactional
  public KbDocument reindex(String tenantId, String documentId) {
    KbDocument document = documentRepository.findByTenantIdAndId(tenantId, documentId)
        .orElseThrow(() -> new EntityNotFoundException("Document not found"));
    KbDataset dataset = getDataset(tenantId, document.getDatasetId());
    document.setIndexStatus("running");
    documentRepository.save(document);
    IndexResult result = indexDocument(document, dataset);
    document.setParseStatus("success");
    document.setIndexStatus(result.documentStatus());
    document.setErrorMessage(result.errorMessage());
    return documentRepository.save(document);
  }

  public List<Map<String, Object>> retrieve(String tenantId, String datasetId, String query, int topK, double scoreThreshold) {
    getDataset(tenantId, datasetId);
    String normalizedQuery = normalize(query);
    List<String> terms = splitTerms(normalizedQuery);
    int limit = topK <= 0 ? 5 : topK;
    return chunkRepository.findByTenantIdAndDatasetId(tenantId, datasetId).stream()
        .map(chunk -> score(chunk, normalizedQuery, terms))
        .filter(record -> ((Number) record.get("score")).doubleValue() >= scoreThreshold)
        .sorted(Comparator.comparingDouble((Map<String, Object> record) -> ((Number) record.get("score")).doubleValue()).reversed())
        .limit(limit)
        .collect(Collectors.toList());
  }

  @Transactional
  protected IndexResult indexDocument(KbDocument document, KbDataset dataset) {
    chunkRepository.deleteByTenantIdAndDocumentId(document.getTenantId(), document.getId());
    String actualChunkStrategy = effectiveChunkStrategy(document.getSourceType(), dataset.getChunkStrategy());
    List<String> chunks = chunkText(document.getContentText(), document.getSourceType(), dataset);
    EmbeddingTarget embeddingTarget = resolveEmbeddingTarget(dataset);
    IndexResult result = new IndexResult();
    int index = 0;
    for (String content : chunks) {
      KbChunk chunk = new KbChunk();
      chunk.setId(Ids.prefixed("chunk"));
      chunk.setTenantId(document.getTenantId());
      chunk.setWorkspaceId(document.getWorkspaceId());
      chunk.setDatasetId(document.getDatasetId());
      chunk.setDocumentId(document.getId());
      chunk.setChunkNo(index++);
      chunk.setContent(content);
      chunk.setTokenCount(Math.max(1, content.length() / 4));
      VectorEntry vectorEntry = createVectorEntry(embeddingTarget, content, chunk.getId());
      chunk.setVectorId(vectorEntry.vectorId);
      chunk.setVectorStatus(vectorEntry.status);
      chunk.setEmbeddingProviderId(vectorEntry.embeddingProviderId);
      chunk.setEmbeddingModel(vectorEntry.embeddingModel);
      chunk.setEmbeddingDimension(vectorEntry.embeddingDimension);
      chunk.setEmbeddingVector(vectorEntry.embeddingVector);
      if (vectorEntry.errorMessage != null) {
        result.addError("Chunk #" + index + " 向量写入失败: " + vectorEntry.errorMessage);
      }
      Map<String, Object> metadata = new LinkedHashMap<>();
      metadata.put("source", document.getName());
      metadata.put("source_type", document.getSourceType());
      metadata.put("chunk_strategy", actualChunkStrategy);
      metadata.put("object_key", document.getObjectKey());
      metadata.put("vector_status", vectorEntry.status);
      if (vectorEntry.errorMessage != null) metadata.put("vector_error", vectorEntry.errorMessage);
      chunk.setMetadataJson(toJson(metadata));
      chunkRepository.save(chunk);
    }
    return result;
  }

  private KbDocument newDocument(KbDataset dataset, String name, String sourceType) {
    KbDocument document = new KbDocument();
    document.setId(Ids.prefixed("doc"));
    document.setTenantId(dataset.getTenantId());
    document.setWorkspaceId(dataset.getWorkspaceId());
    document.setDatasetId(dataset.getId());
    document.setName(name == null || name.isBlank() ? "Untitled Document" : name);
    document.setSourceType(sourceType == null || sourceType.isBlank() ? "text" : sourceType);
    document.setObjectKey("tenants/" + dataset.getTenantId() + "/workspaces/" + dataset.getWorkspaceId() + "/datasets/" + dataset.getId() + "/documents/" + document.getId());
    return document;
  }

  private ParsedDocument parseUploadedDocument(UploadedDocumentMutation request, String sourceType) throws IOException, TikaException {
    byte[] bytes = request.bytes == null ? new byte[0] : request.bytes;
    String name = request.name == null || request.name.isBlank() ? "Uploaded Document" : request.name;
    Metadata metadata = new Metadata();
    metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, name);
    if (request.contentType != null && !request.contentType.isBlank()) {
      metadata.set(Metadata.CONTENT_TYPE, request.contentType);
    }
    String extracted = tika.parseToString(new ByteArrayInputStream(bytes), metadata, MAX_EXTRACTED_CHARS);
    String text = normalizeExtractedText(extracted);
    if (text.isBlank() && "image".equals(sourceType)) {
      text = normalizeExtractedText(tryImageOcr(bytes, name));
    }
    if (text.isBlank()) {
      text = fileFallbackText(name, sourceType, request.contentType, bytes.length, metadata);
    } else {
      String metadataText = metadataText(metadata);
      if (!metadataText.isBlank() && ("image".equals(sourceType) || "pdf".equals(sourceType) || "excel".equals(sourceType))) {
        text = text + "\n\n--- 文件元信息 ---\n" + metadataText;
      }
    }
    return new ParsedDocument(text);
  }

  private String normalizeExtractedText(String value) {
    if (value == null) {
      return "";
    }
    return value
        .replace('\u0000', ' ')
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replaceAll("[ \\t\\x0B\\f]+", " ")
        .replaceAll("\n{3,}", "\n\n")
        .trim();
  }

  private String fileFallbackText(String name, String sourceType, String contentType, int size, Metadata metadata) {
    StringBuilder builder = new StringBuilder();
    builder.append("文件：").append(name == null ? "Uploaded Document" : name).append('\n');
    builder.append("类型：").append(sourceType == null ? "binary" : sourceType).append('\n');
    if (contentType != null && !contentType.isBlank()) {
      builder.append("MIME：").append(contentType).append('\n');
    }
    builder.append("大小：").append(size).append(" bytes\n");
    String metadataText = metadataText(metadata);
    if (!metadataText.isBlank()) {
      builder.append("\n--- 文件元信息 ---\n").append(metadataText).append('\n');
    }
    if ("image".equals(sourceType)) {
      builder.append("\n提示：未检测到可抽取文字；如需图片文字，请在部署环境安装 Tesseract OCR 后重新上传。");
    } else {
      builder.append("\n提示：该文件未抽取到可索引文本，请检查文件内容、加密状态或解析组件支持情况。");
    }
    return builder.toString().trim();
  }

  private String metadataText(Metadata metadata) {
    if (metadata == null) {
      return "";
    }
    String[] names = metadata.names();
    Arrays.sort(names);
    StringBuilder builder = new StringBuilder();
    int count = 0;
    for (String name : names) {
      if (count >= 32) {
        break;
      }
      String value = metadata.get(name);
      if (value != null && !value.isBlank()) {
        builder.append(name).append(": ").append(value.trim()).append('\n');
        count++;
      }
    }
    return builder.toString().trim();
  }

  private String tryImageOcr(byte[] bytes, String name) {
    Path tempFile = null;
    try {
      if (!tesseractAvailable()) {
        return "";
      }
      tempFile = Files.createTempFile("aio-ocr-", imageSuffix(name));
      Files.write(tempFile, bytes);
      Process process = new ProcessBuilder("tesseract", tempFile.toString(), "stdout", "-l", "chi_sim+eng")
          .redirectErrorStream(true)
          .start();
      if (!process.waitFor(30, TimeUnit.SECONDS)) {
        process.destroyForcibly();
        return "";
      }
      if (process.exitValue() != 0) {
        return "";
      }
      return new String(process.getInputStream().readAllBytes());
    } catch (IOException | InterruptedException exception) {
      if (exception instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      return "";
    } finally {
      if (tempFile != null) {
        try {
          Files.deleteIfExists(tempFile);
        } catch (IOException ignored) {
          // ignore temporary cleanup failure
        }
      }
    }
  }

  private boolean tesseractAvailable() {
    try {
      Process process = new ProcessBuilder("tesseract", "--version")
          .redirectErrorStream(true)
          .start();
      if (!process.waitFor(5, TimeUnit.SECONDS)) {
        process.destroyForcibly();
        return false;
      }
      return process.exitValue() == 0;
    } catch (IOException | InterruptedException exception) {
      if (exception instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      return false;
    }
  }

  private String imageSuffix(String name) {
    String lower = name == null ? "" : name.toLowerCase(Locale.ROOT);
    int dot = lower.lastIndexOf('.');
    if (dot >= 0 && dot < lower.length() - 1 && lower.length() - dot <= 8) {
      String suffix = lower.substring(dot).replaceAll("[^a-z0-9.]", "");
      return suffix.isBlank() ? ".img" : suffix;
    }
    return ".img";
  }

  private EmbeddingTarget resolveEmbeddingTarget(KbDataset dataset) {
    if (dataset.getEmbeddingProviderId() == null || dataset.getEmbeddingProviderId().isBlank()) {
      return EmbeddingTarget.unavailable(dataset.getEmbeddingProviderId(), dataset.getEmbeddingModel(), "未配置 Embedding Provider，使用轻量文本索引入口。");
    }
    Optional<ModelProviderAccount> providerOptional = providerRepository.findByTenantIdAndId(dataset.getTenantId(), dataset.getEmbeddingProviderId());
    if (providerOptional.isEmpty()) {
      return EmbeddingTarget.unavailable(dataset.getEmbeddingProviderId(), dataset.getEmbeddingModel(), "Embedding Provider 不存在。");
    }
    ModelProviderAccount provider = providerOptional.get();
    String model = firstNonBlank(dataset.getEmbeddingModel(), provider.effectiveEmbeddingModel());
    String baseUrl = provider.getEmbeddingBaseUrl();
    String keyCiphertext = provider.getEmbeddingApiKeyCiphertext();
    if (!"active".equals(provider.getStatus()) || baseUrl == null || baseUrl.isBlank() || keyCiphertext == null || keyCiphertext.isBlank() || model == null || model.isBlank()) {
      return EmbeddingTarget.unavailable(provider.getId(), model, "Embedding Provider 未启用或缺少 baseUrl/apiKey/model，使用轻量文本索引入口。");
    }
    return EmbeddingTarget.available(provider.getId(), model, embeddingEndpoint(baseUrl), cryptoService.decrypt(keyCiphertext));
  }

  private VectorEntry createVectorEntry(EmbeddingTarget target, String content, String fallbackVectorId) {
    if (!target.available || content == null || content.isBlank()) {
      return VectorEntry.lightweight(fallbackVectorId, target.providerId, target.model);
    }
    try {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      headers.setBearerAuth(target.apiKey);
      Map<String, Object> body = new LinkedHashMap<>();
      body.put("model", target.model);
      body.put("input", content);
      ResponseEntity<String> response = restTemplate.postForEntity(target.endpoint, new HttpEntity<>(body, headers), String.class);
      JsonNode embedding = objectMapper.readTree(response.getBody()).path("data").path(0).path("embedding");
      if (!embedding.isArray()) {
        throw new IllegalStateException("Embedding response missing data[0].embedding");
      }
      return VectorEntry.embedded(Ids.prefixed("vec"), target.providerId, target.model, embedding.size(), embedding.toString());
    } catch (Exception exception) {
      return VectorEntry.failed(fallbackVectorId, target.providerId, target.model, exception.getMessage());
    }
  }

  private String embeddingEndpoint(String baseUrl) {
    String trimmed = baseUrl.trim();
    if (trimmed.endsWith("/")) {
      trimmed = trimmed.substring(0, trimmed.length() - 1);
    }
    if (trimmed.endsWith("/embeddings")) {
      return trimmed;
    }
    return trimmed + "/embeddings";
  }

  private String detectSourceType(String name, String contentType) {
    String lower = name == null ? "" : name.toLowerCase(Locale.ROOT);
    String mime = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".md") || mime.contains("markdown")) return "markdown";
    if (lower.endsWith(".csv") || mime.contains("csv")) return "csv";
    if (lower.endsWith(".json") || mime.contains("json")) return "json";
    if (lower.endsWith(".txt") || mime.startsWith("text/")) return "text:file";
    if (lower.endsWith(".pdf") || mime.equals("application/pdf")) return "pdf";
    if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || mime.contains("spreadsheet") || mime.contains("excel")) return "excel";
    if (lower.endsWith(".doc") || lower.endsWith(".docx") || mime.contains("word")) return "word";
    if (lower.endsWith(".ppt") || lower.endsWith(".pptx") || mime.contains("presentation")) return "powerpoint";
    if (mime.startsWith("image/") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".tif") || lower.endsWith(".tiff") || lower.endsWith(".bmp")) return "image";
    return "binary";
  }

  private static String firstNonBlank(String first, String second) {
    return first != null && !first.isBlank() ? first : second;
  }

  private String toJson(Map<String, Object> value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException exception) {
      return "{}";
    }
  }

  private Map<String, Object> score(KbChunk chunk, String normalizedQuery, List<String> terms) {
    String content = normalize(chunk.getContent());
    double matches = 0;
    for (String term : terms) {
      if (!term.isBlank() && content.contains(term)) {
        matches += 1;
      }
    }
    double score = terms.isEmpty() ? 0.01 : matches / terms.size();
    if (!normalizedQuery.isBlank() && content.contains(normalizedQuery)) {
      score = Math.max(score, 0.95);
    }
    if (score == 0 && normalizedQuery.isBlank()) {
      score = 0.01;
    }
    Map<String, Object> record = new LinkedHashMap<>();
    record.put("chunk_id", chunk.getId());
    record.put("document_id", chunk.getDocumentId());
    record.put("content", chunk.getContent());
    record.put("score", score);
    record.put("metadata", chunk.getMetadataJson());
    return record;
  }

  private List<String> chunkText(String text, String sourceType, KbDataset dataset) {
    String source = text == null ? "" : text.trim();
    if (source.isBlank()) {
      List<String> chunks = new ArrayList<>();
      chunks.add("");
      return chunks;
    }

    String strategy = effectiveChunkStrategy(sourceType, dataset.getChunkStrategy());
    if ("raw".equals(strategy)) {
      List<String> chunks = new ArrayList<>();
      chunks.add(source);
      return chunks;
    }

    if ("ai".equals(strategy)) {
      List<String> chunks = chunkAi(source, dataset);
      if (!chunks.isEmpty()) {
        return chunks;
      }
    }

    if ("qa".equals(strategy)) {
      List<String> chunks = chunkQa(source);
      if (!chunks.isEmpty()) {
        return chunks;
      }
    }

    if ("paragraph".equals(strategy)) {
      List<String> chunks = chunkParagraphs(source);
      if (!chunks.isEmpty()) {
        return chunks;
      }
    }

    return chunkFixed(source);
  }

  private String effectiveChunkStrategy(String sourceType, String datasetStrategy) {
    if ("text:raw".equals(sourceType) || "text:single".equals(sourceType)) return "raw";
    if ("text:paragraph".equals(sourceType)) return "paragraph";
    if ("text:qa".equals(sourceType)) return "qa";
    if ("raw".equals(datasetStrategy) || "paragraph".equals(datasetStrategy) || "qa".equals(datasetStrategy) || "ai".equals(datasetStrategy)) {
      return datasetStrategy;
    }
    return "fixed";
  }

  private List<String> chunkAi(String source, KbDataset dataset) {
    Optional<LlmTarget> target = resolveChunkingLlmTarget(dataset);
    if (target.isEmpty()) {
      return new ArrayList<>();
    }
    List<String> chunks = new ArrayList<>();
    for (String section : splitForAiChunking(source)) {
      List<String> sectionChunks = callAiChunker(target.get(), section);
      if (sectionChunks.isEmpty()) {
        return new ArrayList<>();
      }
      chunks.addAll(sectionChunks);
    }
    return chunks;
  }

  private Optional<LlmTarget> resolveChunkingLlmTarget(KbDataset dataset) {
    if (dataset.getEmbeddingProviderId() == null || dataset.getEmbeddingProviderId().isBlank()) {
      return Optional.empty();
    }
    Optional<ModelProviderAccount> providerOptional = providerRepository.findByTenantIdAndId(dataset.getTenantId(), dataset.getEmbeddingProviderId());
    if (providerOptional.isEmpty()) {
      return Optional.empty();
    }
    ModelProviderAccount provider = providerOptional.get();
    String baseUrl = provider.effectiveLlmBaseUrl();
    String keyCiphertext = provider.effectiveLlmApiKeyCiphertext();
    String model = provider.effectiveLlmModel();
    if (!"active".equals(provider.getStatus()) || baseUrl == null || baseUrl.isBlank() || keyCiphertext == null || keyCiphertext.isBlank() || model == null || model.isBlank()) {
      return Optional.empty();
    }
    return Optional.of(new LlmTarget(chatCompletionEndpoint(baseUrl), cryptoService.decrypt(keyCiphertext), model));
  }

  private List<String> splitForAiChunking(String source) {
    int window = 12_000;
    List<String> sections = new ArrayList<>();
    if (source.length() <= window) {
      sections.add(source);
      return sections;
    }
    int start = 0;
    while (start < source.length()) {
      int end = Math.min(start + window, source.length());
      if (end < source.length()) {
        int boundary = source.lastIndexOf("\n\n", end);
        if (boundary > start + 2_000) {
          end = boundary;
        }
      }
      sections.add(source.substring(start, end).trim());
      start = end;
    }
    return sections;
  }

  private List<String> callAiChunker(LlmTarget target, String section) {
    try {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      headers.setBearerAuth(target.apiKey);
      Map<String, Object> body = new LinkedHashMap<>();
      body.put("model", target.model);
      List<Map<String, Object>> messages = new ArrayList<>();
      messages.add(Map.of(
          "role", "system",
          "content", "你是知识库文档智能分块器。请根据语义主题、标题层级、问答边界和表格/条款连续性切分文本。只输出 JSON 字符串数组，不要输出解释。每个元素是一个可独立召回的 chunk，建议 300-1200 个中文字符；不要改写原文，不要丢失事实。"));
      messages.add(Map.of(
          "role", "user",
          "content", "请智能切分以下文本，并只返回 JSON array：\n\n" + section));
      body.put("messages", messages);
      body.put("temperature", 0.1);
      ResponseEntity<String> response = restTemplate.postForEntity(target.endpoint, new HttpEntity<>(body, headers), String.class);
      JsonNode root = objectMapper.readTree(response.getBody());
      String content = root.path("choices").path(0).path("message").path("content").asText("");
      return parseAiChunks(content);
    } catch (Exception exception) {
      return new ArrayList<>();
    }
  }

  private List<String> parseAiChunks(String content) throws JsonProcessingException {
    String json = stripJsonFence(content);
    JsonNode root = objectMapper.readTree(json);
    if (!root.isArray()) {
      return new ArrayList<>();
    }
    List<String> chunks = new ArrayList<>();
    for (JsonNode node : root) {
      String value = normalizeExtractedText(node.asText(""));
      if (!value.isBlank()) {
        addChunkWithSizeLimit(chunks, value);
      }
    }
    return chunks;
  }

  private String stripJsonFence(String content) {
    String value = content == null ? "" : content.trim();
    if (value.startsWith("```")) {
      int firstLineEnd = value.indexOf('\n');
      int lastFence = value.lastIndexOf("```");
      if (firstLineEnd >= 0 && lastFence > firstLineEnd) {
        value = value.substring(firstLineEnd + 1, lastFence).trim();
      }
    }
    int arrayStart = value.indexOf('[');
    int arrayEnd = value.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return value.substring(arrayStart, arrayEnd + 1);
    }
    return value;
  }

  private String chatCompletionEndpoint(String baseUrl) {
    String trimmed = baseUrl.trim();
    if (trimmed.endsWith("/")) {
      trimmed = trimmed.substring(0, trimmed.length() - 1);
    }
    if (trimmed.endsWith("/chat/completions")) {
      return trimmed;
    }
    return trimmed + "/chat/completions";
  }

  private List<String> chunkParagraphs(String source) {
    List<String> chunks = new ArrayList<>();
    for (String paragraph : source.split("\\n\\s*\\n")) {
      String normalized = paragraph.trim();
      if (normalized.isBlank()) {
        continue;
      }
      if (normalized.length() > DEFAULT_CHUNK_SIZE) {
        chunks.addAll(splitBySize(normalized));
      } else {
        chunks.add(normalized);
      }
    }
    return chunks;
  }

  private List<String> chunkQa(String source) {
    String[] paragraphs = source.split("\\n\\s*\\n");
    List<String> chunks = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    boolean sawQaMarker = false;
    for (String rawParagraph : paragraphs) {
      String paragraph = rawParagraph.trim();
      if (paragraph.isBlank()) {
        continue;
      }
      boolean questionStart = isQuestionStart(paragraph);
      sawQaMarker = sawQaMarker || questionStart || isAnswerStart(paragraph);
      if (questionStart && current.length() > 0) {
        addChunkWithSizeLimit(chunks, current.toString().trim());
        current.setLength(0);
      }
      if (current.length() > 0) {
        current.append("\n\n");
      }
      current.append(paragraph);
    }
    if (current.length() > 0) {
      addChunkWithSizeLimit(chunks, current.toString().trim());
    }
    return sawQaMarker && !chunks.isEmpty() ? chunks : chunkParagraphs(source);
  }

  private boolean isQuestionStart(String paragraph) {
    String normalized = paragraph.stripLeading().toLowerCase(Locale.ROOT);
    return normalized.startsWith("q:")
        || normalized.startsWith("q：")
        || normalized.startsWith("问:")
        || normalized.startsWith("问：")
        || normalized.startsWith("问题:")
        || normalized.startsWith("问题：")
        || normalized.startsWith("question:")
        || normalized.startsWith("question：");
  }

  private boolean isAnswerStart(String paragraph) {
    String normalized = paragraph.stripLeading().toLowerCase(Locale.ROOT);
    return normalized.startsWith("a:")
        || normalized.startsWith("a：")
        || normalized.startsWith("答:")
        || normalized.startsWith("答：")
        || normalized.startsWith("答案:")
        || normalized.startsWith("答案：")
        || normalized.startsWith("answer:")
        || normalized.startsWith("answer：");
  }

  private void addChunkWithSizeLimit(List<String> chunks, String value) {
    if (value.length() > DEFAULT_CHUNK_SIZE) {
      chunks.addAll(splitBySize(value));
    } else if (!value.isBlank()) {
      chunks.add(value);
    }
  }

  private List<String> chunkFixed(String source) {
    List<String> chunks = new ArrayList<>();
    String[] paragraphs = source.split("\\n\\s*\\n");
    StringBuilder current = new StringBuilder();
    for (String paragraph : paragraphs) {
      if (current.length() + paragraph.length() > DEFAULT_CHUNK_SIZE && current.length() > 0) {
        chunks.add(current.toString().trim());
        current.setLength(0);
      }
      if (paragraph.length() > DEFAULT_CHUNK_SIZE) {
        chunks.addAll(splitBySize(paragraph));
      } else {
        current.append(paragraph).append("\n\n");
      }
    }
    if (current.length() > 0) {
      chunks.add(current.toString().trim());
    }
    return chunks;
  }

  private List<String> splitBySize(String value) {
    List<String> chunks = new ArrayList<>();
    for (int start = 0; start < value.length(); start += DEFAULT_CHUNK_SIZE) {
      chunks.add(value.substring(start, Math.min(start + DEFAULT_CHUNK_SIZE, value.length())));
    }
    return chunks;
  }

  private List<String> splitTerms(String query) {
    if (query == null || query.isBlank()) {
      return new ArrayList<>();
    }
    String[] parts = query.split("\\s+");
    List<String> terms = new ArrayList<>();
    for (String part : parts) {
      if (!part.isBlank()) {
        terms.add(part);
      }
    }
    if (terms.isEmpty() && query.length() > 1) {
      terms.add(query);
    }
    String compact = query.replaceAll("\\s+", "");
    if (compact.length() > 1 && terms.size() <= 1) {
      for (int index = 0; index < compact.length() - 1; index++) {
        terms.add(compact.substring(index, index + 2));
      }
    }
    return terms;
  }

  private String normalize(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
  }

  private void requireWorkspace(String tenantId, String workspaceId) {
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> tenantId.equals(workspace.getTenantId()))
        .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  public static class DatasetMutation {
    public String name;
    public String description;
    public String embeddingProviderId;
    public String embeddingModel;
    public String chunkStrategy;
  }

  public static class DocumentMutation {
    public String name;
    public String sourceType;
    public String text;
  }

  public static class UploadedDocumentMutation {
    public String name;
    public String contentType;
    public byte[] bytes;
  }

  private static class ParsedDocument {
    private final String text;

    private ParsedDocument(String text) {
      this.text = text;
    }
  }

  private static class IndexResult {
    private final List<String> errors = new ArrayList<>();

    private void addError(String error) {
      if (error != null && !error.isBlank()) {
        errors.add(error);
      }
    }

    private String documentStatus() {
      return errors.isEmpty() ? "success" : "partial";
    }

    private String errorMessage() {
      return errors.isEmpty() ? null : String.join("\n", errors);
    }
  }

  private static class EmbeddingTarget {
    private final boolean available;
    private final String providerId;
    private final String model;
    private final String endpoint;
    private final String apiKey;

    private EmbeddingTarget(boolean available, String providerId, String model, String endpoint, String apiKey) {
      this.available = available;
      this.providerId = providerId;
      this.model = model;
      this.endpoint = endpoint;
      this.apiKey = apiKey;
    }

    private static EmbeddingTarget available(String providerId, String model, String endpoint, String apiKey) {
      return new EmbeddingTarget(true, providerId, model, endpoint, apiKey);
    }

    private static EmbeddingTarget unavailable(String providerId, String model, String reason) {
      return new EmbeddingTarget(false, providerId, model, null, null);
    }
  }

  private static class LlmTarget {
    private final String endpoint;
    private final String apiKey;
    private final String model;

    private LlmTarget(String endpoint, String apiKey, String model) {
      this.endpoint = endpoint;
      this.apiKey = apiKey;
      this.model = model;
    }
  }

  private static class VectorEntry {
    private final String vectorId;
    private final String status;
    private final String embeddingProviderId;
    private final String embeddingModel;
    private final Integer embeddingDimension;
    private final String embeddingVector;
    private final String errorMessage;

    private VectorEntry(String vectorId, String status, String embeddingProviderId, String embeddingModel, Integer embeddingDimension, String embeddingVector, String errorMessage) {
      this.vectorId = vectorId;
      this.status = status;
      this.embeddingProviderId = embeddingProviderId;
      this.embeddingModel = embeddingModel;
      this.embeddingDimension = embeddingDimension;
      this.embeddingVector = embeddingVector;
      this.errorMessage = errorMessage;
    }

    private static VectorEntry lightweight(String vectorId, String providerId, String model) {
      return new VectorEntry(vectorId, "lightweight_text_index", providerId, model, null, null, null);
    }

    private static VectorEntry embedded(String vectorId, String providerId, String model, Integer dimension, String vector) {
      return new VectorEntry(vectorId, "embedded", providerId, model, dimension, vector, null);
    }

    private static VectorEntry failed(String vectorId, String providerId, String model, String errorMessage) {
      return new VectorEntry(vectorId, "embedding_failed", providerId, model, null, null, errorMessage);
    }
  }
}