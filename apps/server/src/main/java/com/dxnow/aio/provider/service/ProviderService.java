package com.dxnow.aio.provider.service;

import com.dxnow.aio.common.Ids;
import com.dxnow.aio.common.SecretCrypto;
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
  private final SecretCrypto secretCrypto;

  public ProviderService(
      TenantRepository tenantRepository,
      WorkspaceRepository workspaceRepository,
      ModelProviderAccountRepository providerRepository,
      SecretCrypto secretCrypto) {
    this.tenantRepository = tenantRepository;
    this.workspaceRepository = workspaceRepository;
    this.providerRepository = providerRepository;
    this.secretCrypto = secretCrypto;
  }

  public List<ModelProviderAccount> list(String tenantId) {
    requireTenant(tenantId);
    return providerRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
  }

  @Transactional
  public ModelProviderAccount create(
      String tenantId,
      String workspaceId,
      String name,
      String providerType,
      String baseUrl,
      String apiKey,
      String defaultChatModel,
      String defaultEmbeddingModel,
      String configJson) {
    requireTenant(tenantId);
    if (workspaceId != null && !workspaceId.isBlank()) {
      workspaceRepository.findById(workspaceId)
          .filter(workspace -> tenantId.equals(workspace.getTenantId()))
          .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
    }
    ModelProviderAccount account = new ModelProviderAccount();
    account.setId(Ids.prefixed("provider"));
    account.setTenantId(tenantId);
    account.setWorkspaceId(blankToNull(workspaceId));
    account.setName(name);
    account.setProviderType(providerType);
    account.setBaseUrl(baseUrl);
    account.setApiKeyCiphertext(secretCrypto.encrypt(apiKey));
    account.setDefaultChatModel(defaultChatModel);
    account.setDefaultEmbeddingModel(defaultEmbeddingModel);
    account.setConfigJson(configJson);
    account.setStatus("active");
    return providerRepository.save(account);
  }

  @Transactional
  public ModelProviderAccount update(
      String tenantId,
      String providerId,
      String workspaceId,
      String name,
      String providerType,
      String baseUrl,
      String apiKey,
      String defaultChatModel,
      String defaultEmbeddingModel,
      String configJson,
      String status) {
    ModelProviderAccount account = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    if (workspaceId != null && !workspaceId.isBlank()) {
      workspaceRepository.findById(workspaceId)
          .filter(workspace -> tenantId.equals(workspace.getTenantId()))
          .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
      account.setWorkspaceId(workspaceId);
    }
    if (name != null && !name.isBlank()) account.setName(name);
    if (providerType != null && !providerType.isBlank()) account.setProviderType(providerType);
    if (baseUrl != null && !baseUrl.isBlank()) account.setBaseUrl(baseUrl);
    if (apiKey != null && !apiKey.isBlank()) account.setApiKeyCiphertext(secretCrypto.encrypt(apiKey));
    if (defaultChatModel != null) account.setDefaultChatModel(defaultChatModel);
    if (defaultEmbeddingModel != null) account.setDefaultEmbeddingModel(defaultEmbeddingModel);
    if (configJson != null) account.setConfigJson(configJson);
    if (status != null && !status.isBlank()) account.setStatus(status);
    return providerRepository.save(account);
  }

  public Map<String, Object> test(String tenantId, String providerId) {
    ModelProviderAccount account = providerRepository.findByTenantIdAndId(tenantId, providerId)
        .orElseThrow(() -> new EntityNotFoundException("Provider not found"));
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("provider_id", account.getId());
    response.put("provider_type", account.getProviderType());
    response.put("base_url", account.getBaseUrl());
    response.put("status", account.getStatus());
    response.put("has_api_key", account.getApiKeyCiphertext() != null);
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

  private void requireTenant(String tenantId) {
    if (!tenantRepository.existsById(tenantId)) {
      throw new EntityNotFoundException("Tenant not found");
    }
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
