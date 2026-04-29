package com.dxnow.aio.knowledge.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "kb_datasets")
public class KbDataset {

  @Id
  private String id;
  @Column(nullable = false)
  private String tenantId;
  @Column(nullable = false)
  private String workspaceId;
  @Column(nullable = false)
  private String name;
  @Column(columnDefinition = "text")
  private String description;
  private String embeddingProviderId;
  private String embeddingModel;
  @Column(nullable = false)
  private String chunkStrategy;
  @Column(nullable = false)
  private String status;
  @Column(nullable = false)
  private OffsetDateTime createdAt;
  @Column(nullable = false)
  private OffsetDateTime updatedAt;

  @PrePersist
  void prePersist() {
    OffsetDateTime now = OffsetDateTime.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = OffsetDateTime.now();
  }

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTenantId() { return tenantId; }
  public void setTenantId(String tenantId) { this.tenantId = tenantId; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getEmbeddingProviderId() { return embeddingProviderId; }
  public void setEmbeddingProviderId(String embeddingProviderId) { this.embeddingProviderId = embeddingProviderId; }
  public String getEmbeddingModel() { return embeddingModel; }
  public void setEmbeddingModel(String embeddingModel) { this.embeddingModel = embeddingModel; }
  public String getChunkStrategy() { return chunkStrategy; }
  public void setChunkStrategy(String chunkStrategy) { this.chunkStrategy = chunkStrategy; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}