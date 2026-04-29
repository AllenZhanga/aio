package com.dxnow.aio.skill.api;

import com.dxnow.aio.skill.domain.AiSkill;
import com.dxnow.aio.skill.service.SkillService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/aio/admin/skills")
public class AdminSkillController {

  private final SkillService skillService;

  public AdminSkillController(SkillService skillService) {
    this.skillService = skillService;
  }

  @GetMapping
  public List<SkillResponse> list(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId) {
    return skillService.list(tenantId, workspaceId).stream().map(SkillResponse::from).collect(Collectors.toList());
  }

  @PostMapping
  public SkillResponse create(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @Valid @RequestBody SkillRequest request) {
    return SkillResponse.from(skillService.save(tenantId, workspaceId, null, request.toMutation()));
  }

  @PutMapping("/{skillId}")
  public SkillResponse update(
      @RequestHeader(value = "X-Aio-Tenant", defaultValue = "default") String tenantId,
      @RequestHeader(value = "X-Aio-Workspace", defaultValue = "default") String workspaceId,
      @PathVariable String skillId,
      @Valid @RequestBody SkillRequest request) {
    return SkillResponse.from(skillService.save(tenantId, workspaceId, skillId, request.toMutation()));
  }

  public static class SkillRequest {
    @NotBlank @Size(max = 160) public String name;
    public String description;
    public String definitionJson;
    @Size(max = 40) public String status;

    SkillService.Mutation toMutation() {
      SkillService.Mutation mutation = new SkillService.Mutation();
      mutation.name = name;
      mutation.description = description;
      mutation.definitionJson = definitionJson;
      mutation.status = status;
      return mutation;
    }
  }

  public static class SkillResponse {
    public String id;
    public String tenantId;
    public String workspaceId;
    public String name;
    public String description;
    public String definitionJson;
    public String status;
    public OffsetDateTime createdAt;
    public OffsetDateTime updatedAt;

    static SkillResponse from(AiSkill skill) {
      SkillResponse response = new SkillResponse();
      response.id = skill.getId();
      response.tenantId = skill.getTenantId();
      response.workspaceId = skill.getWorkspaceId();
      response.name = skill.getName();
      response.description = skill.getDescription();
      response.definitionJson = skill.getDefinitionJson();
      response.status = skill.getStatus();
      response.createdAt = skill.getCreatedAt();
      response.updatedAt = skill.getUpdatedAt();
      return response;
    }
  }
}