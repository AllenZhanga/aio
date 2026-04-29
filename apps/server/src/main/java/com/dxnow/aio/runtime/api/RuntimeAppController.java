package com.dxnow.aio.runtime.api;

import com.dxnow.aio.runtime.domain.AiRun;
import com.dxnow.aio.runtime.domain.AiTrace;
import com.dxnow.aio.runtime.service.RuntimeService;
import com.dxnow.aio.security.ApiKeyPrincipal;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class RuntimeAppController {

  private final RuntimeService runtimeService;

  public RuntimeAppController(RuntimeService runtimeService) {
    this.runtimeService = runtimeService;
  }

  @PostMapping("/apps/{appId}/chat")
  public Map<String, Object> chat(
      HttpServletRequest servletRequest,
      @PathVariable String appId,
      @RequestBody Map<String, Object> request) {
    AiRun run = runtimeService.chat(principal(servletRequest), appId, request);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("run_id", run.getId());
    response.put("status", run.getStatus());
    Map<String, Object> outputs = runtimeService.outputMap(run);
    response.put("conversation_id", outputs.get("conversation_id"));
    response.put("answer", outputs.get("answer"));
    response.put("usage", outputs.get("usage"));
    response.put("outputs", outputs);
    return response;
  }

  @PostMapping("/apps/{appId}/run")
  public Map<String, Object> runWorkflow(
      HttpServletRequest servletRequest,
      @PathVariable String appId,
      @RequestBody Map<String, Object> request) {
    AiRun run = runtimeService.runWorkflow(principal(servletRequest), appId, request);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("run_id", run.getId());
    response.put("status", run.getStatus());
    if ("waiting".equals(run.getStatus()) && run.getCurrentWaitTaskId() != null) {
      response.put("wait_task", runtimeService.waitTaskView(runtimeService.getWaitTask(principal(servletRequest), run.getCurrentWaitTaskId())));
    } else {
      response.put("outputs", runtimeService.outputMap(run));
    }
    return response;
  }

  @GetMapping("/runs/{runId}")
  public Map<String, Object> getRun(HttpServletRequest servletRequest, @PathVariable String runId) {
    AiRun run = runtimeService.getRun(principal(servletRequest), runId);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("run_id", run.getId());
    response.put("app_id", run.getAppId());
    response.put("status", run.getStatus());
    response.put("current_wait_task_id", run.getCurrentWaitTaskId());
    response.put("outputs", runtimeService.outputMap(run));
    response.put("created_at", run.getCreatedAt());
    response.put("updated_at", run.getUpdatedAt());
    return response;
  }

  @GetMapping("/runs/{runId}/traces")
  public List<Map<String, Object>> getTraces(HttpServletRequest servletRequest, @PathVariable String runId) {
    return runtimeService.getTraces(principal(servletRequest), runId).stream()
        .map(this::traceView)
        .collect(Collectors.toList());
  }

  @GetMapping("/wait-tasks/{waitTaskId}")
  public Map<String, Object> getWaitTask(HttpServletRequest servletRequest, @PathVariable String waitTaskId) {
    return runtimeService.waitTaskView(runtimeService.getWaitTask(principal(servletRequest), waitTaskId));
  }

  @PostMapping("/wait-tasks/{waitTaskId}/submit")
  public Map<String, Object> submitWaitTask(
      HttpServletRequest servletRequest,
      @PathVariable String waitTaskId,
      @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @RequestBody(required = false) Map<String, Object> request) {
    return runtimeService.submitWaitTask(principal(servletRequest), waitTaskId, request, idempotencyKey);
  }

  @PostMapping("/wait-tasks/{waitTaskId}/reject")
  public Map<String, Object> rejectWaitTask(
      HttpServletRequest servletRequest,
      @PathVariable String waitTaskId,
      @RequestBody(required = false) Map<String, Object> request) {
    return runtimeService.rejectWaitTask(principal(servletRequest), waitTaskId, request);
  }

  @PostMapping("/wait-tasks/{waitTaskId}/cancel")
  public Map<String, Object> cancelWaitTask(
      HttpServletRequest servletRequest,
      @PathVariable String waitTaskId,
      @RequestBody(required = false) Map<String, Object> request) {
    return runtimeService.cancelWaitTask(principal(servletRequest), waitTaskId, request);
  }

  @PostMapping("/wait-tasks/{waitTaskId}/submit-token")
  public Map<String, Object> createSubmitToken(HttpServletRequest servletRequest, @PathVariable String waitTaskId) {
    return runtimeService.createSubmitToken(principal(servletRequest), waitTaskId);
  }

  private Map<String, Object> traceView(AiTrace trace) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("id", trace.getId());
    response.put("run_id", trace.getRunId());
    response.put("type", trace.getType());
    response.put("name", trace.getName());
    response.put("input", runtimeService.parseMap(trace.getInputJson()));
    response.put("output", runtimeService.parseMap(trace.getOutputJson()));
    response.put("status", trace.getStatus());
    response.put("latency_ms", trace.getLatencyMs());
    response.put("token", runtimeService.parseMap(trace.getTokenJson()));
    response.put("error_message", trace.getErrorMessage());
    response.put("created_at", trace.getCreatedAt());
    return response;
  }

  private ApiKeyPrincipal principal(HttpServletRequest request) {
    return (ApiKeyPrincipal) request.getAttribute(ApiKeyPrincipal.REQUEST_ATTRIBUTE);
  }
}
