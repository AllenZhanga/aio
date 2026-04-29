package com.dxnow.aio.app.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "ai_apps")
public class AiApp {

  @Id
  private String id;

  @Column(nullable = false)
  private String tenantId;

  @Column(nullable = false)
  private String workspaceId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false)
  private String type;

  private String description;

  @Column(nullable = false)
  private String visibility;

  @Column(nullable = false)
  private String status;

  private String publishedVersionId;

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
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getVisibility() { return visibility; }
  public void setVisibility(String visibility) { this.visibility = visibility; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getPublishedVersionId() { return publishedVersionId; }
  public void setPublishedVersionId(String publishedVersionId) { this.publishedVersionId = publishedVersionId; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
