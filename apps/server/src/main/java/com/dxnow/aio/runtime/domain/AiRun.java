package com.dxnow.aio.runtime.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "ai_runs")
public class AiRun {

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
  private String runType;
  private String inputJson;
  private String outputJson;
  @Column(nullable = false)
  private String status;
  private String currentWaitTaskId;
  @Column(nullable = false)
  private int resumeCount;
  private Integer totalTokens;
  private Long latencyMs;
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
  public String getAppId() { return appId; }
  public void setAppId(String appId) { this.appId = appId; }
  public String getAppVersionId() { return appVersionId; }
  public void setAppVersionId(String appVersionId) { this.appVersionId = appVersionId; }
  public String getRunType() { return runType; }
  public void setRunType(String runType) { this.runType = runType; }
  public String getInputJson() { return inputJson; }
  public void setInputJson(String inputJson) { this.inputJson = inputJson; }
  public String getOutputJson() { return outputJson; }
  public void setOutputJson(String outputJson) { this.outputJson = outputJson; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getCurrentWaitTaskId() { return currentWaitTaskId; }
  public void setCurrentWaitTaskId(String currentWaitTaskId) { this.currentWaitTaskId = currentWaitTaskId; }
  public int getResumeCount() { return resumeCount; }
  public void setResumeCount(int resumeCount) { this.resumeCount = resumeCount; }
  public Integer getTotalTokens() { return totalTokens; }
  public void setTotalTokens(Integer totalTokens) { this.totalTokens = totalTokens; }
  public Long getLatencyMs() { return latencyMs; }
  public void setLatencyMs(Long latencyMs) { this.latencyMs = latencyMs; }
  public String getErrorMessage() { return errorMessage; }
  public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
