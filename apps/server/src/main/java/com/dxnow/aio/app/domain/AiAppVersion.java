package com.dxnow.aio.app.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

@Entity
@Table(name = "ai_app_versions")
public class AiAppVersion {

  @Id
  private String id;

  @Column(nullable = false)
  private String tenantId;

  @Column(nullable = false)
  private String workspaceId;

  @Column(nullable = false)
  private String appId;

  @Column(nullable = false)
  private int versionNo;

  @Column(nullable = false)
  private String type;

  @Column(nullable = false)
  private String definitionJson;

  @Column(nullable = false)
  private String publishStatus;

  private OffsetDateTime publishedAt;

  private String publishedBy;

  @Column(nullable = false)
  private OffsetDateTime createdAt;

  @PrePersist
  void prePersist() {
    createdAt = OffsetDateTime.now();
  }

  public void publish(String userId) {
    publishStatus = "published";
    publishedBy = userId;
    publishedAt = OffsetDateTime.now();
  }

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTenantId() { return tenantId; }
  public void setTenantId(String tenantId) { this.tenantId = tenantId; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
  public String getAppId() { return appId; }
  public void setAppId(String appId) { this.appId = appId; }
  public int getVersionNo() { return versionNo; }
  public void setVersionNo(int versionNo) { this.versionNo = versionNo; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getDefinitionJson() { return definitionJson; }
  public void setDefinitionJson(String definitionJson) { this.definitionJson = definitionJson; }
  public String getPublishStatus() { return publishStatus; }
  public void setPublishStatus(String publishStatus) { this.publishStatus = publishStatus; }
  public OffsetDateTime getPublishedAt() { return publishedAt; }
  public String getPublishedBy() { return publishedBy; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}
