package com.dxnow.aio.provider.service;

import com.dxnow.aio.common.Ids;
import com.dxnow.aio.common.CryptoService;
import com.dxnow.aio.identity.repository.TenantRepository;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import com.dxnow.aio.provider.domain.ModelProviderAccount;
import com.dxnow.aio.provider.repository.ModelProviderAccountRepository;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProviderService {

  private final TenantRepository tenantRepository;
  private final WorkspaceRepository workspaceRepository;
  private final ModelProviderAccountRepository providerRepository;
  private final CryptoService cryptoService;

  public ProviderService(
      TenantRepository tenantRepository,
      WorkspaceRepository workspaceRepository,
      ModelProviderAccountRepository providerRepository,
      CryptoService cryptoService) {
    this.tenantRepository = tenantRepository;
    this.workspaceRepository = workspaceRepository;
    this.providerRepository = providerRepository;
    this.cryptoService = cryptoService;
  }

  public List<ModelProviderAccount> list(String tenantId) {
    requireTenant(tenantId);
    return providerRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
  }

  @Transactional
  public ModelProviderAccount create(String tenantId, ProviderMutation request) {
    requireTenant(tenantId);
    if (request.workspaceId != null && !request.workspaceId.isBlank()) {
      workspaceRepository.findById(request.workspaceId)
          .filter(workspace -> tenantId.equals(workspace.getTenantId()))
          .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
    }
    ModelProviderAccount account = new ModelProviderAccount();
    account.setId(Ids.prefixed("provider"));
    account.setTenantId(tenantId);
    account.setWorkspaceId(blankToNull(request.workspaceId));
    account.setName(request.name);
    account.setProviderType(request.providerType);
    applyCreateConfig(account, request);
    account.setStatus("active");
    return providerRepository.save(account);
  }

  @Transactional
  public ModelProviderAccount update(String tenantId, String providerId, ProviderMutation request) {
    ModelProviderAccount account = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    if (request.workspaceId != null && !request.workspaceId.isBlank()) {
      workspaceRepository.findById(request.workspaceId)
          .filter(workspace -> tenantId.equals(workspace.getTenantId()))
          .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
      account.setWorkspaceId(request.workspaceId);
    }
    if (request.name != null && !request.name.isBlank()) account.setName(request.name);
    if (request.providerType != null && !request.providerType.isBlank()) account.setProviderType(request.providerType);
    applyUpdateConfig(account, request);
    if (request.status != null && !request.status.isBlank()) account.setStatus(request.status);
    return providerRepository.save(account);
  }

  public Map<String, Object> test(String tenantId, String providerId) {
    ModelProviderAccount account = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("provider_id", account.getId());
    response.put("provider_type", account.getProviderType());
    response.put("llm_base_url", account.effectiveLlmBaseUrl());
    response.put("embedding_base_url", account.getEmbeddingBaseUrl());
    response.put("rerank_base_url", account.getRerankBaseUrl());
    response.put("status", account.getStatus());
    response.put("has_llm_api_key", account.effectiveLlmApiKeyCiphertext() != null);
    response.put("has_embedding_api_key", account.getEmbeddingApiKeyCiphertext() != null);
    response.put("has_rerank_api_key", account.getRerankApiKeyCiphertext() != null);
    response.put("reachable", true);
    response.put("message", "Provider configuration is syntactically valid. Live model call is performed during runtime invocation.");
    return response;
  }

  @Transactional
  public ModelProviderAccount disable(String tenantId, String providerId) {
    ModelProviderAccount account = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    account.setStatus("disabled");
    return providerRepository.save(account);
  }

  @Transactional
  public void delete(String tenantId, String providerId) {
    ModelProviderAccount account = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    providerRepository.delete(account);
  }

  private void requireTenant(String tenantId) {
    if (!tenantRepository.existsById(tenantId)) {
      throw new EntityNotFoundException("Tenant not found");
    }
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private void applyCreateConfig(ModelProviderAccount account, ProviderMutation request) {
    String llmBaseUrl = firstNonBlank(request.llmBaseUrl, request.baseUrl);
    String llmModel = firstNonBlank(request.llmModel, request.defaultChatModel);
    String embeddingBaseUrl = firstNonBlank(request.embeddingBaseUrl, request.baseUrl);
    String embeddingModel = firstNonBlank(request.embeddingModel, request.defaultEmbeddingModel);
    account.setBaseUrl(llmBaseUrl);
    account.setApiKeyCiphertext(cryptoService.encrypt(request.apiKey));
    account.setDefaultChatModel(llmModel);
    account.setDefaultEmbeddingModel(embeddingModel);
    account.setConfigJson(request.configJson);
    account.setLlmBaseUrl(llmBaseUrl);
    account.setLlmApiKeyCiphertext(cryptoService.encrypt(firstNonBlank(request.llmApiKey, request.apiKey)));
    account.setLlmModel(llmModel);
    account.setLlmConfigJson(request.llmConfigJson);
    account.setEmbeddingBaseUrl(embeddingBaseUrl);
    account.setEmbeddingApiKeyCiphertext(cryptoService.encrypt(firstNonBlank(request.embeddingApiKey, request.apiKey)));
    account.setEmbeddingModel(embeddingModel);
    account.setEmbeddingConfigJson(request.embeddingConfigJson);
    account.setRerankBaseUrl(blankToNull(request.rerankBaseUrl));
    account.setRerankApiKeyCiphertext(cryptoService.encrypt(request.rerankApiKey));
    account.setRerankModel(blankToNull(request.rerankModel));
    account.setRerankConfigJson(request.rerankConfigJson);
  }

  private void applyUpdateConfig(ModelProviderAccount account, ProviderMutation request) {
    if (request.baseUrl != null && !request.baseUrl.isBlank()) account.setBaseUrl(request.baseUrl);
    if (request.apiKey != null && !request.apiKey.isBlank()) {
      String sharedCiphertext = cryptoService.encrypt(request.apiKey);
      account.setApiKeyCiphertext(sharedCiphertext);
      if (request.llmApiKey == null || request.llmApiKey.isBlank()) account.setLlmApiKeyCiphertext(sharedCiphertext);
      if (request.embeddingApiKey == null || request.embeddingApiKey.isBlank()) account.setEmbeddingApiKeyCiphertext(sharedCiphertext);
    }
    if (request.defaultChatModel != null) account.setDefaultChatModel(request.defaultChatModel);
    if (request.defaultEmbeddingModel != null) account.setDefaultEmbeddingModel(request.defaultEmbeddingModel);
    if (request.configJson != null) account.setConfigJson(request.configJson);
    if (request.llmBaseUrl != null) account.setLlmBaseUrl(blankToNull(request.llmBaseUrl));
    if (request.llmApiKey != null && !request.llmApiKey.isBlank()) account.setLlmApiKeyCiphertext(cryptoService.encrypt(request.llmApiKey));
    if (request.llmModel != null) account.setLlmModel(request.llmModel);
    if (request.llmConfigJson != null) account.setLlmConfigJson(request.llmConfigJson);
    if (request.embeddingBaseUrl != null) account.setEmbeddingBaseUrl(blankToNull(request.embeddingBaseUrl));
    if (request.embeddingApiKey != null && !request.embeddingApiKey.isBlank()) account.setEmbeddingApiKeyCiphertext(cryptoService.encrypt(request.embeddingApiKey));
    if (request.embeddingModel != null) account.setEmbeddingModel(request.embeddingModel);
    if (request.embeddingConfigJson != null) account.setEmbeddingConfigJson(request.embeddingConfigJson);
    if (request.rerankBaseUrl != null) account.setRerankBaseUrl(blankToNull(request.rerankBaseUrl));
    if (request.rerankApiKey != null && !request.rerankApiKey.isBlank()) account.setRerankApiKeyCiphertext(cryptoService.encrypt(request.rerankApiKey));
    if (request.rerankModel != null) account.setRerankModel(request.rerankModel);
    if (request.rerankConfigJson != null) account.setRerankConfigJson(request.rerankConfigJson);
  }

  private static String firstNonBlank(String first, String second) {
    return first != null && !first.isBlank() ? first : blankToNull(second);
  }

  public static class ProviderMutation {
    public String workspaceId;
    public String name;
    public String providerType;
    public String baseUrl;
    public String apiKey;
    public String defaultChatModel;
    public String defaultEmbeddingModel;
    public String configJson;
    public String llmBaseUrl;
    public String llmApiKey;
    public String llmModel;
    public String llmConfigJson;
    public String embeddingBaseUrl;
    public String embeddingApiKey;
    public String embeddingModel;
    public String embeddingConfigJson;
    public String rerankBaseUrl;
    public String rerankApiKey;
    public String rerankModel;
    public String rerankConfigJson;
    public String status;
  }
}
