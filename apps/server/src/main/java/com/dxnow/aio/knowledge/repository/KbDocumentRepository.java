package com.dxnow.aio.knowledge.repository;

import com.dxnow.aio.knowledge.domain.KbDocument;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface KbDocumentRepository extends JpaRepository<KbDocument, String> {

  List<KbDocument> findByTenantIdAndDatasetIdOrderByCreatedAtDesc(String tenantId, String datasetId);

  Optional<KbDocument> findByTenantIdAndId(String tenantId, String id);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("delete from KbDocument document where document.tenantId = :tenantId and document.datasetId = :datasetId")
  void deleteByTenantIdAndDatasetId(String tenantId, String datasetId);
}