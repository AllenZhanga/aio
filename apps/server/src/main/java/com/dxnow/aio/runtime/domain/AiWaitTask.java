package com.dxnow.aio.runtime.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "ai_wait_tasks")
public class AiWaitTask {

  @Id
  private String id;
  @Column(nullable = false)
  private String tenantId;
  @Column(nullable = false)
  private String workspaceId;
  @Column(nullable = false)
  private String appId;
  private String appVersionId;
  @Column(nullable = false)
  private String runId;
  private String traceId;
  @Column(nullable = false)
  private String nodeId;
  @Column(nullable = false)
  private String nodeType;
  private String title;
  @Column(columnDefinition = "text")
  private String description;
  private String assigneeType;
  private String assigneeId;
  @Column(columnDefinition = "text")
  private String formSchemaJson;
  @Column(columnDefinition = "text")
  private String uiSchemaJson;
  @Column(columnDefinition = "text")
  private String actionSchemaJson;
  @Column(columnDefinition = "text")
  private String defaultValuesJson;
  @Column(columnDefinition = "text")
  private String contextJson;
  @Column(columnDefinition = "text")
  private String submitResultJson;
  @Column(nullable = false)
  private String status;
  private String submitTokenHash;
  private String idempotencyKey;
  private OffsetDateTime expiresAt;
  private OffsetDateTime submittedAt;
  private String submittedBy;
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
  public String getAppId() { return appId; }
  public void setAppId(String appId) { this.appId = appId; }
  public String getAppVersionId() { return appVersionId; }
  public void setAppVersionId(String appVersionId) { this.appVersionId = appVersionId; }
  public String getRunId() { return runId; }
  public void setRunId(String runId) { this.runId = runId; }
  public String getTraceId() { return traceId; }
  public void setTraceId(String traceId) { this.traceId = traceId; }
  public String getNodeId() { return nodeId; }
  public void setNodeId(String nodeId) { this.nodeId = nodeId; }
  public String getNodeType() { return nodeType; }
  public void setNodeType(String nodeType) { this.nodeType = nodeType; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getAssigneeType() { return assigneeType; }
  public void setAssigneeType(String assigneeType) { this.assigneeType = assigneeType; }
  public String getAssigneeId() { return assigneeId; }
  public void setAssigneeId(String assigneeId) { this.assigneeId = assigneeId; }
  public String getFormSchemaJson() { return formSchemaJson; }
  public void setFormSchemaJson(String formSchemaJson) { this.formSchemaJson = formSchemaJson; }
  public String getUiSchemaJson() { return uiSchemaJson; }
  public void setUiSchemaJson(String uiSchemaJson) { this.uiSchemaJson = uiSchemaJson; }
  public String getActionSchemaJson() { return actionSchemaJson; }
  public void setActionSchemaJson(String actionSchemaJson) { this.actionSchemaJson = actionSchemaJson; }
  public String getDefaultValuesJson() { return defaultValuesJson; }
  public void setDefaultValuesJson(String defaultValuesJson) { this.defaultValuesJson = defaultValuesJson; }
  public String getContextJson() { return contextJson; }
  public void setContextJson(String contextJson) { this.contextJson = contextJson; }
  public String getSubmitResultJson() { return submitResultJson; }
  public void setSubmitResultJson(String submitResultJson) { this.submitResultJson = submitResultJson; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getSubmitTokenHash() { return submitTokenHash; }
  public void setSubmitTokenHash(String submitTokenHash) { this.submitTokenHash = submitTokenHash; }
  public String getIdempotencyKey() { return idempotencyKey; }
  public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
  public OffsetDateTime getExpiresAt() { return expiresAt; }
  public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
  public OffsetDateTime getSubmittedAt() { return submittedAt; }
  public void setSubmittedAt(OffsetDateTime submittedAt) { this.submittedAt = submittedAt; }
  public String getSubmittedBy() { return submittedBy; }
  public void setSubmittedBy(String submittedBy) { this.submittedBy = submittedBy; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}