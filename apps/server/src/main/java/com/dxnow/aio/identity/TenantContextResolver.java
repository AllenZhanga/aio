package com.dxnow.aio.identity;

import com.dxnow.aio.config.AioProperties;
import javax.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class TenantContextResolver {

  private static final String TENANT_HEADER = "X-Aio-Tenant";
  private static final String WORKSPACE_HEADER = "X-Aio-Workspace";

  private final AioProperties properties;

  public TenantContextResolver(AioProperties properties) {
    this.properties = properties;
  }

  public TenantContext resolve(HttpServletRequest request) {
    String tenantId = headerOrDefault(request, TENANT_HEADER, properties.getDefaultTenantId());
    String workspaceId = headerOrDefault(request, WORKSPACE_HEADER, "default");
    return new TenantContext(tenantId, workspaceId);
  }

  private static String headerOrDefault(HttpServletRequest request, String name, String fallback) {
    String value = request.getHeader(name);
    if (value == null || value.trim().isEmpty()) {
      return fallback;
    }
    return value.trim();
  }
}
