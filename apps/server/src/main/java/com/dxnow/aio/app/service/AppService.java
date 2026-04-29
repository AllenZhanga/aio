package com.dxnow.aio.app.service;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.domain.AiAppVersion;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.app.repository.AiAppVersionRepository;
import com.dxnow.aio.common.Ids;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import java.util.List;
import java.util.stream.Collectors;
import javax.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppService {

  private final AiAppRepository appRepository;
  private final AiAppVersionRepository versionRepository;
  private final WorkspaceRepository workspaceRepository;
  private final AppValidationService validationService;

  public AppService(
      AiAppRepository appRepository,
      AiAppVersionRepository versionRepository,
      WorkspaceRepository workspaceRepository,
      AppValidationService validationService) {
    this.appRepository = appRepository;
    this.versionRepository = versionRepository;
    this.workspaceRepository = workspaceRepository;
    this.validationService = validationService;
  }

  public List<AiApp> list(String tenantId, String workspaceId) {
    return appRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId).stream()
        .filter(app -> !"archived".equals(app.getStatus()))
        .collect(Collectors.toList());
  }

  @Transactional
  public AiApp create(
      String tenantId,
      String workspaceId,
      String name,
      String type,
      String description,
      String visibility) {
    requireWorkspace(tenantId, workspaceId);
    AiApp app = new AiApp();
    app.setId(Ids.prefixed("app"));
    app.setTenantId(tenantId);
    app.setWorkspaceId(workspaceId);
    app.setName(name);
    app.setType(type);
    app.setDescription(description);
    app.setVisibility(visibility == null || visibility.isBlank() ? "private" : visibility);
    app.setStatus("draft");
    return appRepository.save(app);
  }

  public AiApp get(String tenantId, String appId) {
    return appRepository.findByTenantIdAndId(tenantId, appId)
        .orElseThrow(() -> new EntityNotFoundException("App not found"));
  }

  @Transactional
  public AiApp update(
      String tenantId,
      String appId,
      String name,
      String description,
      String visibility,
      String status) {
    AiApp app = get(tenantId, appId);
    if (name != null && !name.isBlank()) {
      app.setName(name);
    }
    app.setDescription(description);
    if (visibility != null && !visibility.isBlank()) {
      app.setVisibility(visibility);
    }
    if (status != null && !status.isBlank()) {
      app.setStatus(status);
    }
    return appRepository.save(app);
  }

  @Transactional
  public AiApp archive(String tenantId, String appId) {
    AiApp app = get(tenantId, appId);
    app.setStatus("archived");
    return appRepository.save(app);
  }

  public List<AiAppVersion> versions(String tenantId, String appId) {
    get(tenantId, appId);
    return versionRepository.findByTenantIdAndAppIdOrderByVersionNoDesc(tenantId, appId);
  }

  @Transactional
  public AiAppVersion saveVersion(String tenantId, String appId, String definitionJson) {
    AiApp app = get(tenantId, appId);
    int nextVersion = versionRepository.findFirstByTenantIdAndAppIdOrderByVersionNoDesc(tenantId, appId)
        .map(version -> version.getVersionNo() + 1)
        .orElse(1);
    AiAppVersion version = new AiAppVersion();
    version.setId(Ids.prefixed("ver"));
    version.setTenantId(app.getTenantId());
    version.setWorkspaceId(app.getWorkspaceId());
    version.setAppId(app.getId());
    version.setVersionNo(nextVersion);
    version.setType(app.getType());
    version.setDefinitionJson(definitionJson);
    version.setPublishStatus("draft");
    return versionRepository.save(version);
  }

  @Transactional
  public AiApp publish(String tenantId, String appId, String versionId, String userId) {
    AiApp app = get(tenantId, appId);
    AiAppVersion version = versionRepository.findByTenantIdAndId(tenantId, versionId)
        .filter(item -> appId.equals(item.getAppId()))
        .orElseThrow(() -> new EntityNotFoundException("App version not found"));
    AppValidationService.ValidationReport report = validationService.validate(app.getType(), version.getDefinitionJson());
    if (!report.passed) {
      throw new IllegalArgumentException("Publish validation failed: " + report.blockingErrors + " blocking issue(s)");
    }
    version.publish(userId);
    versionRepository.save(version);
    app.setPublishedVersionId(version.getId());
    app.setStatus("published");
    return appRepository.save(app);
  }

  private void requireWorkspace(String tenantId, String workspaceId) {
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> tenantId.equals(workspace.getTenantId()))
        .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
  }
}
