package com.dxnow.aio.app.repository;

import com.dxnow.aio.app.domain.AiApp;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiAppRepository extends JpaRepository<AiApp, String> {

  List<AiApp> findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(String tenantId, String workspaceId);

  Optional<AiApp> findByTenantIdAndId(String tenantId, String id);
}
