package com.dxnow.aio.identity.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "user_workspace_memberships")
public class UserWorkspaceMembership {

  @Id
  private String id;

  @Column(nullable = false)
  private String tenantId;

  @Column(nullable = false)
  private String userId;

  @Column(nullable = false)
  private String workspaceId;

  @Column(nullable = false)
  private String role;

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
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getWorkspaceId() { return workspaceId; }
  public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
