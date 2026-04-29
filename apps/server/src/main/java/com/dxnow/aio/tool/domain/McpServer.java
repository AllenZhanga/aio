package com.dxnow.aio.tool.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "mcp_servers")
public class McpServer {

  @Id
  private String id;
  @Column(nullable = false)
  private String tenantId;
  @Column(nullable = false)
  private String workspaceId;
  @Column(nullable = false)
  private String name;
  @Column(nullable = false)
  private String transport;
  private String endpoint;
  @Column(columnDefinition = "text")
  private String commandConfig;
  @Column(columnDefinition = "text")
  private String authConfig;
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
  public String getTransport() { return transport; }
  public void setTransport(String transport) { this.transport = transport; }
  public String getEndpoint() { return endpoint; }
  public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
  public String getCommandConfig() { return commandConfig; }
  public void setCommandConfig(String commandConfig) { this.commandConfig = commandConfig; }
  public String getAuthConfig() { return authConfig; }
  public void setAuthConfig(String authConfig) { this.authConfig = authConfig; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}