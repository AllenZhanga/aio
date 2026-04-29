package com.dxnow.aio.skill.service;

import com.dxnow.aio.common.Ids;
import com.dxnow.aio.identity.repository.WorkspaceRepository;
import com.dxnow.aio.skill.domain.AiSkill;
import com.dxnow.aio.skill.repository.AiSkillRepository;
import java.util.List;
import javax.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SkillService {

  private final WorkspaceRepository workspaceRepository;
  private final AiSkillRepository skillRepository;

  public SkillService(WorkspaceRepository workspaceRepository, AiSkillRepository skillRepository) {
    this.workspaceRepository = workspaceRepository;
    this.skillRepository = skillRepository;
  }

  public List<AiSkill> list(String tenantId, String workspaceId) {
    requireWorkspace(tenantId, workspaceId);
    return skillRepository.findByTenantIdAndWorkspaceIdOrderByCreatedAtDesc(tenantId, workspaceId);
  }

  @Transactional
  public AiSkill save(String tenantId, String workspaceId, String skillId, Mutation mutation) {
    requireWorkspace(tenantId, workspaceId);
    AiSkill skill = skillId == null
        ? new AiSkill()
        : skillRepository.findByTenantIdAndId(tenantId, skillId)
            .orElseThrow(() -> new EntityNotFoundException("Skill not found"));
    if (skillId == null) {
      skill.setId(Ids.prefixed("skill"));
      skill.setTenantId(tenantId);
      skill.setWorkspaceId(workspaceId);
      skill.setStatus("active");
    }
    skill.setName(mutation.name);
    skill.setDescription(mutation.description);
    skill.setDefinitionJson(mutation.definitionJson == null || mutation.definitionJson.isBlank() ? "{}" : mutation.definitionJson);
    if (mutation.status != null && !mutation.status.isBlank()) {
      skill.setStatus(mutation.status);
    }
    return skillRepository.save(skill);
  }

  private void requireWorkspace(String tenantId, String workspaceId) {
    workspaceRepository.findById(workspaceId)
        .filter(workspace -> tenantId.equals(workspace.getTenantId()))
        .orElseThrow(() -> new EntityNotFoundException("Workspace not found in tenant"));
  }

  public static class Mutation {
    public String name;
    public String description;
    public String definitionJson;
    public String status;
  }
}