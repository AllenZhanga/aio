package com.dxnow.aio.knowledge.api;

import com.dxnow.aio.knowledge.service.KnowledgeService;
import com.dxnow.aio.security.ApiKeyPrincipal;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/datasets")
public class RuntimeKnowledgeController {

  private final KnowledgeService knowledgeService;

  public RuntimeKnowledgeController(KnowledgeService knowledgeService) {
    this.knowledgeService = knowledgeService;
  }

  @PostMapping("/{datasetId}/documents")
  public Map<String, Object> addDocument(
      HttpServletRequest servletRequest,
      @PathVariable String datasetId,
      @RequestBody AdminKnowledgeController.DocumentRequest request) {
    ApiKeyPrincipal principal = principal(servletRequest);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("document", AdminKnowledgeController.DocumentResponse.from(knowledgeService.addDocument(principal.getTenantId(), datasetId, request.toMutation())));
    return response;
  }

  @PostMapping("/{datasetId}/retrieve")
  public Map<String, Object> retrieve(
      HttpServletRequest servletRequest,
      @PathVariable String datasetId,
      @RequestBody AdminKnowledgeController.RetrieveRequest request) {
    ApiKeyPrincipal principal = principal(servletRequest);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("records", knowledgeService.retrieve(principal.getTenantId(), datasetId, request.query, request.topK, request.scoreThreshold));
    return response;
  }

  private ApiKeyPrincipal principal(HttpServletRequest request) {
    return (ApiKeyPrincipal) request.getAttribute(ApiKeyPrincipal.REQUEST_ATTRIBUTE);
  }
}