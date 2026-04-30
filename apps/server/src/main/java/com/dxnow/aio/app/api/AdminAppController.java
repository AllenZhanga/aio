package com.dxnow.aio.app.api;

import com.dxnow.aio.app.domain.AiApp;
import com.dxnow.aio.app.domain.AiAppDraft;
import com.dxnow.aio.app.domain.AiAppVersion;
import com.dxnow.aio.runtime.domain.AiRun;
import com.dxnow.aio.runtime.service.RuntimeService;
import com.dxnow.aio.app.service.AppService;
import com.dxnow.aio.app.service.AppValidationService;
import java.time.OffsetDateTime;
import java.util.Collections;
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
@RequestMapping("/api/aio/admin/apps")
public class AdminAppController {

  private final AppService appService;
  private final AppValidationService validationService;
  private final RuntimeService runtimeService;

  public AdminAppController(AppService appService, AppValidationService validationService, RuntimeService runtimeService) {
    this.appService = appService;
    this.validationService = validationService;
    this.runtimeService = runtimeService;
  }

  @GetMapping
  public List<AppResponse> list(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    return appService.list(tenantId, workspaceId).stream()
        .map(AppResponse::from)
        .collect(Collectors.toList());
  }

  @PostMapping
  public AppResponse create(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @Valid @RequestBody CreateAppRequest request) {
    return AppResponse.from(appService.create(
        tenantId,
        workspaceId,
        request.name,
        request.type,
        request.description,
        request.visibility));
  }

  @GetMapping("/{appId}")
  public AppResponse get(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String appId) {
    return AppResponse.from(appService.get(tenantId, appId));
  }

  @PutMapping("/{appId}")
  public AppResponse update(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String appId,
      @Valid @RequestBody UpdateAppRequest request) {
    return AppResponse.from(appService.update(
        tenantId,
        appId,
        request.name,
        request.description,
        request.visibility,
        request.status));
  }

  @PostMapping("/{appId}/archive")
  public AppResponse archive(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String appId) {
    return AppResponse.from(appService.archive(tenantId, appId));
  }

  @GetMapping("/{appId}/versions")
  public List<AppVersionResponse> versions(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String appId) {
    return appService.versions(tenantId, appId).stream()
        .map(AppVersionResponse::from)
        .collect(Collectors.toList());
  }

  @GetMapping("/{appId}/draft")
  public AppDraftResponse getDraft(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @PathVariable String appId) {
    return AppDraftResponse.from(appService.getOrCreateDraft(tenantId, appId, userId));
  }

  @PutMapping("/{appId}/draft")
  public AppDraftResponse saveDraft(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @PathVariable String appId,
      @Valid @RequestBody SaveDraftRequest request) {
    return AppDraftResponse.from(appService.saveDraft(tenantId, appId, request.definitionJson, request.revision, userId));
  }

  @PostMapping("/{appId}/draft/validate")
  public DraftValidationResponse validateDraft(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @PathVariable String appId) {
    return DraftValidationResponse.from(appService.validateDraft(tenantId, appId, userId));
  }

  @PostMapping("/{appId}/draft/run")
  public DraftRunResponse runDraft(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @PathVariable String appId,
      @RequestBody(required = false) Map<String, Object> request) {
    AiAppDraft draft = appService.getOrCreateDraft(tenantId, appId, userId);
    AiRun run = runtimeService.runDraft(tenantId, appId, draft.getDefinitionJson(), request == null ? Collections.emptyMap() : request, draft.getRevision());
    return DraftRunResponse.from(draft, run, runtimeService.outputMap(run));
  }

  @PostMapping("/{appId}/draft/publish")
  public DraftPublishResponse publishDraft(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @PathVariable String appId) {
    return DraftPublishResponse.from(appService.publishDraft(tenantId, appId, userId));
  }

  @PostMapping("/{appId}/versions")
  public AppVersionResponse saveVersion(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String appId,
      @Valid @RequestBody SaveVersionRequest request) {
    return AppVersionResponse.from(appService.saveVersion(tenantId, appId, request.definitionJson));
  }

  @PostMapping("/{appId}/validate")
  public AppValidationService.ValidationReport validate(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String appId,
      @Valid @RequestBody SaveVersionRequest request) {
    AiApp app = appService.get(tenantId, appId);
    return validationService.validate(app.getType(), request.definitionJson);
  }

  @PostMapping("/{appId}/publish")
  public AppResponse publish(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-User", required = false) String userId,
      @PathVariable String appId,
      @Valid @RequestBody PublishRequest request) {
    return AppResponse.from(appService.publish(tenantId, appId, request.versionId, userId));
  }

