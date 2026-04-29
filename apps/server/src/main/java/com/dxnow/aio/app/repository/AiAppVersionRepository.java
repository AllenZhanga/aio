package com.dxnow.aio.app.repository;

import com.dxnow.aio.app.domain.AiAppVersion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiAppVersionRepository extends JpaRepository<AiAppVersion, String> {

  List<AiAppVersion> findByTenantIdAndAppIdOrderByVersionNoDesc(String tenantId, String appId);

  Optional<AiAppVersion> findFirstByTenantIdAndAppIdOrderByVersionNoDesc(String tenantId, String appId);

  Optional<AiAppVersion> findByTenantIdAndId(String tenantId, String id);
}
