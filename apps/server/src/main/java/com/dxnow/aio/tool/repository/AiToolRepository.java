package com.dxnow.aio.tool.repository;

import com.dxnow.aio.tool.domain.AiTool;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiToolRepository extends JpaRepository<AiTool, String> {

  List<AiTool> findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(String tenantId, String workspaceId);

  Optional<AiTool> findByTenantIdAndId(String tenantId, String id);
}