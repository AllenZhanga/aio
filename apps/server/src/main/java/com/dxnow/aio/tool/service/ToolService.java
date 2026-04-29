package com.dxnow.aio.tool.service;

import com.dxnow.aio.common.Ids;
import com.dxnow.aio.config.AioProperties;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import com.dxnow.aio.tool.domain.AiTool;
import com.dxnow.aio.tool.domain.McpServer;
import com.dxnow.aio.tool.repository.AiToolRepository;
import com.dxnow.aio.tool.repository.McpServerRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.persistence.EntityNotFoundException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class ToolService {

  private final WorkspaceRepository workspaceRepository;
  private final AiToolRepository toolRepository;
  private final McpServerRepository mcpServerRepository;
  private final AioProperties properties;
  private final ObjectMapper objectMapper;
  private final RestTemplate restTemplate = new RestTemplate();

  public ToolService(
      WorkspaceRepository workspaceRepository,
      AiToolRepository toolRepository,
      McpServerRepository mcpServerRepository,
      AioProperties properties,
      ObjectMapper objectMapper) {
    this.workspaceRepository = workspaceRepository;
    this.toolRepository = toolRepository;
    this.mcpServerRepository = mcpServerRepository;
    this.properties = properties;
    this.objectMapper = objectMapper;
  }

  public List<AiTool> listTools(String tenantId, String workspaceId) {
    requireWorkspace(tenantId, workspaceId);
    return toolRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
  }

  @Transactional
  public AiTool saveTool(String tenantId, String workspaceId, String toolId, ToolMutation mutation) {
    requireWorkspace(tenantId, workspaceId);
    AiTool tool = toolId == null
        ? new AiTool()
        : toolRepository.findByTenantIdAndId(tenantId, toolId)
            .orElseThrow(() -> new EntityNotFoundException("Tool not found"));
    if (toolId == null) {
      tool.setId(Ids.prefixed("tool"));
      tool.setTenantId(tenantId);
      tool.setWorkspaceId(workspaceId);
      tool.setStatus("active");
    }
    tool.setName(mutation.name);
    tool.setType(mutation.type);
    tool.setDescription(mutation.description);
    tool.setInputSchema(mutation.inputSchema);
    tool.setConfigJson(mutation.configJson);
    if (mutation.status != null && !mutation.status.isBlank()) {
      tool.setStatus(mutation.status);
    }
    return toolRepository.save(tool);
  }

  public Map<String, Object> testTool(String tenantId, String toolId, Map<String, Object> input) {
    AiTool tool = toolRepository.findByTenantIdAndId(tenantId, toolId)
        .orElseThrow(() -> new EntityNotFoundException("Tool not found"));
    return executeTool(tool, input == null ? Collections.emptyMap() : input);
  }

  public Map<String, Object> executeTool(AiTool tool, Map<String, Object> input) {
    Instant start = Instant.now();
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("tool_id", tool.getId());
    result.put("type", tool.getType());
    if ("builtin".equals(tool.getType())) {
      result.put("output", executeBuiltin(tool, input));
    } else if ("http".equals(tool.getType())) {
      result.put("output", executeHttp(tool, input));
    } else if ("mcp".equals(tool.getType())) {
      result.put("output", Collections.singletonMap("message", "MCP tool registry is ready; live MCP invocation is disabled in the lightweight runtime."));
    } else {
      throw new IllegalArgumentException("Unsupported tool type: " + tool.getType());
    }
    result.put("latency_ms", Duration.between(start, Instant.now()).toMillis());
    return result;
  }

  public List<McpServer> listMcpServers(String tenantId, String workspaceId) {
    requireWorkspace(tenantId, workspaceId);
    return mcpServerRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
  }

  @Transactional
  public McpServer saveMcpServer(String tenantId, String workspaceId, String serverId, McpMutation mutation) {
    requireWorkspace(tenantId, workspaceId);
    if ("stdio".equals(mutation.transport) && !properties.isStdioMcpEnabled()) {
      throw new IllegalArgumentException("stdio MCP is disabled by configuration");
    }
    McpServer server = serverId == null
        ? new McpServer()
        : mcpServerRepository.findByTenantIdAndId(tenantId, serverId)
            .orElseThrow(() -> new EntityNotFoundException("MCP server not found"));
    if (serverId == null) {
      server.setId(Ids.prefixed("mcp"));
      server.setTenantId(tenantId);
      server.setWorkspaceId(workspaceId);
      server.setStatus("active");
    }
    server.setName(mutation.name);
    server.setTransport(mutation.transport);
    server.setEndpoint(mutation.endpoint);
    server.setCommandConfig(mutation.commandConfig);
    server.setAuthConfig(mutation.authConfig);
    if (mutation.status != null && !mutation.status.isBlank()) {
      server.setStatus(mutation.status);
    }
    return mcpServerRepository.save(server);
  }

  public Map<String, Object> syncMcpTools(String tenantId, String serverId) {
    McpServer server = mcpServerRepository.findByTenantIdAndId(tenantId, serverId)
        .orElseThrow(() -> new EntityNotFoundException("MCP server not found"));
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("server_id", server.getId());
    response.put("transport", server.getTransport());
    response.put("synced_tools", Collections.emptyList());
    response.put("message", "MCP server saved. Tool discovery is represented as a safe no-op until a live MCP adapter is configured.");
    return response;
  }

  private Map<String, Object> executeBuiltin(AiTool tool, Map<String, Object> input) {
    Map<String, Object> output = new LinkedHashMap<>();
    output.put("name", tool.getName());
    output.put("input", input);
    output.put("now", Instant.now().toString());
    return output;
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> executeHttp(AiTool tool, Map<String, Object> input) {
    Map<String, Object> config = parseMap(tool.getConfigJson());
    String url = String.valueOf(config.getOrDefault("url", ""));
    if (url.isBlank()) {
      throw new IllegalArgumentException("HTTP tool requires config.url");
    }
    URI uri = URI.create(url);
    if (uri.getHost() == null || uri.getHost().isBlank()) {
      throw new IllegalArgumentException("HTTP tool URL must include a host");
    }
    String method = String.valueOf(config.getOrDefault("method", "POST")).toUpperCase();
    HttpHeaders headers = new HttpHeaders();
    Object headerConfig = config.get("headers");
    if (headerConfig instanceof Map) {
      ((Map<String, Object>) headerConfig).forEach((key, value) -> headers.add(key, String.valueOf(value)));
    }
    Object body = input;
    if (config.containsKey("body")) {
      body = config.get("body");
    }
    ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.valueOf(method), new HttpEntity<>(body, headers), String.class);
    Map<String, Object> output = new LinkedHashMap<>();
    output.put("status", response.getStatusCodeValue());
    output.put("body", response.getBody());
    return output;
  }

  private Map<String, Object> parseMap(String json) {
    if (json == null || json.isBlank()) {
      return new LinkedHashMap<>();
    }
    try {
      return objectMapper.readValue(json, new TypeReference<Map<String, Object>>() {});
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON config", e);
    }
  }

  private void requireWorkspace(String tenantId, String workspaceId) {
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> tenantId.equals(workspace.getTenantId()))
        .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
  }

  public static class ToolMutation {
    public String name;
    public String type;
    public String description;
    public String inputSchema;
    public String configJson;
    public String status;
  }

  public static class McpMutation {
    public String name;
    public String transport;
    public String endpoint;
    public String commandConfig;
    public String authConfig;
    public String status;
  }
}