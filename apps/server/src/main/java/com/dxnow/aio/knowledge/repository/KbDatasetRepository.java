package com.dxnow.aio.knowledge.repository;

import com.dxnow.aio.knowledge.domain.KbDataset;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KbDatasetRepository extends JpaRepository<KbDataset, String> {

  List<KbDataset> findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(String tenantId, String workspaceId);

  Optional<KbDataset> findByTenantIdAndId(String tenantId, String id);
}