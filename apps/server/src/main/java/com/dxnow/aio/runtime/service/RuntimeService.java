package com.dxnow.aio.runtime.service;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.domain.AiAppVersion;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.app.repository.AiAppVersionRepository;
import com.dxnow.aio.common.Ids;
import com.dxnow.aio.common.CryptoService;
import com.dxnow.aio.common.Sha256;
import com.dxnow.aio.config.AioProperties;
import com.dxnow.aio.knowledge.service.KnowledgeService;
import com.dxnow.aio.provider.domain.ModelProviderAccount;
import com.dxnow.aio.provider.repository.ModelProviderAccountRepository;
import com.dxnow.aio.runtime.domain.AiRun;
import com.dxnow.aio.runtime.domain.AiTrace;
import com.dxnow.aio.runtime.domain.AiWaitTask;
import com.dxnow.aio.runtime.repository.AiRunRepository;
import com.dxnow.aio.runtime.repository.AiTraceRepository;
import com.dxnow.aio.runtime.repository.AiWaitTaskRepository;
import com.dxnow.aio.security.ApiKeyPrincipal;
import com.dxnow.aio.tool.domain.AiTool;
import com.dxnow.aio.tool.repository.AiToolRepository;
import com.dxnow.aio.tool.service.ToolService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import javax.persistence.EntityNotFoundException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class RuntimeService {

  private final AiAppRepository appRepository;
  private final AiAppVersionRepository versionRepository;
  private final AiRunRepository runRepository;
  private final AiTraceRepository traceRepository;
  private final AiWaitTaskRepository waitTaskRepository;
  private final ModelProviderAccountRepository providerRepository;
  private final AiToolRepository toolRepository;
  private final KnowledgeService knowledgeService;
  private final ToolService toolService;
  private final CryptoService cryptoService;
  private final AioProperties properties;
  private final ObjectMapper objectMapper;
  private final RestTemplate restTemplate = new RestTemplate();

  public RuntimeService(
      AiAppRepository appRepository,
      AiAppVersionRepository versionRepository,
      AiRunRepository runRepository,
      AiTraceRepository traceRepository,
      AiWaitTaskRepository waitTaskRepository,
      ModelProviderAccountRepository providerRepository,
      AiToolRepository toolRepository,
      KnowledgeService knowledgeService,
      ToolService toolService,
      CryptoService cryptoService,
      AioProperties properties,
      ObjectMapper objectMapper) {
    this.appRepository = appRepository;
    this.versionRepository = versionRepository;
    this.runRepository = runRepository;
    this.traceRepository = traceRepository;
    this.waitTaskRepository = waitTaskRepository;
    this.providerRepository = providerRepository;
    this.toolRepository = toolRepository;
    this.knowledgeService = knowledgeService;
    this.toolService = toolService;
    this.cryptoService = cryptoService;
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public AiRun chat(ApiKeyPrincipal principal, String appId, Map<String, Object> request) {
    Instant start = Instant.now();
    AiApp app = loadRunnableApp(principal, appId, "agent");
    AiAppVersion version = versionRepository.findByTenantIdAndId(principal.getTenantId(), app.getPublishedVersionId())
        .orElseThrow(() -> new EntityNotFoundException("Published app version not found"));

    AiRun run = new AiRun();
    run.setId(Ids.prefixed("run"));
    run.setTenantId(app.getTenantId());
    run.setWorkspaceId(app.getWorkspaceId());
    run.setAppId(app.getId());
    run.setAppVersionId(version.getId());
    run.setRunType("agent");
    run.setInputJson(toJson(request));
    run.setStatus("running");
    run = runRepository.save(run);
    try {
      Map<String, Object> output = invokeAgent(app, version, request, run);
      run.setOutputJson(toJson(output));
      run.setTotalTokens(asInt(castMap(output.get("usage")).get("total_tokens")));
      run.setStatus("success");
    } catch (RuntimeException exception) {
      run.setStatus("failed");
      run.setErrorMessage(exception.getMessage());
      createTrace(run, "agent", "agent.error", request, Collections.emptyMap(), "failed", 0, null, exception.getMessage());
    }
    run.setLatencyMs(Duration.between(start, Instant.now()).toMillis());
    return runRepository.save(run);
  }

  @Transactional
  public AiRun runWorkflow(ApiKeyPrincipal principal, String appId, Map<String, Object> request) {
    Instant start = Instant.now();
    AiApp app = loadRunnableApp(principal, appId, "workflow");
    AiAppVersion version = versionRepository.findByTenantIdAndId(principal.getTenantId(), app.getPublishedVersionId())
        .orElseThrow(() -> new EntityNotFoundException("Published app version not found"));
    AiRun run = new AiRun();
    run.setId(Ids.prefixed("run"));
    run.setTenantId(app.getTenantId());
    run.setWorkspaceId(app.getWorkspaceId());
    run.setAppId(app.getId());
    run.setAppVersionId(version.getId());
    run.setRunType("workflow");
    run.setInputJson(toJson(request));
    run.setStatus("running");
    run = runRepository.save(run);
    try {
      executeWorkflow(run, version, newWorkflowContext(request), null);
    } catch (RuntimeException exception) {
      run.setStatus("failed");
      run.setErrorMessage(exception.getMessage());
      createTrace(run, "workflow_node", "workflow.error", request, Collections.emptyMap(), "failed", 0, null, exception.getMessage());
    }
    run.setLatencyMs(Duration.between(start, Instant.now()).toMillis());
    return runRepository.save(run);
  }

  public AiRun getRun(ApiKeyPrincipal principal, String runId) {
    AiRun run = runRepository.findByTenantIdAndId(principal.getTenantId(), runId)
        .orElseThrow(() -> new EntityNotFoundException("Run not found"));
    enforceRunScope(principal, run);
    return run;
  }

  public List<AiTrace> getTraces(ApiKeyPrincipal principal, String runId) {
    getRun(principal, runId);
    return traceRepository.findByTenantIdAndRunIdOrderByCreatedAtAsc(principal.getTenantId(), runId);
  }

  public AiWaitTask getWaitTask(ApiKeyPrincipal principal, String waitTaskId) {
    AiWaitTask task = waitTaskRepository.findByTenantIdAndId(principal.getTenantId(), waitTaskId)
        .orElseThrow(() -> new EntityNotFoundException("Wait task not found"));
    enforceWaitTaskScope(principal, task);
    return task;
  }

  @Transactional
  public Map<String, Object> submitWaitTask(ApiKeyPrincipal principal, String waitTaskId, Map<String, Object> request, String idempotencyKey) {
    AiWaitTask task = getWaitTask(principal, waitTaskId);
    AiRun run = getRun(principal, task.getRunId());
    if (!"pending".equals(task.getStatus())) {
      if (idempotencyKey != null && idempotencyKey.equals(task.getIdempotencyKey())) {
        return waitSubmitResponse(task, run, null);
      }
      throw new IllegalArgumentException("Wait task is not pending");
    }
    if (task.getExpiresAt() != null && task.getExpiresAt().isBefore(OffsetDateTime.now())) {
      task.setStatus("expired");
      run.setStatus("expired");
      waitTaskRepository.save(task);
      runRepository.save(run);
      throw new IllegalArgumentException("Wait task is expired");
    }
    task.setSubmitResultJson(toJson(request));
    task.setIdempotencyKey(idempotencyKey);
    task.setSubmittedAt(OffsetDateTime.now());
    task.setSubmittedBy(stringValue(request.get("submitted_by")));
    String action = stringValue(request.getOrDefault("action", "submit"));
    task.setStatus("reject".equals(action) || "rejected".equals(action) ? "rejected" : "submitted");
    waitTaskRepository.save(task);
    run.setResumeCount(run.getResumeCount() + 1);
    run.setCurrentWaitTaskId(null);
    run.setStatus("running");
    runRepository.save(run);
    Map<String, Object> state = workflowState(run);
    Map<String, Object> context = castMap(state.getOrDefault("context", new LinkedHashMap<>()));
    context.put(task.getNodeId(), request == null ? Collections.emptyMap() : request);
    AiAppVersion version = versionRepository.findByTenantIdAndId(principal.getTenantId(), run.getAppVersionId())
        .orElseThrow(() -> new EntityNotFoundException("Published app version not found"));
    executeWorkflow(run, version, context, task.getNodeId());
    run = runRepository.save(run);
    AiWaitTask next = run.getCurrentWaitTaskId() == null ? null : getWaitTask(principal, run.getCurrentWaitTaskId());
    return waitSubmitResponse(task, run, next);
  }

  @Transactional
  public Map<String, Object> rejectWaitTask(ApiKeyPrincipal principal, String waitTaskId, Map<String, Object> request) {
    Map<String, Object> body = request == null ? new LinkedHashMap<>() : new LinkedHashMap<>(request);
    body.put("action", "reject");
    return submitWaitTask(principal, waitTaskId, body, null);
  }

  @Transactional
  public Map<String, Object> cancelWaitTask(ApiKeyPrincipal principal, String waitTaskId, Map<String, Object> request) {
    AiWaitTask task = getWaitTask(principal, waitTaskId);
    AiRun run = getRun(principal, task.getRunId());
    task.setStatus("cancelled");
    task.setSubmitResultJson(toJson(request == null ? Collections.emptyMap() : request));
    task.setSubmittedAt(OffsetDateTime.now());
    waitTaskRepository.save(task);
    run.setStatus("cancelled");
    run.setCurrentWaitTaskId(null);
    runRepository.save(run);
    return waitSubmitResponse(task, run, null);
  }

  @Transactional
  public Map<String, Object> createSubmitToken(ApiKeyPrincipal principal, String waitTaskId) {
    AiWaitTask task = getWaitTask(principal, waitTaskId);
    String token = "wt_" + Ids.randomBase36(36);
    task.setSubmitTokenHash(Sha256.hex(token));
    waitTaskRepository.save(task);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("submit_url", "/public/wait-tasks/" + task.getId() + "?token=" + token);
    response.put("expires_at", task.getExpiresAt());
    return response;
  }

  public Map<String, Object> outputMap(AiRun run) {
    return parseMap(run.getOutputJson());
  }

  private Map<String, Object> invokeAgent(AiApp app, AiAppVersion version, Map<String, Object> request, AiRun run) {
    Map<String, Object> definition = parseMap(version.getDefinitionJson());
    Map<String, Object> model = castMap(definition.getOrDefault("model", Collections.emptyMap()));
    Map<String, Object> prompt = castMap(definition.getOrDefault("prompt", Collections.emptyMap()));
    String query = stringValue(request.get("query"));
    List<Map<String, Object>> retrieved = retrieveForAgent(app.getTenantId(), app.getWorkspaceId(), definition, query);
    String system = stringValue(prompt.getOrDefault("system", "你是 Aio 平台中的企业智能助手。"));
    if (!retrieved.isEmpty()) {
      system += "\n\n请优先依据以下知识片段回答；如果知识片段不足，再明确说明缺口并给出可执行建议。\n可用知识片段：\n" + joinKnowledge(retrieved);
    }
    Map<String, Object> llmInput = new LinkedHashMap<>();
    llmInput.put("system", system);
    llmInput.put("query", query);
    llmInput.put("model", model);
    llmInput.put("knowledge", retrieved);
    LlmResult llm = callChatModel(app.getTenantId(), model, system, query);
    llmInput.put("provider_request", llm.request);
    Map<String, Object> llmOutput = new LinkedHashMap<>();
    llmOutput.put("answer", llm.answer);
    llmOutput.put("provider_response", llm.response);
    createTrace(run, "llm", "agent.chat", llmInput, llmOutput, "success", llm.latencyMs, llm.usage, null);
    List<Map<String, Object>> toolOutputs = executeConfiguredTools(app.getTenantId(), definition, request, run);
    Map<String, Object> output = new LinkedHashMap<>();
    output.put("answer", llm.answer);
    output.put("conversation_id", request.getOrDefault("conversation_id", Ids.prefixed("conv")));
    output.put("knowledge", retrieved);
    output.put("tool_outputs", toolOutputs);
    output.put("usage", llm.usage);
    return output;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> retrieveForAgent(String tenantId, String workspaceId, Map<String, Object> definition, String query) {
    Object knowledge = definition.get("knowledge");
    if (!(knowledge instanceof List)) {
      return Collections.emptyList();
    }
    List<Map<String, Object>> records = new ArrayList<>();
    for (Object item : (List<Object>) knowledge) {
      Map<String, Object> config = castMap(item);
      String datasetId = stringValue(config.get("datasetId"));
      if (datasetId.isBlank()) {
        continue;
      }
      if (!workspaceId.equals(knowledgeService.getDataset(tenantId, datasetId).getWorkspaceId())) {
        throw new IllegalArgumentException("Knowledge dataset is not scoped to this workspace");
      }
      int topK = asInt(config.getOrDefault("topK", 5));
      double threshold = asDouble(config.getOrDefault("scoreThreshold", 0.0));
      records.addAll(knowledgeService.retrieve(tenantId, datasetId, query, topK, threshold));
    }
    return records;
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> executeConfiguredTools(String tenantId, Map<String, Object> definition, Map<String, Object> request, AiRun run) {
    Object tools = definition.get("tools");
    if (!(tools instanceof List)) {
      return Collections.emptyList();
    }
    List<Map<String, Object>> outputs = new ArrayList<>();
    for (Object item : (List<Object>) tools) {
      Map<String, Object> config = castMap(item);
      String toolId = stringValue(config.get("toolId"));
      if (toolId.isBlank()) {
        continue;
      }
      Optional<AiTool> tool = toolRepository.findByTenantIdAndId(tenantId, toolId);
      if (tool.isPresent() && "active".equals(tool.get().getStatus())) {
        Map<String, Object> output = toolService.executeTool(tool.get(), request);
        outputs.add(output);
        createTrace(run, "tool", tool.get().getName(), request, output, "success", asLong(output.get("latency_ms")), null, null);
      }
    }
    return outputs;
  }

  @SuppressWarnings("unchecked")
  private void executeWorkflow(AiRun run, AiAppVersion version, Map<String, Object> context, String resumeFromNodeId) {
    Map<String, Object> definition = parseMap(version.getDefinitionJson());
    List<Map<String, Object>> nodes = (List<Map<String, Object>>) definition.getOrDefault("nodes", Collections.emptyList());
    List<Map<String, Object>> edges = (List<Map<String, Object>>) definition.getOrDefault("edges", Collections.emptyList());
    if (nodes.isEmpty()) {
      throw new IllegalArgumentException("Workflow definition requires nodes");
    }
    String current = resumeFromNodeId == null ? firstNode(nodes) : nextNodeId(edges, resumeFromNodeId, context);
    Set<String> visited = new HashSet<>();
    int steps = 0;
    while (current != null && steps++ < 200) {
      Map<String, Object> node = findNode(nodes, current);
      String type = stringValue(node.get("type"));
      Map<String, Object> config = castMap(node.getOrDefault("config", Collections.emptyMap()));
      Instant started = Instant.now();
      if ("user_confirm".equals(type) || "user_form".equals(type)) {
        AiTrace trace = createTrace(run, "workflow_node", current, config, Collections.singletonMap("status", "waiting"), "success", Duration.between(started, Instant.now()).toMillis(), null, null);
        AiWaitTask task = createWaitTask(run, trace, node, config, context);
        run.setStatus("waiting");
        run.setCurrentWaitTaskId(task.getId());
        run.setOutputJson(toJson(workflowState(context, current)));
        return;
      }
      Map<String, Object> output = executeWorkflowNode(run, type, config, context);
      context.put(current, output);
      Object traceInput = output.remove("__traceInput");
      Object traceOutput = output.remove("__traceOutput");
      Object traceToken = output.remove("__traceToken");
      createTrace(run, "workflow_node", current, traceInput == null ? config : traceInput, traceOutput == null ? output : traceOutput, "success", Duration.between(started, Instant.now()).toMillis(), traceToken, null);
      if ("end".equals(type)) {
        run.setStatus("success");
        run.setOutputJson(toJson(output));
        return;
      }
      current = nextNodeId(edges, current, context);
      if (current != null && !visited.add(current + ":" + steps)) {
        throw new IllegalArgumentException("Workflow loop detected");
      }
    }
    run.setStatus("success");
    run.setOutputJson(toJson(context));
  }

  private Map<String, Object> executeWorkflowNode(AiRun run, String type, Map<String, Object> config, Map<String, Object> context) {
    Map<String, Object> output = new LinkedHashMap<>();
    if ("start".equals(type)) {
      output.put("inputs", context.get("inputs"));
    } else if ("variable".equals(type)) {
      for (Map.Entry<String, Object> entry : config.entrySet()) {
        output.put(entry.getKey(), interpolate(entry.getValue(), context));
      }
    } else if ("condition".equals(type)) {
      output.put("matched", evaluateCondition(stringValue(config.get("expression")), context));
    } else if ("knowledge_retrieval".equals(type)) {
      String datasetId = stringValue(interpolate(config.get("datasetId"), context));
      String query = stringValue(interpolate(config.get("query"), context));
      if (!run.getWorkspaceId().equals(knowledgeService.getDataset(run.getTenantId(), datasetId).getWorkspaceId())) {
        throw new IllegalArgumentException("Knowledge dataset is not scoped to this workspace");
      }
      output.put("chunks", knowledgeService.retrieve(run.getTenantId(), datasetId, query, asInt(config.getOrDefault("topK", 5)), asDouble(config.getOrDefault("scoreThreshold", 0.0))));
    } else if ("llm".equals(type)) {
      String prompt = stringValue(interpolate(config.getOrDefault("prompt", ""), context));
      LlmResult llm = callChatModel(run.getTenantId(), config, "你是工作流中的 LLM 节点。", prompt);
      output.put("text", llm.answer);
      output.put("usage", llm.usage);
      Map<String, Object> traceInput = new LinkedHashMap<>();
      traceInput.put("system", "你是工作流中的 LLM 节点。");
      traceInput.put("prompt", prompt);
      traceInput.put("node_config", config);
      traceInput.put("provider_request", llm.request);
      Map<String, Object> traceOutput = new LinkedHashMap<>();
      traceOutput.put("text", llm.answer);
      traceOutput.put("provider_response", llm.response);
      output.put("__traceInput", traceInput);
      output.put("__traceOutput", traceOutput);
      output.put("__traceToken", llm.usage);
    } else if ("tool".equals(type)) {
      String toolId = stringValue(interpolate(config.get("toolId"), context));
      AiTool tool = toolRepository.findByTenantIdAndId(run.getTenantId(), toolId)
          .filter(item -> run.getWorkspaceId().equals(item.getWorkspaceId()))
          .filter(item -> "active".equals(item.getStatus()))
          .orElseThrow(() -> new EntityNotFoundException("Tool not found in workspace"));
      Object inputConfig = config.containsKey("input") ? interpolate(config.get("input"), context) : context;
      output.putAll(toolService.executeTool(tool, castMap(inputConfig)));
    } else if ("agent".equals(type)) {
      output.put("answer", "Agent node executed: " + stringValue(interpolate(config.get("query"), context)));
    } else if ("http_request".equals(type)) {
      AiTool tool = new AiTool();
      tool.setId("inline_http");
      tool.setTenantId(run.getTenantId());
      tool.setWorkspaceId(run.getWorkspaceId());
      tool.setName("Inline HTTP Request");
      tool.setType("http");
      tool.setConfigJson(toJson(config));
      output.putAll(toolService.executeTool(tool, context));
    } else if ("code".equals(type)) {
      if (!properties.isCodeNodeEnabled()) {
        throw new IllegalArgumentException("Code node is disabled by configuration");
      }
      output.put("message", "Code node is enabled but sandbox execution is intentionally not bundled in the lightweight runtime.");
    } else if ("end".equals(type)) {
      output.put("outputs", interpolate(config.getOrDefault("output", context), context));
    } else {
      output.put("message", "Unsupported node type treated as no-op: " + type);
    }
    return output;
  }

  private AiWaitTask createWaitTask(AiRun run, AiTrace trace, Map<String, Object> node, Map<String, Object> config, Map<String, Object> context) {
    AiWaitTask task = new AiWaitTask();
    task.setId(Ids.prefixed("wait"));
    task.setTenantId(run.getTenantId());
    task.setWorkspaceId(run.getWorkspaceId());
    task.setAppId(run.getAppId());
    task.setAppVersionId(run.getAppVersionId());
    task.setRunId(run.getId());
    task.setTraceId(trace.getId());
    task.setNodeId(stringValue(node.get("id")));
    task.setNodeType(stringValue(node.get("type")));
    task.setTitle(stringValue(interpolate(config.getOrDefault("title", task.getNodeType()), context)));
    task.setDescription(stringValue(interpolate(config.getOrDefault("description", ""), context)));
    Map<String, Object> assignee = castMap(config.getOrDefault("assignee", Collections.emptyMap()));
    task.setAssigneeType(stringValue(assignee.get("type")));
    task.setAssigneeId(stringValue(interpolate(assignee.get("id"), context)));
    task.setFormSchemaJson(toJson(config.getOrDefault("formSchema", Collections.emptyMap())));
    task.setUiSchemaJson(toJson(config.getOrDefault("uiSchema", Collections.emptyMap())));
    task.setActionSchemaJson(toJson(config.getOrDefault("actions", Collections.emptyList())));
    task.setDefaultValuesJson(toJson(config.getOrDefault("defaultValues", Collections.emptyMap())));
    task.setContextJson(toJson(context));
    task.setStatus("pending");
    int expires = asInt(config.getOrDefault("expiresInSeconds", 86400));
    task.setExpiresAt(OffsetDateTime.now().plusSeconds(expires <= 0 ? 86400 : expires));
    return waitTaskRepository.save(task);
  }

  private LlmResult callChatModel(String tenantId, Map<String, Object> model, String systemPrompt, String userPrompt) {
    Instant start = Instant.now();
    String providerId = stringValue(model.get("providerAccountId"));
    if (providerId.isBlank()) {
      Map<String, Object> usage = new LinkedHashMap<>();
      usage.put("prompt_tokens", estimateTokens(systemPrompt) + estimateTokens(userPrompt));
      usage.put("completion_tokens", 24);
      usage.put("total_tokens", asInt(usage.get("prompt_tokens")) + 24);
      Map<String, Object> request = new LinkedHashMap<>();
      request.put("provider", "local_fallback");
      List<Map<String, String>> fallbackMessages = new ArrayList<>();
      fallbackMessages.add(message("system", systemPrompt));
      fallbackMessages.add(message("user", userPrompt));
      request.put("messages", fallbackMessages);
      Map<String, Object> response = new LinkedHashMap<>();
      response.put("mode", "local_fallback");
      return new LlmResult("未配置模型供应商，Aio 已完成运行链路并返回本地兜底回复：" + userPrompt, usage, Duration.between(start, Instant.now()).toMillis(), request, response);
    }
    ModelProviderAccount provider = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    String apiKey = cryptoService.decrypt(provider.effectiveLlmApiKeyCiphertext());
    String chatModel = stringValue(model.getOrDefault("chatModel", provider.effectiveLlmModel()));
    if (chatModel.isBlank()) {
      throw new IllegalArgumentException("Chat model is required");
    }
    Map<String, Object> llmConfig = parseMap(provider.getLlmConfigJson());
    String protocol = stringValue(llmConfig.get("protocol"));
    if ("dashscope".equalsIgnoreCase(provider.getProviderType()) || "dashscope_generation".equalsIgnoreCase(protocol)) {
      return callDashScopeGeneration(provider, apiKey, chatModel, model, llmConfig, systemPrompt, userPrompt, start);
    }
    String baseUrl = provider.effectiveLlmBaseUrl();
    String url = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : baseUrl.replaceAll("/+$", "") + "/chat/completions";
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("model", chatModel);
    body.put("temperature", asDouble(model.getOrDefault("temperature", 0.3)));
    if (model.containsKey("maxTokens")) {
      body.put("max_tokens", asInt(model.get("maxTokens")));
    }
    List<Map<String, String>> messages = new ArrayList<>();
    messages.add(message("system", systemPrompt));
    messages.add(message("user", userPrompt));
    body.put("messages", messages);
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (apiKey != null && !apiKey.isBlank()) {
      headers.setBearerAuth(apiKey);
    }
    Map<String, Object> requestTrace = llmRequestTrace(provider, "openai_chat_completions", url, body);
    try {
      ResponseEntity<String> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), String.class);
      JsonNode root = objectMapper.readTree(response.getBody());
      String answer = root.path("choices").path(0).path("message").path("content").asText("");
      Map<String, Object> usage = new LinkedHashMap<>();
      usage.put("prompt_tokens", root.path("usage").path("prompt_tokens").asInt(estimateTokens(systemPrompt) + estimateTokens(userPrompt)));
      usage.put("completion_tokens", root.path("usage").path("completion_tokens").asInt(estimateTokens(answer)));
      usage.put("total_tokens", root.path("usage").path("total_tokens").asInt(asInt(usage.get("prompt_tokens")) + asInt(usage.get("completion_tokens"))));
      Map<String, Object> responseTrace = new LinkedHashMap<>();
      responseTrace.put("status_code", response.getStatusCodeValue());
      responseTrace.put("body", parseJsonOrRaw(response.getBody()));
      return new LlmResult(answer, usage, Duration.between(start, Instant.now()).toMillis(), requestTrace, responseTrace);
    } catch (Exception e) {
      throw new IllegalArgumentException("LLM provider call failed: " + e.getMessage(), e);
    }
  }

  private LlmResult callDashScopeGeneration(
      ModelProviderAccount provider,
      String apiKey,
      String chatModel,
      Map<String, Object> model,
      Map<String, Object> llmConfig,
      String systemPrompt,
      String userPrompt,
      Instant start) {
    String baseUrl = provider.effectiveLlmBaseUrl();
    String url = baseUrl.endsWith("/generation")
      ? baseUrl
      : baseUrl.replaceAll("/+$", "") + "/api/v1/services/aigc/text-generation/generation";
    Map<String, Object> parameters = castMap(llmConfig.get("parameters"));
    parameters.putIfAbsent("enable_thinking", true);
    parameters.putIfAbsent("incremental_output", false);
    parameters.putIfAbsent("result_format", "message");
    parameters.putIfAbsent("temperature", asDouble(model.getOrDefault("temperature", 0.3)));
    if (model.containsKey("maxTokens")) {
      parameters.putIfAbsent("max_tokens", asInt(model.get("maxTokens")));
    }
    Map<String, Object> input = new LinkedHashMap<>();
    List<Map<String, String>> messages = new ArrayList<>();
    if (!stringValue(systemPrompt).isBlank()) {
      messages.add(message("system", systemPrompt));
    }
    messages.add(message("user", userPrompt));
    input.put("messages", messages);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("model", chatModel);
    body.put("input", input);
    body.put("parameters", parameters);
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    if (apiKey != null && !apiKey.isBlank()) {
      headers.setBearerAuth(apiKey);
    }
    if (Boolean.TRUE.equals(llmConfig.get("sse"))) {
      headers.set("X-DashScope-SSE", "enable");
    }
    Map<String, Object> requestTrace = llmRequestTrace(provider, "dashscope_generation", url, body);
    requestTrace.put("sse", Boolean.TRUE.equals(llmConfig.get("sse")));
    try {
      ResponseEntity<String> response = restTemplate.postForEntity(url, new HttpEntity<>(body, headers), String.class);
      String responseBody = response.getBody() == null ? "" : response.getBody();
      JsonNode root = parseDashScopeResponse(responseBody);
      String answer = dashScopeAnswer(root, responseBody);
      JsonNode usageNode = root.path("usage");
      Map<String, Object> usage = new LinkedHashMap<>();
      usage.put("prompt_tokens", usageNode.path("input_tokens").asInt(estimateTokens(systemPrompt) + estimateTokens(userPrompt)));
      usage.put("completion_tokens", usageNode.path("output_tokens").asInt(estimateTokens(answer)));
      usage.put("total_tokens", usageNode.path("total_tokens").asInt(asInt(usage.get("prompt_tokens")) + asInt(usage.get("completion_tokens"))));
      Map<String, Object> responseTrace = new LinkedHashMap<>();
      responseTrace.put("status_code", response.getStatusCodeValue());
      responseTrace.put("body", root);
      if (responseBody.trim().startsWith("data:")) {
        responseTrace.put("raw_sse", responseBody);
      }
      return new LlmResult(answer, usage, Duration.between(start, Instant.now()).toMillis(), requestTrace, responseTrace);
    } catch (Exception e) {
      throw new IllegalArgumentException("DashScope LLM provider call failed: " + e.getMessage(), e);
    }
  }

  private JsonNode parseDashScopeResponse(String responseBody) throws JsonProcessingException {
    String trimmed = responseBody.trim();
    if (!trimmed.startsWith("data:")) {
      return objectMapper.readTree(responseBody);
    }
    String lastJson = trimmed.lines()
      .map(String::trim)
      .filter(line -> line.startsWith("data:"))
      .map(line -> line.substring(5).trim())
      .filter(line -> !line.isBlank() && !"[DONE]".equals(line))
      .reduce((previous, current) -> current)
      .orElse("{}");
    return objectMapper.readTree(lastJson);
  }

  private Map<String, Object> llmRequestTrace(ModelProviderAccount provider, String protocol, String url, Map<String, Object> body) {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("protocol", protocol);
    request.put("url", url);
    request.put("provider", provider.getId());
    request.put("provider_name", provider.getName());
    request.put("provider_type", provider.getProviderType());
    Map<String, Object> headers = new LinkedHashMap<>();
    headers.put("Content-Type", "application/json");
    headers.put("Authorization", "Bearer ***");
    request.put("headers", headers);
    request.put("body", body);
    return request;
  }

  private Object parseJsonOrRaw(String body) {
    Object parsed = parseObject(body);
    if (parsed != null) return parsed;
    Map<String, Object> raw = new LinkedHashMap<>();
    raw.put("raw", body == null ? "" : body);
    return raw;
  }

  private String dashScopeAnswer(JsonNode root, String rawBody) {
    JsonNode choices = root.path("output").path("choices");
    if (choices.isArray() && choices.size() > 0) {
      String content = choices.path(0).path("message").path("content").asText("");
      if (!content.isBlank()) return content;
      content = choices.path(0).path("message").path("reasoning_content").asText("");
      if (!content.isBlank()) return content;
      content = choices.path(0).path("text").asText("");
      if (!content.isBlank()) return content;
    }
    String text = root.path("output").path("text").asText("");
    return text.isBlank() ? rawBody : text;
  }

  private AiTrace createTrace(AiRun run, String type, String name, Object input, Object output, String status, long latencyMs, Object token, String error) {
    AiTrace trace = new AiTrace();
    trace.setId(Ids.prefixed("trace"));
    trace.setTenantId(run.getTenantId());
    trace.setWorkspaceId(run.getWorkspaceId());
    trace.setRunId(run.getId());
    trace.setType(type);
    trace.setName(name);
    trace.setInputJson(toJson(input));
    trace.setOutputJson(toJson(output));
    trace.setStatus(status);
    trace.setLatencyMs(latencyMs);
    trace.setTokenJson(token == null ? null : toJson(token));
    trace.setErrorMessage(error);
    return traceRepository.save(trace);
  }

  private AiApp loadRunnableApp(ApiKeyPrincipal principal, String appId, String expectedType) {
    AiApp app = appRepository.findByTenantIdAndId(principal.getTenantId(), appId)
        .orElseThrow(() -> new EntityNotFoundException("App not found"));
    if (!expectedType.equals(app.getType())) {
      throw new IllegalArgumentException("App type does not support this runtime API");
    }
    if (!"published".equals(app.getStatus()) || app.getPublishedVersionId() == null) {
      throw new IllegalArgumentException("App is not published");
    }
    if (principal.getWorkspaceId() != null && !principal.getWorkspaceId().equals(app.getWorkspaceId())) {
      throw new IllegalArgumentException("API key is not scoped to this workspace");
    }
    if (principal.getAppId() != null && !principal.getAppId().equals(app.getId())) {
      throw new IllegalArgumentException("API key is not scoped to this app");
    }
    return app;
  }

  private void enforceRunScope(ApiKeyPrincipal principal, AiRun run) {
    if (principal.getWorkspaceId() != null && !principal.getWorkspaceId().equals(run.getWorkspaceId())) {
      throw new IllegalArgumentException("API key is not scoped to this workspace");
    }
    if (principal.getAppId() != null && !principal.getAppId().equals(run.getAppId())) {
      throw new IllegalArgumentException("API key is not scoped to this app");
    }
  }

  private void enforceWaitTaskScope(ApiKeyPrincipal principal, AiWaitTask task) {
    if (principal.getWorkspaceId() != null && !principal.getWorkspaceId().equals(task.getWorkspaceId())) {
      throw new IllegalArgumentException("API key is not scoped to this workspace");
    }
    if (principal.getAppId() != null && !principal.getAppId().equals(task.getAppId())) {
      throw new IllegalArgumentException("API key is not scoped to this app");
    }
  }

  private Map<String, Object> newWorkflowContext(Map<String, Object> request) {
    Map<String, Object> context = new LinkedHashMap<>();
    context.put("inputs", request == null ? Collections.emptyMap() : request.getOrDefault("inputs", Collections.emptyMap()));
    context.put("metadata", request == null ? Collections.emptyMap() : request.getOrDefault("metadata", Collections.emptyMap()));
    return context;
  }

  private Map<String, Object> workflowState(AiRun run) {
    Map<String, Object> state = parseMap(run.getOutputJson());
    if (state.containsKey("__workflow_state")) {
      return castMap(state.get("__workflow_state"));
    }
    return state;
  }

  private Map<String, Object> workflowState(Map<String, Object> context, String pendingNodeId) {
    Map<String, Object> wrapper = new LinkedHashMap<>();
    Map<String, Object> state = new LinkedHashMap<>();
    state.put("context", context);
    state.put("pending_node_id", pendingNodeId);
    wrapper.put("__workflow_state", state);
    return wrapper;
  }

  private String firstNode(List<Map<String, Object>> nodes) {
    return nodes.stream()
        .filter(node -> "start".equals(stringValue(node.get("type"))))
        .findFirst()
        .map(node -> stringValue(node.get("id")))
        .orElse(stringValue(nodes.get(0).get("id")));
  }

  private Map<String, Object> findNode(List<Map<String, Object>> nodes, String nodeId) {
    return nodes.stream()
        .filter(node -> nodeId.equals(stringValue(node.get("id"))))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Workflow node not found: " + nodeId));
  }

  private String nextNodeId(List<Map<String, Object>> edges, String from, Map<String, Object> context) {
    for (Map<String, Object> edge : edges) {
      if (!from.equals(stringValue(edge.get("from")))) {
        continue;
      }
      String condition = stringValue(edge.get("condition"));
      if (condition.isBlank() || evaluateCondition(condition, context)) {
        return stringValue(edge.get("to"));
      }
    }
    return null;
  }

  private boolean evaluateCondition(String expression, Map<String, Object> context) {
    if (expression == null || expression.isBlank()) {
      return true;
    }
    String value = expression.trim();
    if (value.startsWith("{{") && value.endsWith("}}")) {
      value = value.substring(2, value.length() - 2).trim();
    } else {
      value = stringValue(interpolate(expression, context)).trim();
    }
    if (value.contains("==")) {
      String[] parts = value.split("==", 2);
      return stringValue(resolvePath(parts[0].trim(), context)).equals(stripQuotes(parts[1].trim()));
    }
    if (value.contains("!=")) {
      String[] parts = value.split("!=", 2);
      return !stringValue(resolvePath(parts[0].trim(), context)).equals(stripQuotes(parts[1].trim()));
    }
    Object resolved = resolvePath(value, context);
    if (resolved instanceof Boolean) {
      return (Boolean) resolved;
    }
    return "true".equalsIgnoreCase(stringValue(resolved));
  }

  private Object interpolate(Object value, Map<String, Object> context) {
    if (!(value instanceof String)) {
      return value;
    }
    String text = (String) value;
    if (text.startsWith("{{") && text.endsWith("}}") && text.indexOf("{{", 2) < 0) {
      return resolvePath(text.substring(2, text.length() - 2).trim(), context);
    }
    String result = text;
    int start = result.indexOf("{{");
    while (start >= 0) {
      int end = result.indexOf("}}", start);
      if (end < 0) {
        break;
      }
      String path = result.substring(start + 2, end).trim();
      result = result.substring(0, start) + stringValue(resolvePath(path, context)) + result.substring(end + 2);
      start = result.indexOf("{{", start + 1);
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private Object resolvePath(String path, Map<String, Object> context) {
    String[] parts = path.split("\\.");
    Object current = context;
    for (String part : parts) {
      if (current instanceof Map) {
        current = ((Map<String, Object>) current).get(part);
      } else {
        return null;
      }
    }
    return current;
  }

  private Map<String, String> message(String role, String content) {
    Map<String, String> message = new LinkedHashMap<>();
    message.put("role", role);
    message.put("content", content == null ? "" : content);
    return message;
  }

  private String joinKnowledge(List<Map<String, Object>> records) {
    StringBuilder builder = new StringBuilder();
    int index = 1;
    for (Map<String, Object> record : records) {
      builder.append(index++).append(". ").append(record.get("content")).append("\n");
    }
    return builder.toString();
  }

  private Map<String, Object> waitSubmitResponse(AiWaitTask task, AiRun run, AiWaitTask next) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("wait_task_id", task.getId());
    response.put("run_id", run.getId());
    response.put("wait_task_status", task.getStatus());
    response.put("run_status", run.getStatus());
    if (next != null) {
      response.put("next_wait_task", waitTaskView(next));
    }
    return response;
  }

  public Map<String, Object> waitTaskView(AiWaitTask task) {
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("id", task.getId());
    response.put("run_id", task.getRunId());
    response.put("status", task.getStatus());
    response.put("type", task.getNodeType());
    response.put("title", task.getTitle());
    response.put("description", task.getDescription());
    response.put("form_schema", parseMap(task.getFormSchemaJson()));
    response.put("ui_schema", parseMap(task.getUiSchemaJson()));
    response.put("actions", parseObject(task.getActionSchemaJson()));
    response.put("default_values", parseMap(task.getDefaultValuesJson()));
    response.put("context", parseMap(task.getContextJson()));
    response.put("expires_at", task.getExpiresAt());
    return response;
  }

  public Map<String, Object> parseMap(String json) {
    if (json == null || json.isBlank()) {
      return new LinkedHashMap<>();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      return new LinkedHashMap<>();
    }
  }

  private Object parseObject(String json) {
    if (json == null || json.isBlank()) {
      return null;
    }
    try {
      return objectMapper.readValue(json, Object.class);
    } catch (Exception e) {
      return null;
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> castMap(Object value) {
    if (value instanceof Map) {
      return (Map<String, Object>) value;
    }
    return new LinkedHashMap<>();
  }

  private String stripQuotes(String value) {
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith("\"") && value.endsWith("\""))) {
      return value.substring(1, value.length() - 1);
    }
    return value;
  }

  private String stringValue(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private int asInt(Object value) {
    if (value instanceof Number) {
      return ((Number) value).intValue();
    }
    try {
      return Integer.parseInt(stringValue(value));
    } catch (Exception e) {
      return 0;
    }
  }

  private long asLong(Object value) {
    if (value instanceof Number) {
      return ((Number) value).longValue();
    }
    try {
      return Long.parseLong(stringValue(value));
    } catch (Exception e) {
      return 0;
    }
  }

  private double asDouble(Object value) {
    if (value instanceof Number) {
      return ((Number) value).doubleValue();
    }
    try {
      return Double.parseDouble(stringValue(value));
    } catch (Exception e) {
      return 0;
    }
  }

  private int estimateTokens(String value) {
    return Math.max(1, stringValue(value).length() / 4);
  }

  private static class LlmResult {
    final String answer;
    final Map<String, Object> usage;
    final long latencyMs;
    final Map<String, Object> request;
    final Map<String, Object> response;

    LlmResult(String answer, Map<String, Object> usage, long latencyMs, Map<String, Object> request, Map<String, Object> response) {
      this.answer = answer;
      this.usage = usage;
      this.latencyMs = latencyMs;
      this.request = request;
      this.response = response;
    }
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid JSON payload", e);
    }
  }
}
