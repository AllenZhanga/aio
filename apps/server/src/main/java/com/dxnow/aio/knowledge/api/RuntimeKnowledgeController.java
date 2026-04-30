package com.dxnow.aio.knowledge.api;

import com.dxnow.aio.knowledge.domain.KbDataset;
import com.dxnow.aio.knowledge.service.KnowledgeService;
import com.dxnow.aio.security.ApiKeyPrincipal;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
    enforceDatasetScope(principal, knowledgeService.getDataset(principal.getTenantId(), datasetId));
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("document", AdminKnowledgeController.DocumentResponse.from(knowledgeService.addDocument(principal.getTenantId(), datasetId, request.toMutation())));
    return response;
  }

  @PostMapping("/{datasetId}/documents/upload")
  public Map<String, Object> uploadDocument(
      HttpServletRequest servletRequest,
      @PathVariable String datasetId,
      @RequestParam("file") MultipartFile file) throws IOException {
    ApiKeyPrincipal principal = principal(servletRequest);
    enforceDatasetScope(principal, knowledgeService.getDataset(principal.getTenantId(), datasetId));
    KnowledgeService.UploadedDocumentMutation request = new KnowledgeService.UploadedDocumentMutation();
    request.name = file.getOriginalFilename() == null || file.getOriginalFilename().isBlank() ? "Uploaded Document" : file.getOriginalFilename();
    request.contentType = file.getContentType();
    request.bytes = file.getBytes();
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("document", AdminKnowledgeController.DocumentResponse.from(knowledgeService.addUploadedDocument(principal.getTenantId(), datasetId, request)));
    return response;
  }

  @PostMapping("/{datasetId}/retrieve")
  public Map<String, Object> retrieve(
      HttpServletRequest servletRequest,
      @PathVariable String datasetId,
      @RequestBody AdminKnowledgeController.RetrieveRequest request) {
    ApiKeyPrincipal principal = principal(servletRequest);
    enforceDatasetScope(principal, knowledgeService.getDataset(principal.getTenantId(), datasetId));
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("records", knowledgeService.retrieve(principal.getTenantId(), datasetId, request.query, request.topK, request.scoreThreshold));
    return response;
  }

  private ApiKeyPrincipal principal(HttpServletRequest request) {
    return (ApiKeyPrincipal) request.getAttribute(ApiKeyPrincipal.REQUEST_ATTRIBUTE);
  }

  private void enforceDatasetScope(ApiKeyPrincipal principal, KbDataset dataset) {
    if (principal.getWorkspaceId() != null && !principal.getWorkspaceId().equals(dataset.getWorkspaceId())) {
      throw new IllegalArgumentException("API key is not scoped to this workspace");
    }
  }
}
