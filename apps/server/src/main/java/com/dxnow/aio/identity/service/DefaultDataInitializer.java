package com.dxnow.aio.identity.service;

import com.dxnow.aio.config.AioProperties;
import com.dxnow.aio.identity.domain.Tenant;
import com.dxnow.aio.identity.domain.Workspace;
import com.dxnow.aio.identity.repository.TenantRepository;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DefaultDataInitializer implements ApplicationRunner {

  private final AioProperties properties;
  private final TenantRepository tenantRepository;
  private final WorkspaceRepository workspaceRepository;

  public DefaultDataInitializer(
      AioProperties properties,
      TenantRepository tenantRepository,
      WorkspaceRepository workspaceRepository) {
    this.properties = properties;
    this.tenantRepository = tenantRepository;
    this.workspaceRepository = workspaceRepository;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    String tenantId = properties.getDefaultTenantId();
    if (!tenantRepository.existsById(tenantId)) {
      Tenant tenant = new Tenant();
      tenant.setId(tenantId);
      tenant.setName("Default Tenant");
      tenant.setCode("default");
      tenant.setPlan("private");
      tenant.setStatus("active");
      tenantRepository.save(tenant);
    }
    boolean hasDefaultWorkspace = workspaceRepository.findByTenantIdOrderByCreatedAtDesc(tenantId).stream()
        .anyMatch(workspace -> "default".equals(workspace.getId()));
    if (!hasDefaultWorkspace) {
      Workspace workspace = new Workspace();
      workspace.setId("default");
      workspace.setTenantId(tenantId);
      workspace.setName("Default Workspace");
      workspace.setStatus("active");
      workspaceRepository.save(workspace);
    }
  }
}
