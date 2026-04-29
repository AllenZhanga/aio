package com.dxnow.aio.knowledge.service;

import com.dxnow.aio.common.Ids;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import com.dxnow.aio.knowledge.domain.KbChunk;
import com.dxnow.aio.knowledge.domain.KbDataset;
import com.dxnow.aio.knowledge.domain.KbDocument;
import com.dxnow.aio.knowledge.repository.KbChunkRepository;
import com.dxnow.aio.knowledge.repository.KbDatasetRepository;
import com.dxnow.aio.knowledge.repository.KbDocumentRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import javax.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KnowledgeService {

  private static final int DEFAULT_CHUNK_SIZE = 1200;

  private final WorkspaceRepository workspaceRepository;
  private final KbDatasetRepository datasetRepository;
  private final KbDocumentRepository documentRepository;
  private final KbChunkRepository chunkRepository;

  public KnowledgeService(
      WorkspaceRepository workspaceRepository,
      KbDatasetRepository datasetRepository,
      KbDocumentRepository documentRepository,
      KbChunkRepository chunkRepository) {
    this.workspaceRepository = workspaceRepository;
    this.datasetRepository = datasetRepository;
    this.documentRepository = documentRepository;
    this.chunkRepository = chunkRepository;
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
  public KbDocument addDocument(String tenantId, String datasetId, DocumentMutation request) {
    KbDataset dataset = getDataset(tenantId, datasetId);
    KbDocument document = new KbDocument();
    document.setId(Ids.prefixed("doc"));
    document.setTenantId(dataset.getTenantId());
    document.setWorkspaceId(dataset.getWorkspaceId());
    document.setDatasetId(dataset.getId());
    document.setName(request.name == null || request.name.isBlank() ? "Untitled Document" : request.name);
    document.setSourceType(request.sourceType == null || request.sourceType.isBlank() ? "text" : request.sourceType);
    document.setObjectKey("tenants/" + dataset.getTenantId() + "/workspaces/" + dataset.getWorkspaceId() + "/datasets/" + dataset.getId() + "/documents/" + document.getId());
    document.setContentText(request.text == null ? "" : request.text);
    document.setParseStatus("success");
    document.setIndexStatus("running");
    KbDocument saved = documentRepository.save(document);
    indexDocument(saved);
    saved.setIndexStatus("success");
    return documentRepository.save(saved);
  }

  @Transactional
  public KbDocument reindex(String tenantId, String documentId) {
    KbDocument document = documentRepository.findByTenantIdAndId(tenantId, documentId)
        .orElseThrow(() -> new EntityNotFoundException("Document not found"));
    document.setIndexStatus("running");
    documentRepository.save(document);
    indexDocument(document);
    document.setParseStatus("success");
    document.setIndexStatus("success");
    document.setErrorMessage(null);
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
  protected void indexDocument(KbDocument document) {
    chunkRepository.deleteByTenantIdAndDocumentId(document.getTenantId(), document.getId());
    List<String> chunks = chunkText(document.getContentText(), document.getSourceType());
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
      chunk.setMetadataJson("{\"source\":\"" + safe(document.getName()) + "\"}");
      chunk.setVectorId(chunk.getId());
      chunkRepository.save(chunk);
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

  private List<String> chunkText(String text, String sourceType) {
    String source = text == null ? "" : text.trim();
    List<String> chunks = new ArrayList<>();
    if (source.isBlank()) {
      chunks.add("");
      return chunks;
    }
    if ("text:raw".equals(sourceType) || "text:single".equals(sourceType)) {
      chunks.add(source);
      return chunks;
    }
    if ("text:paragraph".equals(sourceType) || "text:qa".equals(sourceType)) {
      for (String paragraph : source.split("\\n\\s*\\n")) {
        if (!paragraph.isBlank()) {
          chunks.add(paragraph.trim());
        }
      }
      if (!chunks.isEmpty()) {
        return chunks;
      }
    }
    String[] paragraphs = source.split("\\n\\s*\\n");
    StringBuilder current = new StringBuilder();
    for (String paragraph : paragraphs) {
      if (current.length() + paragraph.length() > DEFAULT_CHUNK_SIZE && current.length() > 0) {
        chunks.add(current.toString().trim());
        current.setLength(0);
      }
      if (paragraph.length() > DEFAULT_CHUNK_SIZE) {
        for (int start = 0; start < paragraph.length(); start += DEFAULT_CHUNK_SIZE) {
          chunks.add(paragraph.substring(start, Math.min(start + DEFAULT_CHUNK_SIZE, paragraph.length())));
        }
      } else {
        current.append(paragraph).append("\n\n");
      }
    }
    if (current.length() > 0) {
      chunks.add(current.toString().trim());
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
    return terms;
  }

  private String normalize(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
  }

  private String safe(String value) {
    return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private void requireWorkspace(String tenantId, String workspaceId) {
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> tenantId.equals(workspace.getTenantId()))
        .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
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
}