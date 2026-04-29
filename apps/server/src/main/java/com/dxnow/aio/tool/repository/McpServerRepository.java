package com.dxnow.aio.tool.repository;

import com.dxnow.aio.tool.domain.McpServer;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface McpServerRepository extends JpaRepository<McpServer, String> {

  List<McpServer> findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(String tenantId, String workspaceId);

  Optional<McpServer> findByTenantIdAndId(String tenantId, String id);
}