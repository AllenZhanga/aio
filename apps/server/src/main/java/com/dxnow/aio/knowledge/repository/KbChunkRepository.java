package com.dxnow.aio.knowledge.repository;

import com.dxnow.aio.knowledge.domain.KbChunk;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface KbChunkRepository extends JpaRepository<KbChunk, String> {

  List<KbChunk> findByTenantIdAndDatasetId(String tenantId, String datasetId);

  List<KbChunk> findByTenantIdAndDocumentIdOrderByChunkNoAsc(String tenantId, String documentId);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("delete from KbChunk chunk where chunk.tenantId = :tenantId and chunk.documentId = :documentId")
  void deleteByTenantIdAndDocumentId(String tenantId, String documentId);

  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("delete from KbChunk chunk where chunk.tenantId = :tenantId and chunk.datasetId = :datasetId")
  void deleteByTenantIdAndDatasetId(String tenantId, String datasetId);
}