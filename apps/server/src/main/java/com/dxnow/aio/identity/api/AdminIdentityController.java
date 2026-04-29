package com.dxnow.aio.identity.api;

import com.dxnow.aio.identity.domain.ApiKey;
import com.dxnow.aio.identity.domain.Tenant;
import com.dxnow.aio.identity.domain.Workspace;
import com.dxnow.aio.identity.service.IdentityService;
import com.dxnow.aio.security.ConsoleAuthService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/admin")
public class AdminIdentityController {

  private final IdentityService identityService;
  private final ConsoleAuthService authService;

  public AdminIdentityController(IdentityService identityService, ConsoleAuthService authService) {
    this.identityService = identityService;
    this.authService = authService;
  }

  @GetMapping("/tenants")
  public List<TenantResponse> listTenants() {
    return identityService.listTenants().stream()
        .map(TenantResponse::from)
        .collect(Collectors.toList());
  }

  @PostMapping("/tenants")
  public TenantResponse createTenant(@Valid @RequestBody CreateTenantRequest request) {
    return TenantResponse.from(identityService.createTenant(request.name, request.code, request.plan));
  }

  @GetMapping("/workspaces")
  public List<WorkspaceResponse> listWorkspaces(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId) {
    List<Workspace> workspaces = identityService.listWorkspaces(tenantId);
    if (!authService.isWorkspaceAdmin(userId)) {
      List<String> allowedWorkspaceIds = authService.allowedWorkspaceIds(userId);
      workspaces = workspaces.stream()
          .filter(workspace -> allowedWorkspaceIds.contains(workspace.getId()))
          .collect(Collectors.toList());
    }
    return workspaces.stream()
        .map(WorkspaceResponse::from)
        .collect(Collectors.toList());
  }

  @PostMapping("/workspaces")
  public WorkspaceResponse createWorkspace(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @Valid @RequestBody CreateWorkspaceRequest request) {
    if (!authService.isWorkspaceAdmin(userId)) {
      throw new ForbiddenException();
    }
    return WorkspaceResponse.from(identityService.createWorkspace(tenantId, request.name));
  }

  @GetMapping("/api-keys")
  public List<ApiKeyResponse> listApiKeys(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId) {
    return identityService.listApiKeys(tenantId).stream()
        .map(ApiKeyResponse::from)
        .collect(Collectors.toList());
  }

  @PostMapping("/api-keys")
  public CreatedApiKeyResponse createApiKey(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @Valid @RequestBody CreateApiKeyRequest request) {
    IdentityService.CreatedApiKey created = identityService.createApiKey(
        tenantId,
        request.workspaceId,
        request.appId,
        request.name,
        request.expiresAt,
        userId);
    return CreatedApiKeyResponse.from(created.getApiKey(), created.getSecret());
  }

  @PostMapping("/api-keys/{apiKeyId}/revoke")
  public ApiKeyResponse revokeApiKey(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String apiKeyId) {
    return ApiKeyResponse.from(identityService.revokeApiKey(tenantId, apiKeyId));
  }

  public static class CreateTenantRequest {
    @NotBlank
    @Size(max = 160)
    public String name;

    @NotBlank
    @Size(max = 80)
    public String code;

    @Size(max = 40)
    public String plan;
  }

  public static class CreateWorkspaceRequest {
    @NotBlank
    @Size(max = 160)
    public String name;
  }

  public static class CreateApiKeyRequest {
    @NotBlank
    @Size(max = 160)
    public String name;

    @Size(max = 64)
    public String workspaceId;

    @Size(max = 64)
    public String appId;

    public OffsetDateTime expiresAt;
  }

  public static class TenantResponse {
    public String id;
    public String name;
    public String code;
    public String plan;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static TenantResponse from(Tenant tenant) {
      TenantResponse response = new TenantResponse();
      response.id = tenant.getId();
      response.name = tenant.getName();
      response.code = tenant.getCode();
      response.plan = tenant.getPlan();
      response.status = tenant.getStatus();
      response.createdAt = tenant.getCreatedAt();
      response.updatedAt = tenant.getUpdatedAt();
      return response;
    }
  }

  public static class WorkspaceResponse {
    public String id;
    public String tenantId;
    public String name;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static WorkspaceResponse from(Workspace workspace) {
      WorkspaceResponse response = new WorkspaceResponse();
      response.id = workspace.getId();
      response.tenantId = workspace.getTenantId();
      response.name = workspace.getName();
      response.status = workspace.getStatus();
      response.createdAt = workspace.getCreatedAt();
      response.updatedAt = workspace.getUpdatedAt();
      return response;
    }
  }

  public static class ApiKeyResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String appId;
    public String name;
    public String keyPrefix;
    public String status;
    public OffsetDateTime expiresAt;
    public OffsetDateTime lastUsedAt;
    public OffsetDateTime createdAt;
    public String createdBy;
    public OffsetDateTime revokedAt;

    static ApiKeyResponse from(ApiKey apiKey) {
      ApiKeyResponse response = new ApiKeyResponse();
      response.id = apiKey.getId();
      response.tenantId = apiKey.getTenantId();
      response.workspaceId = apiKey.getWorkspaceId();
      response.appId = apiKey.getAppId();
      response.name = apiKey.getName();
      response.keyPrefix = apiKey.getKeyPrefix();
      response.status = apiKey.getStatus();
      response.expiresAt = apiKey.getExpiresAt();
      response.lastUsedAt = apiKey.getLastUsedAt();
      response.createdAt = apiKey.getCreatedAt();
      response.createdBy = apiKey.getCreatedBy();
      response.revokedAt = apiKey.getRevokedAt();
      return response;
    }
  }

  public static class CreatedApiKeyResponse extends ApiKeyResponse {
    public String apiKey;

    static CreatedApiKeyResponse from(ApiKey apiKey, String secret) {
      CreatedApiKeyResponse response = new CreatedApiKeyResponse();
      ApiKeyResponse base = ApiKeyResponse.from(apiKey);
      response.id = base.id;
      response.tenantId = base.tenantId;
      response.workspaceId = base.workspaceId;
      response.appId = base.appId;
      response.name = base.name;
      response.keyPrefix = base.keyPrefix;
      response.status = base.status;
      response.expiresAt = base.expiresAt;
      response.lastUsedAt = base.lastUsedAt;
      response.createdAt = base.createdAt;
      response.createdBy = base.createdBy;
      response.revokedAt = base.revokedAt;
      response.apiKey = secret;
      return response;
    }
  }

  @ResponseStatus(HttpStatus.FORBIDDEN)
  public static class ForbiddenException extends RuntimeException {
  }
}