  public static class CreateAppRequest {
    @NotBlank
    @Size(max = 160)
    public String name;
    @NotBlank
    @Size(max = 40)
    public String type;
    public String description;
    @Size(max = 40)
    public String visibility;
  }

  public static class UpdateAppRequest {
    @Size(max = 160)
    public String name;
    public String description;
    @Size(max = 40)
    public String visibility;
    @Size(max = 40)
    public String status;
  }

  public static class SaveVersionRequest {
    @NotBlank
    public String definitionJson;
  }

  public static class SaveDraftRequest {
    @NotBlank
    public String definitionJson;
    public Integer revision;
  }

  public static class PublishRequest {
    @NotBlank
    public String versionId;
  }

  public static class AppResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String name;
    public String type;
    public String description;
    public String visibility;
    public String status;
    public String publishedVersionId;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static AppResponse from(AiApp app) {
      AppResponse response = new AppResponse();
      response.id = app.getId();
      response.tenantId = app.getTenantId();
      response.workspaceId = app.getWorkspaceId();
      response.name = app.getName();
      response.type = app.getType();
      response.description = app.getDescription();
      response.visibility = app.getVisibility();
      response.status = app.getStatus();
      response.publishedVersionId = app.getPublishedVersionId();
      response.createdAt = app.getCreatedAt();
      response.updatedAt = app.getUpdatedAt();
      return response;
    }
  }

  public static class AppDraftResponse {
    public String id;
    public String appId;
    public String baseVersionId;
    public String definitionJson;
    public String validationJson;
    public int revision;
    public boolean dirty;
    public String autosavedBy;
    public OffsetDateTime autosavedAt;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static AppDraftResponse from(AiAppDraft draft) {
      AppDraftResponse response = new AppDraftResponse();
      response.id = draft.getId();
      response.appId = draft.getAppId();
      response.baseVersionId = draft.getBaseVersionId();
      response.definitionJson = draft.getDefinitionJson();
      response.validationJson = draft.getValidationJson();
      response.revision = draft.getRevision();
      response.dirty = draft.isDirty();
      response.autosavedBy = draft.getAutosavedBy();
      response.autosavedAt = draft.getAutosavedAt();
      response.createdAt = draft.getCreatedAt();
      response.updatedAt = draft.getUpdatedAt();
      return response;
    }
  }

  public static class DraftValidationResponse {
    public AppDraftResponse draft;
    public AppValidationService.ValidationReport report;

    static DraftValidationResponse from(AppService.DraftValidationResult result) {
      DraftValidationResponse response = new DraftValidationResponse();
      response.draft = AppDraftResponse.from(result.draft);
      response.report = result.report;
      return response;
    }
  }

  public static class DraftPublishResponse {
    public AppResponse app;
    public AppVersionResponse version;
    public AppDraftResponse draft;
    public AppValidationService.ValidationReport report;

    static DraftPublishResponse from(AppService.DraftPublishResult result) {
      DraftPublishResponse response = new DraftPublishResponse();
      response.app = AppResponse.from(result.app);
      response.version = AppVersionResponse.from(result.version);
      response.draft = AppDraftResponse.from(result.draft);
      response.report = result.report;
      return response;
    }
  }

  public static class DraftRunResponse {
    public AppDraftResponse draft;
    public String runId;
    public String runType;
    public String status;
    public String currentWaitTaskId;
    public String errorMessage;
    public Map<String, Object> outputs;

    static DraftRunResponse from(AiAppDraft draft, AiRun run, Map<String, Object> outputs) {
      DraftRunResponse response = new DraftRunResponse();
      response.draft = AppDraftResponse.from(draft);
      response.runId = run.getId();
      response.runType = run.getRunType();
      response.status = run.getStatus();
      response.currentWaitTaskId = run.getCurrentWaitTaskId();
      response.errorMessage = run.getErrorMessage();
      response.outputs = outputs;
      return response;
    }
  }

  public static class AppVersionResponse {
    public String id;
    public String appId;
    public int versionNo;
    public String type;
    public String definitionJson;
    public String publishStatus;
    public OffsetDateTime publishedAt;
    public String publishedBy;
    public OffsetDateTime createdAt;

    static AppVersionResponse from(AiAppVersion version) {
      AppVersionResponse response = new AppVersionResponse();
      response.id = version.getId();
      response.appId = version.getAppId();
      response.versionNo = version.getVersionNo();
      response.type = version.getType();
      response.definitionJson = version.getDefinitionJson();
      response.publishStatus = version.getPublishStatus();
      response.publishedAt = version.getPublishedAt();
      response.publishedBy = version.getPublishedBy();
      response.createdAt = version.getCreatedAt();
      return response;
    }
  }
}
