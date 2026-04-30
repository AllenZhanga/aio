package com.dxnow.aio.knowledge.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

@Entity
@Table(name = "kb_chunks")
public class KbChunk {

  @Id
  private String id;
  @Column(nullable = false)
  private String tenantId;
  @Column(nullable = false)
  private String workspaceId;
  @Column(nullable = false)
  private String datasetId;
  @Column(nullable = false)
  private String documentId;
  @Column(nullable = false)
  private int chunkNo;
  @Column(nullable = false, columnDefinition = "text")
  private String content;
  private Integer tokenCount;
  @Column(columnDefinition = "text")
  private String metadataJson;
  private String vectorId;
  private String vectorStatus;
  private String embeddingProviderId;
  private String embeddingModel;
  private Integer embeddingDimension;
  @Column(columnDefinition = "text")
  private String embeddingVector;
  @Column(nullable = false)
  private OffsetDateTime createdAt;

  @PrePersist
  void prePersist() {
    createdAt = OffsetDateTime.now();
  }

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTenantId() { return tenantId; }
  public void setTenantId(String tenantId) { this.tenantId = tenantId; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
  public String getDatasetId() { return datasetId; }
  public void setDatasetId(String datasetId) { this.datasetId = datasetId; }
  public String getDocumentId() { return documentId; }
  public void setDocumentId(String documentId) { this.documentId = documentId; }
  public int getChunkNo() { return chunkNo; }
  public void setChunkNo(int chunkNo) { this.chunkNo = chunkNo; }
  public String getContent() { return content; }
  public void setContent(String content) { this.content = content; }
  public Integer getTokenCount() { return tokenCount; }
  public void setTokenCount(Integer tokenCount) { this.tokenCount = tokenCount; }
  public String getMetadataJson() { return metadataJson; }
  public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
  public String getVectorId() { return vectorId; }
  public void setVectorId(String vectorId) { this.vectorId = vectorId; }
  public String getVectorStatus() { return vectorStatus; }
  public void setVectorStatus(String vectorStatus) { this.vectorStatus = vectorStatus; }
  public String getEmbeddingProviderId() { return embeddingProviderId; }
  public void setEmbeddingProviderId(String embeddingProviderId) { this.embeddingProviderId = embeddingProviderId; }
  public String getEmbeddingModel() { return embeddingModel; }
  public void setEmbeddingModel(String embeddingModel) { this.embeddingModel = embeddingModel; }
  public Integer getEmbeddingDimension() { return embeddingDimension; }
  public void setEmbeddingDimension(Integer embeddingDimension) { this.embeddingDimension = embeddingDimension; }
  public String getEmbeddingVector() { return embeddingVector; }
  public void setEmbeddingVector(String embeddingVector) { this.embeddingVector = embeddingVector; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}