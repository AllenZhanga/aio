package com.dxnow.aio.provider.api;

import com.dxnow.aio.provider.domain.ModelProviderAccount;
import com.dxnow.aio.provider.service.ProviderService;
import com.dxnow.aio.provider.service.ProviderService.ProviderMutation;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import org.springframework.web.bind.annotation.DeleteMapping;
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
      request.toMutation()));
  }

  @PutMapping("/{providerId}")
  public ProviderResponse update(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String providerId,
      @Valid @RequestBody UpdateProviderRequest request) {
    return ProviderResponse.from(providerService.update(
        tenantId,
        providerId,
      request.toMutation()));
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

  @DeleteMapping("/{providerId}")
  public void delete(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @PathVariable String providerId) {
    providerService.delete(tenantId, providerId);
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

    @Size(max = 500)
    public String llmBaseUrl;

    public String llmApiKey;

    @Size(max = 160)
    public String llmModel;

    public String llmConfigJson;

    @Size(max = 500)
    public String embeddingBaseUrl;

    public String embeddingApiKey;

    @Size(max = 160)
    public String embeddingModel;

    public String embeddingConfigJson;

    @Size(max = 500)
    public String rerankBaseUrl;

    public String rerankApiKey;

    @Size(max = 160)
    public String rerankModel;

    public String rerankConfigJson;

    ProviderMutation toMutation() {
      ProviderMutation mutation = new ProviderMutation();
      mutation.workspaceId = workspaceId;
      mutation.name = name;
      mutation.providerType = providerType;
      mutation.baseUrl = baseUrl;
      mutation.apiKey = apiKey;
      mutation.defaultChatModel = defaultChatModel;
      mutation.defaultEmbeddingModel = defaultEmbeddingModel;
      mutation.configJson = configJson;
      mutation.llmBaseUrl = llmBaseUrl;
      mutation.llmApiKey = llmApiKey;
      mutation.llmModel = llmModel;
      mutation.llmConfigJson = llmConfigJson;
      mutation.embeddingBaseUrl = embeddingBaseUrl;
      mutation.embeddingApiKey = embeddingApiKey;
      mutation.embeddingModel = embeddingModel;
      mutation.embeddingConfigJson = embeddingConfigJson;
      mutation.rerankBaseUrl = rerankBaseUrl;
      mutation.rerankApiKey = rerankApiKey;
      mutation.rerankModel = rerankModel;
      mutation.rerankConfigJson = rerankConfigJson;
      return mutation;
    }
  }

  public static class UpdateProviderRequest extends CreateProviderRequest {
    @Size(max = 40)
    public String status;

    @Override
    ProviderMutation toMutation() {
      ProviderMutation mutation = super.toMutation();
      mutation.status = status;
      return mutation;
    }
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
    public String llmBaseUrl;
    public boolean hasLlmApiKey;
    public String llmModel;
    public String llmConfigJson;
    public String embeddingBaseUrl;
    public boolean hasEmbeddingApiKey;
    public String embeddingModel;
    public String embeddingConfigJson;
    public String rerankBaseUrl;
    public boolean hasRerankApiKey;
    public String rerankModel;
    public String rerankConfigJson;
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
      response.llmBaseUrl = account.effectiveLlmBaseUrl();
      response.hasLlmApiKey = account.effectiveLlmApiKeyCiphertext() != null;
      response.llmModel = account.effectiveLlmModel();
      response.llmConfigJson = account.getLlmConfigJson();
      response.embeddingBaseUrl = account.getEmbeddingBaseUrl();
      response.hasEmbeddingApiKey = account.getEmbeddingApiKeyCiphertext() != null;
      response.embeddingModel = account.effectiveEmbeddingModel();
      response.embeddingConfigJson = account.getEmbeddingConfigJson();
      response.rerankBaseUrl = account.getRerankBaseUrl();
      response.hasRerankApiKey = account.getRerankApiKeyCiphertext() != null;
      response.rerankModel = account.getRerankModel();
      response.rerankConfigJson = account.getRerankConfigJson();
      response.status = account.getStatus();
      response.createdAt = account.getCreatedAt();
      response.updatedAt = account.getUpdatedAt();
      return response;
    }
  }
}
