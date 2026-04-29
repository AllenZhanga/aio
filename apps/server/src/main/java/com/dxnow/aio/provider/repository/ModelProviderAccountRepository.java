package com.dxnow.aio.provider.repository;

import com.dxnow.aio.provider.domain.ModelProviderAccount;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModelProviderAccountRepository extends JpaRepository<ModelProviderAccount, String> {

  List<ModelProviderAccount> findByTenantIdOrderByCreatedAtDesc(String tenantId);

  Optional<ModelProviderAccount> findByTenantIdAndId(String tenantId, String id);
}
