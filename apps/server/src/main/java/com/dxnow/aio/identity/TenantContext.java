package com.dxnow.aio.identity;

import java.util.Objects;

public final class TenantContext {

  private final String tenantId;
  private final String workspaceId;

  public TenantContext(String tenantId, String workspaceId) {
    this.tenantId = Objects.requireNonNull(tenantId, "tenantId must not be null");
    this.workspaceId = workspaceId;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getWorkspaceId() {
    return workspaceId;
  }
}
