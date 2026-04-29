package com.dxnow.aio.runtime.api;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.runtime.domain.AiRun;
import com.dxnow.aio.runtime.domain.AiTrace;
import com.dxnow.aio.runtime.repository.AiRunRepository;
import com.dxnow.aio.runtime.repository.AiTraceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/admin")
public class AdminObservabilityController {

  private final AiRunRepository runRepository;
  private final AiTraceRepository traceRepository;
  private final AiAppRepository appRepository;
  private final ObjectMapper objectMapper;

  public AdminObservabilityController(
      AiRunRepository runRepository,
      AiTraceRepository traceRepository,
      AiAppRepository appRepository,
      ObjectMapper objectMapper) {
    this.runRepository = runRepository;
    this.traceRepository = traceRepository;
    this.appRepository = appRepository;
    this.objectMapper = objectMapper;
  }

  @GetMapping("/runs")
  public List<RunResponse> listRuns(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @RequestParam(value = "appId", required = false) String appId,
      @RequestParam(value = "limit", defaultValue = "50") int limit) {
    List<AiRun> runs = appId == null || appId.isBlank()
        ? runRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId)
        : runRepository.findByTenantIdAndWorkspaceIdAndAppIdOrderByCreatedAtDesc(tenantId, workspaceId, appId);
    int max = Math.max(1, Math.min(limit, 200));
    return runs.stream()
        .limit(max)
        .map(run -> RunResponse.from(run, loadApp(tenantId, run.getAppId()), parseMap(run.getInputJson()), parseMap(run.getOutputJson())))
        .collect(Collectors.toList());
  }

  @GetMapping("/runs/{runId}")
  public RunResponse getRun(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @PathVariable String runId) {
    AiRun run = runRepository.findByTenantIdAndId(tenantId, runId)
        .filter(item -> workspaceId.equals(item.getWorkspaceId()))
        .orElseThrow(() -> new EntityNotFoundException("Run not found"));
    return RunResponse.from(run, loadApp(tenantId, run.getAppId()), parseMap(run.getInputJson()), parseMap(run.getOutputJson()));
  }

  @GetMapping("/runs/{runId}/traces")
  public List<TraceResponse> traces(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @PathVariable String runId) {
    AiRun run = runRepository.findByTenantIdAndId(tenantId, runId)
        .filter(item -> workspaceId.equals(item.getWorkspaceId()))
        .orElseThrow(() -> new EntityNotFoundException("Run not found"));
    return traceRepository.findByTenantIdAndRunIdOrderByCreatedAtAsc(tenantId, run.getId()).stream()
        .map(trace -> TraceResponse.from(trace, parseMap(trace.getInputJson()), parseMap(trace.getOutputJson()), parseMap(trace.getTokenJson())))
        .collect(Collectors.toList());
  }

  private Optional<AiApp> loadApp(String tenantId, String appId) {
    return appRepository.findByTenantIdAndId(tenantId, appId);
  }

  private Map<String, Object> parseMap(String json) {
    if (json == null || json.isBlank()) {
      return Collections.emptyMap();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      Map<String, Object> fallback = new LinkedHashMap<>();
      fallback.put("raw", json);
      return fallback;
    }
  }

  public static class RunResponse {
    public String runId;
    public String tenantId;
    public String workspaceId;
    public String appId;
    public String appName;
    public String appType;
    public String appVersionId;
    public String runType;
    public String status;
    public String currentWaitTaskId;
    public int resumeCount;
    public Integer totalTokens;
    public Long latencyMs;
    public String errorMessage;
    public Map<String, Object> input;
    public Map<String, Object> output;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static RunResponse from(AiRun run, Optional<AiApp> app, Map<String, Object> input, Map<String, Object> output) {
      RunResponse response = new RunResponse();
      response.runId = run.getId();
      response.tenantId = run.getTenantId();
      response.workspaceId = run.getWorkspaceId();
      response.appId = run.getAppId();
      response.appName = app.map(AiApp::getName).orElse(run.getAppId());
      response.appType = app.map(AiApp::getType).orElse(run.getRunType());
      response.appVersionId = run.getAppVersionId();
      response.runType = run.getRunType();
      response.status = run.getStatus();
      response.currentWaitTaskId = run.getCurrentWaitTaskId();
      response.resumeCount = run.getResumeCount();
      response.totalTokens = run.getTotalTokens();
      response.latencyMs = run.getLatencyMs();
      response.errorMessage = run.getErrorMessage();
      response.input = input;
      response.output = output;
      response.createdAt = run.getCreatedAt();
      response.updatedAt = run.getUpdatedAt();
      return response;
    }
  }

  public static class TraceResponse {
    public String id;
    public String runId;
    public String parentTraceId;
    public String type;
    public String name;
    public Map<String, Object> input;
    public Map<String, Object> output;
    public String status;
    public Long latencyMs;
    public Map<String, Object> token;
    public String errorMessage;
    public OffsetDateTime createdAt;

    static TraceResponse from(AiTrace trace, Map<String, Object> input, Map<String, Object> output, Map<String, Object> token) {
      TraceResponse response = new TraceResponse();
      response.id = trace.getId();
      response.runId = trace.getRunId();
      response.parentTraceId = trace.getParentTraceId();
      response.type = trace.getType();
      response.name = trace.getName();
      response.input = input;
      response.output = output;
      response.status = trace.getStatus();
      response.latencyMs = trace.getLatencyMs();
      response.token = token;
      response.errorMessage = trace.getErrorMessage();
      response.createdAt = trace.getCreatedAt();
      return response;
    }
  }
}