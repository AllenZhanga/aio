package com.dxnow.aio.runtime.repository;

import com.dxnow.aio.runtime.domain.AiRun;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiRunRepository extends JpaRepository<AiRun, String> {

  Optional<AiRun> findByTenantIdAndId(String tenantId, String id);

  List<AiRun> findByTenantIdAndAppIdOrderByCreatedAtDesc(String tenantId, String appId);

  List<AiRun> findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(String tenantId, String workspaceId);

  List<AiRun> findByTenantIdAndWorkspaceIdAndAppIdOrderByCreatedAtDesc(String tenantId, String workspaceId, String appId);
}
