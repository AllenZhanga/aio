package com.dxnow.aio.identity.service;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.common.Ids;
import com.dxnow.aio.common.Sha256;
import com.dxnow.aio.identity.domain.ApiKey;
import com.dxnow.aio.identity.domain.Tenant;
import com.dxnow.aio.identity.domain.Workspace;
import com.dxnow.aio.identity.repository.ApiKeyRepository;
import com.dxnow.aio.identity.repository.TenantRepository;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import java.time.OffsetDateTime;
import java.util.List;
import javax.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityService {

  private final TenantRepository tenantRepository;
  private final WorkspaceRepository workspaceRepository;
  private final ApiKeyRepository apiKeyRepository;
  private final AiAppRepository appRepository;

  public IdentityService(
      TenantRepository tenantRepository,
      WorkspaceRepository workspaceRepository,
      ApiKeyRepository apiKeyRepository,
      AiAppRepository appRepository) {
    this.tenantRepository = tenantRepository;
    this.workspaceRepository = workspaceRepository;
    this.apiKeyRepository = apiKeyRepository;
    this.appRepository = appRepository;
  }

  public List<Tenant> listTenants() {
    return tenantRepository.findByStatusOrderByCreatedAtDesc("active");
  }

  @Transactional
  public Tenant createTenant(String name, String code, String plan) {
    if (tenantRepository.existsByCode(code)) {
      throw new IllegalArgumentException("Tenant code already exists");
    }
    Tenant tenant = new Tenant();
    tenant.setId(Ids.prefixed("tenant"));
    tenant.setName(name);
    tenant.setCode(code);
    tenant.setPlan(plan == null || plan.isBlank() ? "private" : plan);
    tenant.setStatus("active");
    return tenantRepository.save(tenant);
  }

  public List<Workspace> listWorkspaces(String tenantId) {
    requireTenant(tenantId);
    return workspaceRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
  }

  @Transactional
  public Workspace createWorkspace(String tenantId, String name) {
    requireTenant(tenantId);
    Workspace workspace = new Workspace();
    workspace.setId(Ids.prefixed("ws"));
    workspace.setTenantId(tenantId);
    workspace.setName(name);
    workspace.setStatus("active");
    return workspaceRepository.save(workspace);
  }

  public List<ApiKey> listApiKeys(String tenantId) {
    requireTenant(tenantId);
    return apiKeyRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
  }

  public List<ApiKey> listApiKeys(String tenantId, String workspaceId) {
    requireTenant(tenantId);
    return apiKeyRepository.findByTenantIdOrderByCreatedAtDesc(tenantId).stream()
        .filter(apiKey -> workspaceId != null && workspaceId.equals(apiKey.getWorkspaceId()))
        .collect(java.util.stream.Collectors.toList());
  }

  public ApiKey getApiKey(String tenantId, String apiKeyId) {
    return apiKeyRepository.findByTenantIdAndId(tenantId, apiKeyId)
        .orElseThrow(() -> new EntityNotFoundException("API key not found"));
  }

  @Transactional
  public CreatedApiKey createApiKey(
      String tenantId,
      String workspaceId,
      String appId,
      String name,
      OffsetDateTime expiresAt,
      String createdBy) {
    requireTenant(tenantId);
    if (workspaceId != null && !workspaceId.isBlank()) {
      workspaceRepository.findById(workspaceId)
          .filter(workspace -> tenantId.equals(workspace.getTenantId()))
          .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
    }
    if (appId != null && !appId.isBlank()) {
      AiApp app = appRepository.findByTenantIdAndId(tenantId, appId)
          .orElseThrow(() -> new EntityNotFoundException("App not found in tenant"));
      if (workspaceId != null && !workspaceId.isBlank() && !workspaceId.equals(app.getWorkspaceId())) {
        throw new IllegalArgumentException("API key app scope must belong to the selected workspace");
      }
      workspaceId = app.getWorkspaceId();
    }

    String secret = "sk_" + Ids.randomBase36(40);
    ApiKey apiKey = new ApiKey();
    apiKey.setId(Ids.prefixed("key"));
    apiKey.setTenantId(tenantId);
    apiKey.setWorkspaceId(blankToNull(workspaceId));
    apiKey.setAppId(blankToNull(appId));
    apiKey.setName(name);
    apiKey.setKeyPrefix(secret.substring(0, 10));
    apiKey.setKeyHash(Sha256.hex(secret));
    apiKey.setStatus("active");
    apiKey.setExpiresAt(expiresAt);
    apiKey.setCreatedBy(blankToNull(createdBy));
    return new CreatedApiKey(apiKeyRepository.save(apiKey), secret);
  }

  @Transactional
  public ApiKey revokeApiKey(String tenantId, String apiKeyId) {
    ApiKey apiKey = getApiKey(tenantId, apiKeyId);
    apiKey.revoke();
    return apiKeyRepository.save(apiKey);
  }

  private void requireTenant(String tenantId) {
    if (!tenantRepository.existsById(tenantId)) {
      throw new EntityNotFoundException("Tenant not found");
    }
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  public static class CreatedApiKey {
    private final ApiKey apiKey;
    private final String secret;

    CreatedApiKey(ApiKey apiKey, String secret) {
      this.apiKey = apiKey;
      this.secret = secret;
    }

    public ApiKey getApiKey() {
      return apiKey;
    }

    public String getSecret() {
      return secret;
    }
  }
}
