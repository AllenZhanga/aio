package com.dxnow.aio.runtime.repository;

import com.dxnow.aio.runtime.domain.AiTrace;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiTraceRepository extends JpaRepository<AiTrace, String> {

  List<AiTrace> findByTenantIdAndRunIdOrderByCreatedAtAsc(String tenantId, String runId);
}