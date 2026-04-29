package com.dxnow.aio.runtime.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

@Entity
@Table(name = "ai_traces")
public class AiTrace {

  @Id
  private String id;
  @Column(nullable = false)
  private String tenantId;
  @Column(nullable = false)
  private String workspaceId;
  @Column(nullable = false)
  private String runId;
  private String parentTraceId;
  @Column(nullable = false)
  private String type;
  @Column(nullable = false)
  private String name;
  @Column(columnDefinition = "text")
  private String inputJson;
  @Column(columnDefinition = "text")
  private String outputJson;
  @Column(nullable = false)
  private String status;
  private Long latencyMs;
  @Column(columnDefinition = "text")
  private String tokenJson;
  @Column(columnDefinition = "text")
  private String errorMessage;
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
  public String getRunId() { return runId; }
  public void setRunId(String runId) { this.runId = runId; }
  public String getParentTraceId() { return parentTraceId; }
  public void setParentTraceId(String parentTraceId) { this.parentTraceId = parentTraceId; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getInputJson() { return inputJson; }
  public void setInputJson(String inputJson) { this.inputJson = inputJson; }
  public String getOutputJson() { return outputJson; }
  public void setOutputJson(String outputJson) { this.outputJson = outputJson; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Long getLatencyMs() { return latencyMs; }
  public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }
  public String getTokenJson() { return tokenJson; }
  public void setTokenJson(String tokenJson) { this.tokenJson = tokenJson; }
  public String getErrorMessage() { return errorMessage; }
  public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
}