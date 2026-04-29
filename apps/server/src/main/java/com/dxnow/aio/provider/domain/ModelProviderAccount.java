package com.dxnow.aio.provider.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;

@Entity
@Table(name = "model_provider_accounts")
public class ModelProviderAccount {

  @Id
  private String id;

  @Column(nullable = false)
  private String tenantId;

  private String workspaceId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false)
  private String providerType;

  @Column(nullable = false)
  private String baseUrl;

  @Column(name = "api_key_ciphertext")
  private String apiKeyCiphertext;

  private String llmBaseUrl;

  @Column(name = "llm_api_key_ciphertext")
  private String llmApiKeyCiphertext;

  private String llmModel;

  private String llmConfigJson;

  private String embeddingBaseUrl;

  @Column(name = "embedding_api_key_ciphertext")
  private String embeddingApiKeyCiphertext;

  private String embeddingModel;

  private String embeddingConfigJson;

  private String rerankBaseUrl;

  @Column(name = "rerank_api_key_ciphertext")
  private String rerankApiKeyCiphertext;

  private String rerankModel;

  private String rerankConfigJson;

  private String defaultChatModel;

  private String defaultEmbeddingModel;

  private String configJson;

  @Column(nullable = false)
  private String status;

  @Column(nullable = false)
  private OffsetDateTime createdAt;

  @Column(nullable = false)
  private OffsetDateTime updatedAt;

  @PrePersist
  void prePersist() {
    OffsetDateTime now = OffsetDateTime.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void preUpdate() {
    updatedAt = OffsetDateTime.now();
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getTenantId() {
    return tenantId;
  }

  public void setTenantId(String tenantId) {
    this.tenantId = tenantId;
  }

  public String getWorkspaceId() {
    return workspaceId;
  }

  public void setWorkspaceId(String workspaceId) {
    this.workspaceId = workspaceId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getProviderType() {
    return providerType;
  }

  public void setProviderType(String providerType) {
    this.providerType = providerType;
  }

  public String getBaseUrl() {
    return baseUrl;
  }

  public void setBaseUrl(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  public String getApiKeyCiphertext() {
    return apiKeyCiphertext;
  }

  public void setApiKeyCiphertext(String apiKeyCiphertext) {
    this.apiKeyCiphertext = apiKeyCiphertext;
  }

  public String getLlmBaseUrl() {
    return llmBaseUrl;
  }

  public void setLlmBaseUrl(String llmBaseUrl) {
    this.llmBaseUrl = llmBaseUrl;
  }

  public String getLlmApiKeyCiphertext() {
    return llmApiKeyCiphertext;
  }

  public void setLlmApiKeyCiphertext(String llmApiKeyCiphertext) {
    this.llmApiKeyCiphertext = llmApiKeyCiphertext;
  }

  public String getLlmModel() {
    return llmModel;
  }

  public void setLlmModel(String llmModel) {
    this.llmModel = llmModel;
  }

  public String getLlmConfigJson() {
    return llmConfigJson;
  }

  public void setLlmConfigJson(String llmConfigJson) {
    this.llmConfigJson = llmConfigJson;
  }

  public String getEmbeddingBaseUrl() {
    return embeddingBaseUrl;
  }

  public void setEmbeddingBaseUrl(String embeddingBaseUrl) {
    this.embeddingBaseUrl = embeddingBaseUrl;
  }

  public String getEmbeddingApiKeyCiphertext() {
    return embeddingApiKeyCiphertext;
  }

  public void setEmbeddingApiKeyCiphertext(String embeddingApiKeyCiphertext) {
    this.embeddingApiKeyCiphertext = embeddingApiKeyCiphertext;
  }

  public String getEmbeddingModel() {
    return embeddingModel;
  }

  public void setEmbeddingModel(String embeddingModel) {
    this.embeddingModel = embeddingModel;
  }

  public String getEmbeddingConfigJson() {
    return embeddingConfigJson;
  }

  public void setEmbeddingConfigJson(String embeddingConfigJson) {
    this.embeddingConfigJson = embeddingConfigJson;
  }

  public String getRerankBaseUrl() {
    return rerankBaseUrl;
  }

  public void setRerankBaseUrl(String rerankBaseUrl) {
    this.rerankBaseUrl = rerankBaseUrl;
  }

  public String getRerankApiKeyCiphertext() {
    return rerankApiKeyCiphertext;
  }

  public void setRerankApiKeyCiphertext(String rerankApiKeyCiphertext) {
    this.rerankApiKeyCiphertext = rerankApiKeyCiphertext;
  }

  public String getRerankModel() {
    return rerankModel;
  }

  public void setRerankModel(String rerankModel) {
    this.rerankModel = rerankModel;
  }

  public String getRerankConfigJson() {
    return rerankConfigJson;
  }

  public void setRerankConfigJson(String rerankConfigJson) {
    this.rerankConfigJson = rerankConfigJson;
  }

  public String effectiveLlmBaseUrl() {
    return llmBaseUrl == null || llmBaseUrl.isBlank() ? baseUrl : llmBaseUrl;
  }

  public String effectiveLlmApiKeyCiphertext() {
    return llmApiKeyCiphertext == null || llmApiKeyCiphertext.isBlank() ? apiKeyCiphertext : llmApiKeyCiphertext;
  }

  public String effectiveLlmModel() {
    return llmModel == null || llmModel.isBlank() ? defaultChatModel : llmModel;
  }

  public String effectiveEmbeddingModel() {
    return embeddingModel == null || embeddingModel.isBlank() ? defaultEmbeddingModel : embeddingModel;
  }

  public String getDefaultChatModel() {
    return defaultChatModel;
  }

  public void setDefaultChatModel(String defaultChatModel) {
    this.defaultChatModel = defaultChatModel;
  }

  public String getDefaultEmbeddingModel() {
    return defaultEmbeddingModel;
  }

  public void setDefaultEmbeddingModel(String defaultEmbeddingModel) {
    this.defaultEmbeddingModel = defaultEmbeddingModel;
  }

  public String getConfigJson() {
    return configJson;
  }

  public void setConfigJson(String configJson) {
    this.configJson = configJson;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public OffsetDateTime getUpdatedAt() {
    return updatedAt;
  }
}
