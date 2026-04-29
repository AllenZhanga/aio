package com.dxnow.aio.knowledge.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "kb_documents")
public class KbDocument {

  @Id
  private String id;
  @Column(nullable = false)
  private String tenantId;
  @Column(nullable = false)
  private String workspaceId;
  @Column(nullable = false)
  private String datasetId;
  @Column(nullable = false)
  private String name;
  @Column(nullable = false)
  private String sourceType;
  private String objectKey;
  @Column(columnDefinition = "text")
  private String contentText;
  @Column(nullable = false)
  private String parseStatus;
  @Column(nullable = false)
  private String indexStatus;
  @Column(columnDefinition = "text")
  private String errorMessage;
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
  public String getDatasetId() { return datasetId; }
  public void setDatasetId(String datasetId) { this.datasetId = datasetId; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getSourceType() { return sourceType; }
  public void setSourceType(String sourceType) { this.sourceType = sourceType; }
  public String getObjectKey() { return objectKey; }
  public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
  public String getContentText() { return contentText; }
  public void setContentText(String contentText) { this.contentText = contentText; }
  public String getParseStatus() { return parseStatus; }
  public void setParseStatus(String parseStatus) { this.parseStatus = parseStatus; }
  public String getIndexStatus() { return indexStatus; }
  public void setIndexStatus(String indexStatus) { this.indexStatus = indexStatus; }
  public String getErrorMessage() { return errorMessage; }
  public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}