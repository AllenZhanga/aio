package com.dxnow.aio.runtime.api;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.runtime.domain.AiWaitTask;
import com.dxnow.aio.runtime.repository.AiWaitTaskRepository;
import com.dxnow.aio.runtime.service.RuntimeService;
import com.dxnow.aio.security.ApiKeyPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import javax.persistence.EntityNotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/admin/wait-tasks")
public class AdminWaitTaskController {

  private final AiWaitTaskRepository waitTaskRepository;
  private final AiAppRepository appRepository;
  private final RuntimeService runtimeService;
  private final ObjectMapper objectMapper;

  public AdminWaitTaskController(
      AiWaitTaskRepository waitTaskRepository,
      AiAppRepository appRepository,
      RuntimeService runtimeService,
      ObjectMapper objectMapper) {
    this.waitTaskRepository = waitTaskRepository;
    this.appRepository = appRepository;
    this.runtimeService = runtimeService;
    this.objectMapper = objectMapper;
  }

  @GetMapping
  public List<WaitTaskResponse> list(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @RequestParam(value = "status", required = false) String status,
      @RequestParam(value = "appId", required = false) String appId) {
    return waitTaskRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId).stream()
        .filter(task -> status == null || status.isBlank() || status.equals(task.getStatus()))
        .filter(task -> appId == null || appId.isBlank() || appId.equals(task.getAppId()))
        .map(task -> WaitTaskResponse.from(task, appRepository.findByTenantIdAndId(tenantId, task.getAppId()), objectMapper))
        .collect(Collectors.toList());
  }

  @GetMapping("/{waitTaskId}")
  public WaitTaskResponse get(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String waitTaskId) {
    AiWaitTask task = waitTaskRepository.findByTenantIdAndId(tenantId, waitTaskId)
        .orElseThrow(() -> new EntityNotFoundException("Wait task not found"));
    return WaitTaskResponse.from(task, appRepository.findByTenantIdAndId(tenantId, task.getAppId()), objectMapper);
  }

  @PostMapping("/{waitTaskId}/submit")
  public Map<String, Object> submit(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @PathVariable String waitTaskId,
      @RequestBody(required = false) Map<String, Object> request) {
    Map<String, Object> body = request == null ? new LinkedHashMap<>() : new LinkedHashMap<>(request);
    body.putIfAbsent("action", "approve");
    body.putIfAbsent("submitted_by", "console-admin");
    String key = idempotencyKey == null || idempotencyKey.isBlank()
        ? "console-" + waitTaskId + "-" + System.currentTimeMillis()
        : idempotencyKey;
    ApiKeyPrincipal principal = new ApiKeyPrincipal("console-admin", tenantId, workspaceId, null);
    return runtimeService.submitWaitTask(principal, waitTaskId, body, key);
  }

  public static class WaitTaskResponse {
    public String id;
    public String appId;
    public String appName;
    public String appType;
    public String runId;
    public String traceId;
    public String nodeId;
    public String nodeType;
    public String title;
    public String description;
    public String status;
    public Object actions;
    public Map<String, Object> context;
    public Map<String, Object> submitResult;
    public OffsetDateTime expiresAt;
    public OffsetDateTime submittedAt;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static WaitTaskResponse from(AiWaitTask task, Optional<AiApp> app, ObjectMapper objectMapper) {
      WaitTaskResponse response = new WaitTaskResponse();
      response.id = task.getId();
      response.appId = task.getAppId();
      response.appName = app.map(AiApp::getName).orElse(task.getAppId());
      response.appType = app.map(AiApp::getType).orElse("workflow");
      response.runId = task.getRunId();
      response.traceId = task.getTraceId();
      response.nodeId = task.getNodeId();
      response.nodeType = task.getNodeType();
      response.title = task.getTitle();
      response.description = task.getDescription();
      response.status = task.getStatus();
      response.actions = parseObject(objectMapper, task.getActionSchemaJson());
      response.context = parseMap(objectMapper, task.getContextJson());
      response.submitResult = parseMap(objectMapper, task.getSubmitResultJson());
      response.expiresAt = task.getExpiresAt();
      response.submittedAt = task.getSubmittedAt();
      response.createdAt = task.getCreatedAt();
      response.updatedAt = task.getUpdatedAt();
      return response;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> parseMap(ObjectMapper objectMapper, String json) {
      if (json == null || json.isBlank()) {
        return Collections.emptyMap();
      }
      try {
        Object value = objectMapper.readValue(json, Object.class);
        return value instanceof Map ? (Map<String, Object>) value : Collections.emptyMap();
      } catch (Exception e) {
        return Collections.emptyMap();
      }
    }

    private static Object parseObject(ObjectMapper objectMapper, String json) {
      if (json == null || json.isBlank()) {
        return Collections.emptyList();
      }
      try {
        return objectMapper.readValue(json, Object.class);
      } catch (Exception e) {
        return Collections.emptyList();
      }
    }
  }
}