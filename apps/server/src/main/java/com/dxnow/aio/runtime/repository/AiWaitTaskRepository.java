package com.dxnow.aio.runtime.repository;

import com.dxnow.aio.runtime.domain.AiWaitTask;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiWaitTaskRepository extends JpaRepository<AiWaitTask, String> {

  Optional<AiWaitTask> findByTenantIdAndId(String tenantId, String id);

  List<AiWaitTask> findByTenantIdAndRunIdOrderByCreatedAtDesc(String tenantId, String runId);
}