package com.dxnow.aio.app.service;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.domain.AiAppDraft;
import com.dxnow.aio.app.domain.AiAppVersion;
import com.dxnow.aio.app.repository.AiAppDraftRepository;
import com.dxnow.aio.app.repository.AiAppRepository;
import com.dxnow.aio.app.repository.AiAppVersionRepository;
import com.dxnow.aio.common.Ids;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.stream.Collectors;
import javax.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppService {

  private final AiAppRepository appRepository;
  private final AiAppVersionRepository versionRepository;
  private final AiAppDraftRepository draftRepository;
  private final WorkspaceRepository workspaceRepository;
  private final AppValidationService validationService;
  private final ObjectMapper objectMapper;

  public AppService(
      AiAppRepository appRepository,
      AiAppVersionRepository versionRepository,
      AiAppDraftRepository draftRepository,
      WorkspaceRepository workspaceRepository,
      AppValidationService validationService,
      ObjectMapper objectMapper) {
    this.appRepository = appRepository;
    this.versionRepository = versionRepository;
    this.draftRepository = draftRepository;
    this.workspaceRepository = workspaceRepository;
    this.validationService = validationService;
    this.objectMapper = objectMapper;
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
  public AiAppDraft getOrCreateDraft(String tenantId, String appId, String userId) {
    AiApp app = get(tenantId, appId);
    return draftRepository.findByTenantIdAndAppId(tenantId, appId)
        .orElseGet(() -> draftRepository.save(newDraft(app, userId)));
  }

  @Transactional
  public AiAppDraft saveDraft(String tenantId, String appId, String definitionJson, Integer revision, String userId) {
    if (definitionJson == null || definitionJson.isBlank()) {
      throw new IllegalArgumentException("Draft definition cannot be empty");
    }
    AiAppDraft draft = getOrCreateDraft(tenantId, appId, userId);
    if (revision != null && revision > 0 && revision != draft.getRevision()) {
      throw new IllegalStateException("Draft revision conflict, please reload the latest draft");
    }
    draft.setDefinitionJson(definitionJson);
    draft.markSaved(userId);
    return draftRepository.save(draft);
  }

  @Transactional
  public DraftValidationResult validateDraft(String tenantId, String appId, String userId) {
    AiApp app = get(tenantId, appId);
    AiAppDraft draft = getOrCreateDraft(tenantId, appId, userId);
    AppValidationService.ValidationReport report = validationService.validate(app.getType(), draft.getDefinitionJson());
    draft.setValidationJson(toJson(report));
    return new DraftValidationResult(draftRepository.save(draft), report);
  }

  @Transactional
  public DraftPublishResult publishDraft(String tenantId, String appId, String userId) {
    AiApp app = get(tenantId, appId);
    AiAppDraft draft = getOrCreateDraft(tenantId, appId, userId);
    AppValidationService.ValidationReport report = validationService.validate(app.getType(), draft.getDefinitionJson());
    if (!report.passed) {
      draft.setValidationJson(toJson(report));
      draftRepository.save(draft);
      throw new IllegalArgumentException("Publish validation failed: " + report.blockingErrors + " blocking issue(s)");
    }
    AiAppVersion version = createVersion(app, draft.getDefinitionJson(), "draft");
    version.publish(userId);
    versionRepository.save(version);
    app.setPublishedVersionId(version.getId());
    app.setStatus("published");
    AiApp savedApp = appRepository.save(app);
    draft.markPublished(version.getId(), toJson(report));
    AiAppDraft savedDraft = draftRepository.save(draft);
    return new DraftPublishResult(savedApp, version, savedDraft, report);
  }

  @Transactional
  public AiAppVersion saveVersion(String tenantId, String appId, String definitionJson) {
    AiApp app = get(tenantId, appId);
    return versionRepository.save(createVersion(app, definitionJson, "draft"));
  }

  private AiAppVersion createVersion(AiApp app, String definitionJson, String publishStatus) {
    int nextVersion = versionRepository.findFirstByTenantIdAndAppIdOrderByVersionNoDesc(app.getTenantId(), app.getId())
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
    version.setPublishStatus(publishStatus);
    return version;
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

  private AiAppDraft newDraft(AiApp app, String userId) {
    AiAppVersion baseVersion = baseVersion(app);
    AiAppDraft draft = new AiAppDraft();
    draft.setId(Ids.prefixed("draft"));
    draft.setTenantId(app.getTenantId());
    draft.setWorkspaceId(app.getWorkspaceId());
    draft.setAppId(app.getId());
    draft.setBaseVersionId(baseVersion == null ? null : baseVersion.getId());
    draft.setDefinitionJson(baseVersion == null ? defaultDefinitionJson(app) : baseVersion.getDefinitionJson());
    draft.setRevision(1);
    draft.setDirty(baseVersion == null);
    draft.setAutosavedBy(userId);
    return draft;
  }

  private AiAppVersion baseVersion(AiApp app) {
    if (app.getPublishedVersionId() != null && !app.getPublishedVersionId().isBlank()) {
      return versionRepository.findByTenantIdAndId(app.getTenantId(), app.getPublishedVersionId())
          .filter(version -> app.getId().equals(version.getAppId()))
          .orElse(null);
    }
    return versionRepository.findFirstByTenantIdAndAppIdOrderByVersionNoDesc(app.getTenantId(), app.getId())
        .orElse(null);
  }

  private String defaultDefinitionJson(AiApp app) {
    if ("workflow".equals(app.getType())) {
      return "{\n"
          + "  \"type\": \"workflow\",\n"
          + "  \"version\": 1,\n"
          + "  \"inputs\": [{ \"name\": \"question\", \"type\": \"string\", \"required\": true }],\n"
          + "  \"variables\": [],\n"
          + "  \"nodes\": [],\n"
          + "  \"edges\": [],\n"
          + "  \"ui\": { \"nodes\": [], \"viewport\": { \"x\": 0, \"y\": 0, \"zoom\": 1 } }\n"
          + "}";
    }
    return "{\n"
        + "  \"type\": \"agent\",\n"
        + "  \"agentMode\": \"agent\",\n"
        + "  \"prompt\": { \"system\": \"你是企业内部知识助手，回答要简洁、准确、可执行。\" },\n"
        + "  \"model\": { \"providerAccountId\": \"\", \"chatModel\": \"\", \"temperature\": 0.3 },\n"
        + "  \"knowledge\": [],\n"
        + "  \"ui\": { \"opening\": \"你好，我可以帮你处理知识问答、售后咨询和流程指引。\" }\n"
        + "}";
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (JsonProcessingException exception) {
      return "{}";
    }
  }

  public static class DraftValidationResult {
    public final AiAppDraft draft;
    public final AppValidationService.ValidationReport report;

    public DraftValidationResult(AiAppDraft draft, AppValidationService.ValidationReport report) {
      this.draft = draft;
      this.report = report;
    }
  }

  public static class DraftPublishResult {
    public final AiApp app;
    public final AiAppVersion version;
    public final AiAppDraft draft;
    public final AppValidationService.ValidationReport report;

    public DraftPublishResult(AiApp app, AiAppVersion version, AiAppDraft draft, AppValidationService.ValidationReport report) {
      this.app = app;
      this.version = version;
      this.draft = draft;
      this.report = report;
    }
  }
}
