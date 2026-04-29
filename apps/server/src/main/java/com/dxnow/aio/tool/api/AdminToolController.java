package com.dxnow.aio.tool.api;

import com.dxnow.aio.tool.domain.AiTool;
import com.dxnow.aio.tool.domain.McpServer;
import com.dxnow.aio.tool.service.ToolService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/admin")
public class AdminToolController {

  private final ToolService toolService;

  public AdminToolController(ToolService toolService) {
    this.toolService = toolService;
  }

  @GetMapping("/tools")
  public List<ToolResponse> listTools(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    return toolService.listTools(tenantId, workspaceId).stream().map(ToolResponse::from).collect(Collectors.toList());
  }

  @PostMapping("/tools")
  public ToolResponse createTool(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @Valid @RequestBody ToolRequest request) {
    return ToolResponse.from(toolService.saveTool(tenantId, workspaceId, null, request.toMutation()));
  }

  @PutMapping("/tools/{toolId}")
  public ToolResponse updateTool(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @PathVariable String toolId,
      @Valid @RequestBody ToolRequest request) {
    return ToolResponse.from(toolService.saveTool(tenantId, workspaceId, toolId, request.toMutation()));
  }

  @PostMapping("/tools/{toolId}/test")
  public Map<String, Object> testTool(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String toolId,
      @RequestBody(required = false) Map<String, Object> request) {
    return toolService.testTool(tenantId, toolId, request);
  }

  @GetMapping("/mcp-servers")
  public List<McpResponse> listMcpServers(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    return toolService.listMcpServers(tenantId, workspaceId).stream().map(McpResponse::from).collect(Collectors.toList());
  }

  @PostMapping("/mcp-servers")
  public McpResponse createMcpServer(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @Valid @RequestBody McpRequest request) {
    return McpResponse.from(toolService.saveMcpServer(tenantId, workspaceId, null, request.toMutation()));
  }

  @PutMapping("/mcp-servers/{serverId}")
  public McpResponse updateMcpServer(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @PathVariable String serverId,
      @Valid @RequestBody McpRequest request) {
    return McpResponse.from(toolService.saveMcpServer(tenantId, workspaceId, serverId, request.toMutation()));
  }

  @PostMapping("/mcp-servers/{serverId}/sync-tools")
  public Map<String, Object> syncMcpTools(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String serverId) {
    return toolService.syncMcpTools(tenantId, serverId);
  }

  public static class ToolRequest {
    @NotBlank @Size(max = 160) public String name;
    @NotBlank @Size(max = 40) public String type;
    public String description;
    public String inputSchema;
    public String configJson;
    @Size(max = 40) public String status;

    ToolService.ToolMutation toMutation() {
      ToolService.ToolMutation mutation = new ToolService.ToolMutation();
      mutation.name = name;
      mutation.type = type;
      mutation.description = description;
      mutation.inputSchema = inputSchema;
      mutation.configJson = configJson;
      mutation.status = status;
      return mutation;
    }
  }

  public static class McpRequest {
    @NotBlank @Size(max = 160) public String name;
    @NotBlank @Size(max = 40) public String transport;
    @Size(max = 500) public String endpoint;
    public String commandConfig;
    public String authConfig;
    @Size(max = 40) public String status;

    ToolService.McpMutation toMutation() {
      ToolService.McpMutation mutation = new ToolService.McpMutation();
      mutation.name = name;
      mutation.transport = transport;
      mutation.endpoint = endpoint;
      mutation.commandConfig = commandConfig;
      mutation.authConfig = authConfig;
      mutation.status = status;
      return mutation;
    }
  }

  public static class ToolResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String name;
    public String type;
    public String description;
    public String inputSchema;
    public String configJson;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static ToolResponse from(AiTool tool) {
      ToolResponse response = new ToolResponse();
      response.id = tool.getId();
      response.tenantId = tool.getTenantId();
      response.workspaceId = tool.getWorkspaceId();
      response.name = tool.getName();
      response.type = tool.getType();
      response.description = tool.getDescription();
      response.inputSchema = tool.getInputSchema();
      response.configJson = tool.getConfigJson();
      response.status = tool.getStatus();
      response.createdAt = tool.getCreatedAt();
      response.updatedAt = tool.getUpdatedAt();
      return response;
    }
  }

  public static class McpResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String name;
    public String transport;
    public String endpoint;
    public String commandConfig;
    public String authConfig;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static McpResponse from(McpServer server) {
      McpResponse response = new McpResponse();
      response.id = server.getId();
      response.tenantId = server.getTenantId();
      response.workspaceId = server.getWorkspaceId();
      response.name = server.getName();
      response.transport = server.getTransport();
      response.endpoint = server.getEndpoint();
      response.commandConfig = server.getCommandConfig();
      response.authConfig = server.getAuthConfig();
      response.status = server.getStatus();
      response.createdAt = server.getCreatedAt();
      response.updatedAt = server.getUpdatedAt();
      return response;
    }
  }
}