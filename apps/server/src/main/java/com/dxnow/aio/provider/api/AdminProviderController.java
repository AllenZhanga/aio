package com.dxnow.aio.provider.api;

import com.dxnow.aio.provider.domain.ModelProviderAccount;
import com.dxnow.aio.provider.service.ProviderService;
import java.time.OffsetDateTime;
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
@RequestMapping("/api/aio/admin/providers")
public class AdminProviderController {

  private final ProviderService providerService;

  public AdminProviderController(ProviderService providerService) {
    this.providerService = providerService;
  }

  @GetMapping
  public List<ProviderResponse> list(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId) {
    return providerService.list(tenantId).stream()
        .map(ProviderResponse::from)
        .collect(Collectors.toList());
  }

  @PostMapping
  public ProviderResponse create(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @Valid @RequestBody CreateProviderRequest request) {
    return ProviderResponse.from(providerService.create(
        tenantId,
        request.workspaceId,
        request.name,
        request.providerType,
        request.baseUrl,
        request.apiKey,
        request.defaultChatModel,
        request.defaultEmbeddingModel,
        request.configJson));
  }

  @PutMapping("/{providerId}")
  public ProviderResponse update(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String providerId,
      @Valid @RequestBody UpdateProviderRequest request) {
    return ProviderResponse.from(providerService.update(
        tenantId,
        providerId,
        request.workspaceId,
        request.name,
        request.providerType,
        request.baseUrl,
        request.apiKey,
        request.defaultChatModel,
        request.defaultEmbeddingModel,
        request.configJson,
        request.status));
  }

  @PostMapping("/{providerId}/test")
  public Map<String, Object> test(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String providerId) {
    return providerService.test(tenantId, providerId);
  }

  @PostMapping("/{providerId}/disable")
  public ProviderResponse disable(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String providerId) {
    return ProviderResponse.from(providerService.disable(tenantId, providerId));
  }

  public static class CreateProviderRequest {
    @NotBlank
    @Size(max = 160)
    public String name;

    @Size(max = 64)
    public String workspaceId;

    @NotBlank
    @Size(max = 60)
    public String providerType;

    @NotBlank
    @Size(max = 500)
    public String baseUrl;

    public String apiKey;

    @Size(max = 160)
    public String defaultChatModel;

    @Size(max = 160)
    public String defaultEmbeddingModel;

    public String configJson;
  }

  public static class UpdateProviderRequest extends CreateProviderRequest {
    @Size(max = 40)
    public String status;
  }

  public static class ProviderResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String name;
    public String providerType;
    public String baseUrl;
    public boolean hasApiKey;
    public String defaultChatModel;
    public String defaultEmbeddingModel;
    public String configJson;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static ProviderResponse from(ModelProviderAccount account) {
      ProviderResponse response = new ProviderResponse();
      response.id = account.getId();
      response.tenantId = account.getTenantId();
      response.workspaceId = account.getWorkspaceId();
      response.name = account.getName();
      response.providerType = account.getProviderType();
      response.baseUrl = account.getBaseUrl();
      response.hasApiKey = account.getApiKeyCiphertext() != null;
      response.defaultChatModel = account.getDefaultChatModel();
      response.defaultEmbeddingModel = account.getDefaultEmbeddingModel();
      response.configJson = account.getConfigJson();
      response.status = account.getStatus();
      response.createdAt = account.getCreatedAt();
      response.updatedAt = account.getUpdatedAt();
      return response;
    }
  }
}
