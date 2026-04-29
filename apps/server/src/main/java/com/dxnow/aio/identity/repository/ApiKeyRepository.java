package com.dxnow.aio.identity.repository;

import com.dxnow.aio.identity.domain.ApiKey;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiKeyRepository extends JpaRepository<ApiKey, String> {

  List<ApiKey> findByTenantIdOrderByCreatedAtDesc(String tenantId);

  Optional<ApiKey> findByTenantIdAndId(String tenantId, String id);

  Optional<ApiKey> findByKeyHashAndStatus(String keyHash, String status);
}
