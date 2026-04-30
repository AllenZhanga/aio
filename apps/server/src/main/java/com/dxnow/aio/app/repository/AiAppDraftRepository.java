package com.dxnow.aio.app.repository;

import com.dxnow.aio.app.domain.AiAppDraft;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiAppDraftRepository extends JpaRepository<AiAppDraft, String> {

  Optional<AiAppDraft> findByTenantIdAndAppId(String tenantId, String appId);
}
