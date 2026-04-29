package com.dxnow.aio.knowledge.repository;

import com.dxnow.aio.knowledge.domain.KbChunk;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KbChunkRepository extends JpaRepository<KbChunk, String> {

  List<KbChunk> findByTenantIdAndDatasetId(String tenantId, String datasetId);

  void deleteByTenantIdAndDocumentId(String tenantId, String documentId);
}