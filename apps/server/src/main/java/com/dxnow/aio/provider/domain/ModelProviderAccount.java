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
