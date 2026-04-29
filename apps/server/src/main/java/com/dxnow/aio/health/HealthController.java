package com.dxnow.aio.health;

import com.dxnow.aio.config.AioProperties;
import com.dxnow.aio.identity.TenantContext;
import com.dxnow.aio.identity.TenantContextResolver;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

  private final AioProperties properties;
  private final TenantContextResolver tenantContextResolver;

  public HealthController(AioProperties properties, TenantContextResolver tenantContextResolver) {
    this.properties = properties;
    this.tenantContextResolver = tenantContextResolver;
  }

  @GetMapping("/health")
  public Map<String, Object> health(HttpServletRequest request) {
    TenantContext tenantContext = tenantContextResolver.resolve(request);
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("status", "ok");
    body.put("service", "aio");
    body.put("time", OffsetDateTime.now().toString());
    body.put("app_mode", properties.getAppMode());
    body.put("deployment_profile", properties.getDeploymentProfile());
    body.put("tenant_id", tenantContext.getTenantId());
    body.put("workspace_id", tenantContext.getWorkspaceId());
    return body;
  }
}
