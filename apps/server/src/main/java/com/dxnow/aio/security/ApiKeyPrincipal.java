package com.dxnow.aio.security;

public class ApiKeyPrincipal {

  public static final String REQUEST_ATTRIBUTE = ApiKeyPrincipal.class.getName();

  private final String apiKeyId;
  private final String tenantId;
  private final String workspaceId;
  private final String appId;

  public ApiKeyPrincipal(String apiKeyId, String tenantId, String workspaceId, String appId) {
    this.apiKeyId = apiKeyId;
    this.tenantId = tenantId;
    this.workspaceId = workspaceId;
    this.appId = appId;
  }

  public String getApiKeyId() { return apiKeyId; }
  public String getTenantId() { return tenantId; }
  public String getWorkspaceId() { return workspaceId; }
  public String getAppId() { return appId; }
}
