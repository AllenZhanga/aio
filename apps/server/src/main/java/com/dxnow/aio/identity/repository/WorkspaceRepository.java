package com.dxnow.aio.identity.repository;

import com.dxnow.aio.identity.domain.Workspace;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRepository extends JpaRepository<Workspace, String> {

  List<Workspace> findByTenantIdOrderByCreatedAtDesc(String tenantId);

  List<Workspace> findByStatusOrderByCreatedAtDesc(String status);
}
