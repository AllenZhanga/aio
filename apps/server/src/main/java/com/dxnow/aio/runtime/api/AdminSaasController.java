package com.dxnow.aio.runtime.api;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.domain.AiAppVersion;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.app.repository.AiAppVersionRepository;
import com.dxnow.aio.identity.domain.ApiKey;
import com.dxnow.aio.identity.repository.ApiKeyRepository;
import com.dxnow.aio.knowledge.domain.KbDocument;
import com.dxnow.aio.knowledge.repository.KbDatasetRepository;
import com.dxnow.aio.knowledge.repository.KbDocumentRepository;
import com.dxnow.aio.runtime.domain.AiRun;
import com.dxnow.aio.runtime.domain.AiWaitTask;
import com.dxnow.aio.runtime.repository.AiRunRepository;
import com.dxnow.aio.runtime.repository.AiWaitTaskRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/admin")
public class AdminSaasController {

  private final AiAppRepository appRepository;
  private final AiAppVersionRepository versionRepository;
  private final AiRunRepository runRepository;
  private final AiWaitTaskRepository waitTaskRepository;
  private final ApiKeyRepository apiKeyRepository;
  private final KbDatasetRepository datasetRepository;
  private final KbDocumentRepository documentRepository;

  public AdminSaasController(
      AiAppRepository appRepository,
      AiAppVersionRepository versionRepository,
      AiRunRepository runRepository,
      AiWaitTaskRepository waitTaskRepository,
      ApiKeyRepository apiKeyRepository,
      KbDatasetRepository datasetRepository,
      KbDocumentRepository documentRepository) {
    this.appRepository = appRepository;
    this.versionRepository = versionRepository;
    this.runRepository = runRepository;
    this.waitTaskRepository = waitTaskRepository;
    this.apiKeyRepository = apiKeyRepository;
    this.datasetRepository = datasetRepository;
    this.documentRepository = documentRepository;
  }

  @GetMapping("/usage-summary")
  public UsageSummary usageSummary(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    List<AiApp> apps = appRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
    List<AiRun> runs = runRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
    List<AiWaitTask> waitTasks = waitTaskRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
    UsageSummary summary = new UsageSummary();
    summary.applications = apps.size();
    summary.publishedApps = (int) apps.stream().filter(app -> "published".equals(app.getStatus())).count();
    summary.datasets = datasetRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId).size();
    summary.documents = (int) documentRepository.findAll().stream()
        .filter(document -> tenantId.equals(document.getTenantId()) && workspaceId.equals(document.getWorkspaceId()))
        .count();
    summary.apiKeys = apiKeyRepository.findByTenantIdOrderByCreatedAtDesc(tenantId).size();
    summary.runs = runs.size();
    summary.failedRuns = (int) runs.stream().filter(run -> "failed".equals(run.getStatus())).count();
    summary.waitingRuns = (int) runs.stream().filter(run -> "waiting".equals(run.getStatus())).count();
    summary.waitTasks = waitTasks.size();
    summary.pendingWaitTasks = (int) waitTasks.stream().filter(task -> "pending".equals(task.getStatus())).count();
    summary.totalTokens = runs.stream().map(AiRun::getTotalTokens).filter(Objects::nonNull).mapToInt(Integer::intValue).sum();
    summary.averageLatencyMs = runs.isEmpty() ? 0 : Math.round(runs.stream().map(AiRun::getLatencyMs).filter(Objects::nonNull).mapToLong(Long::longValue).average().orElse(0));
    return summary;
  }

  @GetMapping("/audit-events")
  public List<AuditEvent> auditEvents(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    List<AuditEvent> events = new ArrayList<>();
    for (AiAppVersion version : versionRepository.findAll()) {
      if (tenantId.equals(version.getTenantId()) && workspaceId.equals(version.getWorkspaceId()) && "published".equals(version.getPublishStatus())) {
        events.add(new AuditEvent(
            version.getId(),
            "app.publish",
            "应用版本发布",
            "发布版本 v" + version.getVersionNo() + "，应用 " + version.getAppId(),
            version.getPublishedBy() == null ? "system" : version.getPublishedBy(),
            version.getAppId(),
            version.getPublishedAt() == null ? version.getCreatedAt() : version.getPublishedAt()));
      }
    }
    for (ApiKey apiKey : apiKeyRepository.findByTenantIdOrderByCreatedAtDesc(tenantId)) {
      events.add(new AuditEvent(
          apiKey.getId(),
          "api_key.create",
          "API Key 创建",
          "创建 Key：" + apiKey.getName() + "，scope=" + (apiKey.getAppId() == null ? "workspace" : apiKey.getAppId()),
          apiKey.getCreatedBy() == null ? "system" : apiKey.getCreatedBy(),
          apiKey.getId(),
          apiKey.getCreatedAt()));
    }
    for (KbDocument document : documentRepository.findAll()) {
      if (tenantId.equals(document.getTenantId()) && workspaceId.equals(document.getWorkspaceId())) {
        events.add(new AuditEvent(
            document.getId(),
            "knowledge.document.index",
            "知识文档索引",
            document.getName() + " 索引状态：" + document.getIndexStatus(),
            "system",
            document.getDatasetId(),
            document.getUpdatedAt()));
      }
    }
    return events.stream()
        .sorted(Comparator.comparing((AuditEvent event) -> event.createdAt).reversed())
        .limit(30)
        .collect(Collectors.toList());
  }

  public static class UsageSummary {
    public int applications;
    public int publishedApps;
    public int datasets;
    public int documents;
    public int apiKeys;
    public int runs;
    public int failedRuns;
    public int waitingRuns;
    public int waitTasks;
    public int pendingWaitTasks;
    public int totalTokens;
    public long averageLatencyMs;
  }

  public static class AuditEvent {
    public String id;
    public String type;
    public String title;
    public String detail;
    public String actor;
    public String target;
    public OffsetDateTime createdAt;

    AuditEvent(String id, String type, String title, String detail, String actor, String target, OffsetDateTime createdAt) {
      this.id = id;
      this.type = type;
      this.title = title;
      this.detail = detail;
      this.actor = actor;
      this.target = target;
      this.createdAt = createdAt;
    }
  }
}