package com.dxnow.aio.skill.repository;

import com.dxnow.aio.skill.domain.AiSkill;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiSkillRepository extends JpaRepository<AiSkill, String> {

  List<AiSkill> findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(String tenantId, String workspaceId);

  Optional<AiSkill> findByTenantIdAndId(String tenantId, String id);
}