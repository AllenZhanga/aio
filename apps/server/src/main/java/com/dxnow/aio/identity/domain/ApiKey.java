package com.dxnow.aio.identity.domain;

import java.time.OffsetDateTime;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.PrePersist;
import javax.persistence.Table;

@Entity
@Table(name = "api_keys")
public class ApiKey {

  @Id
  private String id;

  @Column(nullable = false)
  private String tenantId;

  private String workspaceId;

  private String appId;

  @Column(nullable = false)
  private String name;

  @Column(nullable = false)
  private String keyPrefix;

  @Column(nullable = false, unique = true)
  private String keyHash;

  @Column(nullable = false)
  private String status;

  private OffsetDateTime expiresAt;

  private OffsetDateTime lastUsedAt;

  @Column(nullable = false)
  private OffsetDateTime createdAt;

  private String createdBy;

  private OffsetDateTime revokedAt;

  @PrePersist
  void prePersist() {
    createdAt = OffsetDateTime.now();
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

  public String getAppId() {
    return appId;
  }

  public void setAppId(String appId) {
    this.appId = appId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getKeyPrefix() {
    return keyPrefix;
  }

  public void setKeyPrefix(String keyPrefix) {
    this.keyPrefix = keyPrefix;
  }

  public String getKeyHash() {
    return keyHash;
  }

  public void setKeyHash(String keyHash) {
    this.keyHash = keyHash;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public OffsetDateTime getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(OffsetDateTime expiresAt) {
    this.expiresAt = expiresAt;
  }

  public OffsetDateTime getLastUsedAt() {
    return lastUsedAt;
  }

  public void markUsed() {
    lastUsedAt = OffsetDateTime.now();
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public void setCreatedBy(String createdBy) {
    this.createdBy = createdBy;
  }

  public OffsetDateTime getRevokedAt() {
    return revokedAt;
  }

  public void revoke() {
    status = "revoked";
    revokedAt = OffsetDateTime.now();
  }
}
