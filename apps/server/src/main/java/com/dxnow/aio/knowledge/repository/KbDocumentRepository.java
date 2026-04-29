package com.dxnow.aio.knowledge.repository;

import com.dxnow.aio.knowledge.domain.KbDocument;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KbDocumentRepository extends JpaRepository<KbDocument, String> {

  List<KbDocument> findByTenantIdAndDatasetIdOrderByCreatedAtDesc(String tenantId, String datasetId);

  Optional<KbDocument> findByTenantIdAndId(String tenantId, String id);
}