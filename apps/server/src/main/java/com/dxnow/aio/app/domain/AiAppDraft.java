package com.dxnow.aio.app.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "ai_app_drafts")
public class AiAppDraft {

  @Id
  private String id;

  @Column(nullable = false)
  private String tenantId;

  @Column(nullable = false)
  private String workspaceId;

  @Column(nullable = false)
  private String appId;

  private String baseVersionId;

  @Column(nullable = false)
  private String definitionJson;

  @Column(columnDefinition = "text")
  private String validationJson;

  @Column(nullable = false)
  private int revision;

  @Column(nullable = false)
  private boolean dirty;

  private String autosavedBy;

  private OffsetDateTime autosavedAt;

  @Column(nullable = false)
  private OffsetDateTime createdAt;

  @Column(nullable = false)
  private OffsetDateTime updatedAt;

  @PrePersist
  void prePersist() {
    OffsetDateTime now = OffsetDateTime.now();
    createdAt = now;
    updatedAt = now;
    if (autosavedAt == null) autosavedAt = now;
    if (revision <= 0) revision = 1;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = OffsetDateTime.now();
  }

  public void markSaved(String userId) {
    revision++;
    dirty = true;
    autosavedBy = userId;
    autosavedAt = OffsetDateTime.now();
    validationJson = null;
  }

  public void markPublished(String versionId, String validationJson) {
    baseVersionId = versionId;
    dirty = false;
    this.validationJson = validationJson;
  }

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTenantId() { return tenantId; }
  public void setTenantId(String tenantId) { this.tenantId = tenantId; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
  public String getAppId() { return appId; }
  public void setAppId(String appId) { this.appId = appId; }
  public String getBaseVersionId() { return baseVersionId; }
  public void setBaseVersionId(String baseVersionId) { this.baseVersionId = baseVersionId; }
  public String getDefinitionJson() { return definitionJson; }
  public void setDefinitionJson(String definitionJson) { this.definitionJson = definitionJson; }
  public String getValidationJson() { return validationJson; }
  public void setValidationJson(String validationJson) { this.validationJson = validationJson; }
  public int getRevision() { return revision; }
  public void setRevision(int revision) { this.revision = revision; }
  public boolean isDirty() { return dirty; }
  public void setDirty(boolean dirty) { this.dirty = dirty; }
  public String getAutosavedBy() { return autosavedBy; }
  public void setAutosavedBy(String autosavedBy) { this.autosavedBy = autosavedBy; }
  public OffsetDateTime getAutosavedAt() { return autosavedAt; }
  public void setAutosavedAt(OffsetDateTime autosavedAt) { this.autosavedAt = autosavedAt; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
