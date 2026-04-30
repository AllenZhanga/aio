package com.dxnow.aio;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
  "aio.console-accounts=admin:admin:default:Admin:admin,alice:alice_dev_password:alice:Alice:member,bob:bob_dev_password:bob:Bob:member"
})
@AutoConfigureMockMvc
class AioApplicationTests {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Test
  void contextLoads() {
  }

  @Test
  void defaultTenantIsCreated() throws Exception {
    String consoleToken = loginToken();
    mockMvc.perform(get("/api/aio/admin/tenants"))
      .andExpect(status().isUnauthorized());
    mockMvc.perform(get("/api/aio/admin/tenants")
        .header("Authorization", "Bearer " + consoleToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("default"));
  }

    @Test
    void adminApiRequiresConsoleLogin() throws Exception {
    mockMvc.perform(get("/api/aio/admin/apps"))
      .andExpect(status().isUnauthorized());
    }

  @Test
  void workspaceSwitchRequiresPermission() throws Exception {
    String adminToken = loginToken();
    Map<String, Object> switchRequest = new LinkedHashMap<>();
    switchRequest.put("workspaceId", "alice");
    mockMvc.perform(post("/api/aio/auth/switch-workspace")
        .header("Authorization", "Bearer " + adminToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(switchRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.workspaceId").value("alice"))
      .andExpect(jsonPath("$.role").value("admin"));

    String aliceToken = loginToken("alice", "alice_dev_password");
    mockMvc.perform(get("/api/aio/admin/workspaces")
        .header("Authorization", "Bearer " + aliceToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].id").value("alice"));

    switchRequest.put("workspaceId", "bob");
    mockMvc.perform(post("/api/aio/auth/switch-workspace")
        .header("Authorization", "Bearer " + aliceToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(switchRequest)))
      .andExpect(status().isForbidden());
  }

  @Test
  void adminCanDeleteWorkspaceAcrossTenants() throws Exception {
    String adminToken = loginToken();
    Map<String, Object> tenantRequest = new LinkedHashMap<>();
    tenantRequest.put("name", "Delete Tenant");
    tenantRequest.put("code", "delete-tenant-" + System.nanoTime());
    tenantRequest.put("plan", "private");
    String tenantResponse = mockMvc.perform(post("/api/aio/admin/tenants")
            .header("Authorization", "Bearer " + adminToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(tenantRequest)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
    String tenantId = extract(tenantResponse, "id");

    Map<String, Object> workspaceRequest = new LinkedHashMap<>();
    workspaceRequest.put("tenantId", tenantId);
    workspaceRequest.put("name", "To Delete");
    String workspaceResponse = mockMvc.perform(post("/api/aio/admin/workspaces")
            .header("Authorization", "Bearer " + adminToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(workspaceRequest)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
    String workspaceId = extract(workspaceResponse, "id");

    String memberToken = loginToken("alice", "alice_dev_password");
    mockMvc.perform(delete("/api/aio/admin/workspaces/" + workspaceId)
            .param("tenantId", tenantId)
            .header("Authorization", "Bearer " + memberToken))
        .andExpect(status().isForbidden());

    mockMvc.perform(delete("/api/aio/admin/workspaces/" + workspaceId)
            .param("tenantId", tenantId)
            .header("Authorization", "Bearer " + adminToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("deleted"));

    mockMvc.perform(get("/api/aio/admin/workspaces?scope=all")
            .header("Authorization", "Bearer " + adminToken))
        .andExpect(status().isOk())
        .andExpect(content().string(not(containsString(workspaceId))));
  }

  @Test
  void apiKeySecretIsReturnedOnlyOnCreate() throws Exception {
      String consoleToken = loginToken();
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "Joget integration");
    request.put("workspaceId", "default");

    String createResponse = mockMvc.perform(post("/api/aio/admin/api-keys")
        .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.apiKey").exists())
        .andExpect(jsonPath("$.keyPrefix").exists())
        .andReturn()
        .getResponse()
        .getContentAsString();

    mockMvc.perform(get("/api/aio/admin/api-keys")
        .header("Authorization", "Bearer " + consoleToken))
        .andExpect(status().isOk())
        .andExpect(content().string(not(containsString("keyHash"))))
        .andExpect(content().string(not(containsString(extractApiKey(createResponse)))));
  }

  @Test
  void providerSecretIsNeverEchoed() throws Exception {
    String consoleToken = loginToken();
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "OpenAI Compatible");
    request.put("workspaceId", "default");
    request.put("providerType", "openai_compatible");
    request.put("baseUrl", "https://api.example.com/v1");
    request.put("apiKey", "provider-secret-value");
    request.put("defaultChatModel", "gpt-4.1-mini");

    mockMvc.perform(post("/api/aio/admin/providers")
          .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasApiKey").value(true))
        .andExpect(content().string(not(containsString("provider-secret-value"))))
        .andExpect(content().string(not(containsString("apiKeyCiphertext"))));
  }

    @Test
    void archivedAppsAreHiddenFromAdminList() throws Exception {
    String consoleToken = loginToken();
    String appResponse = createAgentApp(consoleToken);
    String appId = extract(appResponse, "id");

    mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/archive")
      .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("archived"));

    mockMvc.perform(get("/api/aio/admin/apps")
      .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(content().string(not(containsString(appId))));
    }

  @Test
  void appDraftIsSavedValidatedAndPublishedSeparately() throws Exception {
    String consoleToken = loginToken();
    String appResponse = createWorkflowApp(consoleToken);
    String appId = extract(appResponse, "id");

    String draftResponse = mockMvc.perform(get("/api/aio/admin/apps/" + appId + "/draft")
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.appId").value(appId))
      .andExpect(jsonPath("$.revision").value(1))
      .andReturn()
      .getResponse()
      .getContentAsString();

    Map<String, Object> saveRequest = new LinkedHashMap<>();
    saveRequest.put("revision", Integer.parseInt(String.valueOf(objectMapper.readValue(draftResponse, Map.class).get("revision"))));
    saveRequest.put("definitionJson", workflowDefinitionWithNamespacedVariables("已发布草稿输出"));
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/aio/admin/apps/" + appId + "/draft")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(saveRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.dirty").value(true))
      .andExpect(jsonPath("$.revision").value(2));

    mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/draft/validate")
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.report.passed").value(true));

    String publishResponse = mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/draft/publish")
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.app.status").value("published"))
      .andExpect(jsonPath("$.version.versionNo").value(1))
      .andExpect(jsonPath("$.draft.dirty").value(false))
      .andReturn()
      .getResponse()
      .getContentAsString();
    String publishedVersionId = extractNested(publishResponse, "version", "id");

    saveRequest.remove("revision");
    saveRequest.put("definitionJson", workflowDefinitionWithNamespacedVariables("未发布草稿输出"));
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/aio/admin/apps/" + appId + "/draft")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(saveRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.dirty").value(true));

    mockMvc.perform(get("/api/aio/admin/apps/" + appId)
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.publishedVersionId").value(publishedVersionId));
  }

  @Test
  void workflowDraftCanRunWithoutPublishingOnlineVersion() throws Exception {
    String consoleToken = loginToken();
    String appResponse = createWorkflowApp(consoleToken);
    String appId = extract(appResponse, "id");

    Map<String, Object> saveRequest = new LinkedHashMap<>();
    saveRequest.put("definitionJson", workflowDraftRunDefinition());
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/aio/admin/apps/" + appId + "/draft")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(saveRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.dirty").value(true));

    Map<String, Object> runRequest = new LinkedHashMap<>();
    Map<String, Object> inputs = new LinkedHashMap<>();
    inputs.put("question", "草稿试运行输入");
    runRequest.put("inputs", inputs);
    mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/draft/run")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(runRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.runType").value("workflow_draft"))
      .andExpect(jsonPath("$.status").value("success"))
      .andExpect(jsonPath("$.outputs.outputs").value("草稿输出：草稿试运行输入"));

    mockMvc.perform(get("/api/aio/admin/apps/" + appId)
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.status").value("draft"))
      .andExpect(jsonPath("$.publishedVersionId").doesNotExist());
  }

    @Test
    void knowledgeDocumentCanBeUploadedAsFile() throws Exception {
    String consoleToken = loginToken();
    Map<String, Object> datasetRequest = new LinkedHashMap<>();
    datasetRequest.put("name", "Upload Dataset");
    datasetRequest.put("chunkStrategy", "paragraph");
    String datasetResponse = mockMvc.perform(post("/api/aio/admin/datasets")
      .header("Authorization", "Bearer " + consoleToken)
      .contentType(MediaType.APPLICATION_JSON)
      .content(objectMapper.writeValueAsString(datasetRequest)))
      .andExpect(status().isOk())
      .andReturn()
      .getResponse()
      .getContentAsString();
    String datasetId = extract(datasetResponse, "id");

    MockMultipartFile file = new MockMultipartFile(
      "file",
      "refund.md",
      "text/markdown",
      "# Refund\n客户可在 7 天内申请退款。\n\n# Exchange\n客户可在 15 天内申请换货。".getBytes("UTF-8"));
    String documentResponse = mockMvc.perform(multipart("/api/aio/admin/datasets/" + datasetId + "/documents/upload")
      .file(file)
      .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.name").value("refund.md"))
      .andExpect(jsonPath("$.sourceType").value("markdown"))
      .andExpect(jsonPath("$.indexStatus").value("success"))
      .andReturn()
      .getResponse()
      .getContentAsString();
    String documentId = extract(documentResponse, "id");

    mockMvc.perform(get("/api/aio/admin/documents/" + documentId + "/chunks")
      .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.parse.actual_strategy").value("paragraph"))
      .andExpect(jsonPath("$.parse.total_chunks").value(2))
      .andExpect(jsonPath("$.parse.vector_status").value("lightweight_text_index"))
      .andExpect(jsonPath("$.chunks[0].id").exists())
      .andExpect(jsonPath("$.chunks[0].vectorId").exists());
    }

  @Test
  void knowledgeDatasetAttributesCanBeUpdated() throws Exception {
    String consoleToken = loginToken();
    Map<String, Object> datasetRequest = new LinkedHashMap<>();
    datasetRequest.put("name", "Editable Dataset");
    datasetRequest.put("description", "before");
    datasetRequest.put("chunkStrategy", "fixed");
    String datasetResponse = mockMvc.perform(post("/api/aio/admin/datasets")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(datasetRequest)))
      .andExpect(status().isOk())
      .andReturn()
      .getResponse()
      .getContentAsString();
    String datasetId = extract(datasetResponse, "id");

    datasetRequest.put("name", "Edited Dataset");
    datasetRequest.put("description", "after");
    datasetRequest.put("embeddingModel", "text-embedding-v4");
    datasetRequest.put("chunkStrategy", "ai");
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/aio/admin/datasets/" + datasetId)
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(datasetRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.name").value("Edited Dataset"))
      .andExpect(jsonPath("$.description").value("after"))
      .andExpect(jsonPath("$.embeddingModel").value("text-embedding-v4"))
      .andExpect(jsonPath("$.chunkStrategy").value("ai"));
  }

  @Test
  void knowledgeDocumentDeleteRemovesChunksAndIndexData() throws Exception {
    String consoleToken = loginToken();
    Map<String, Object> datasetRequest = new LinkedHashMap<>();
    datasetRequest.put("name", "Delete Doc Dataset");
    String datasetResponse = mockMvc.perform(post("/api/aio/admin/datasets")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(datasetRequest)))
      .andExpect(status().isOk())
      .andReturn()
      .getResponse()
      .getContentAsString();
    String datasetId = extract(datasetResponse, "id");

    Map<String, Object> documentRequest = new LinkedHashMap<>();
    documentRequest.put("name", "delete-me");
    documentRequest.put("sourceType", "text:paragraph");
    documentRequest.put("text", "退款政策：7 天内可退。\n\n换货政策：15 天内可换。");
    String documentResponse = mockMvc.perform(post("/api/aio/admin/datasets/" + datasetId + "/documents")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(documentRequest)))
      .andExpect(status().isOk())
      .andReturn()
      .getResponse()
      .getContentAsString();
    String documentId = extract(documentResponse, "id");

    mockMvc.perform(delete("/api/aio/admin/documents/" + documentId)
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk());

    mockMvc.perform(get("/api/aio/admin/datasets/" + datasetId + "/documents")
        .header("Authorization", "Bearer " + consoleToken))
      .andExpect(status().isOk())
      .andExpect(content().string("[]"));

    Map<String, Object> retrieveRequest = new LinkedHashMap<>();
    retrieveRequest.put("query", "退款");
    retrieveRequest.put("topK", 5);
    retrieveRequest.put("scoreThreshold", 0);
    mockMvc.perform(post("/api/aio/admin/datasets/" + datasetId + "/retrieve-test")
        .header("Authorization", "Bearer " + consoleToken)
        .contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(retrieveRequest)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.records.length()").value(0));
  }

  @Test
  void publishedAgentCanBeInvokedWithApiKey() throws Exception {
    String consoleToken = loginToken();
    String appResponse = createAgentApp(consoleToken);
    String appId = extract(appResponse, "id");

    Map<String, Object> versionRequest = new LinkedHashMap<>();
    versionRequest.put("definitionJson", "{\"type\":\"agent\",\"model\":{\"chatModel\":\"test\"},\"prompt\":{\"system\":\"You are a support assistant.\"}}");
    String versionResponse = mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/versions")
          .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(versionRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.versionNo").value(1))
        .andReturn()
        .getResponse()
        .getContentAsString();

    Map<String, Object> publishRequest = new LinkedHashMap<>();
    publishRequest.put("versionId", extract(versionResponse, "id"));
    mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/publish")
          .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(publishRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("published"));

    String apiKey = createApiKey("Runtime key", appId, consoleToken);
    Map<String, Object> chatRequest = new LinkedHashMap<>();
    chatRequest.put("query", "hello");
    chatRequest.put("stream", false);

    mockMvc.perform(post("/v1/apps/" + appId + "/chat")
            .header("Authorization", "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(chatRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("success"))
        .andExpect(jsonPath("$.run_id").exists());
  }

  @Test
  void knowledgeAndWorkflowWaitTaskFlowWorkEndToEnd() throws Exception {
      String consoleToken = loginToken();
    Map<String, Object> datasetRequest = new LinkedHashMap<>();
    datasetRequest.put("name", "Support Policy");
    String datasetResponse = mockMvc.perform(post("/api/aio/admin/datasets")
        .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(datasetRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").exists())
        .andReturn()
        .getResponse()
        .getContentAsString();
    String datasetId = extract(datasetResponse, "id");

    Map<String, Object> documentRequest = new LinkedHashMap<>();
    documentRequest.put("name", "Refunds");
    documentRequest.put("sourceType", "text");
    documentRequest.put("text", "退款政策：客户可在 7 天内申请退款。");
    mockMvc.perform(post("/api/aio/admin/datasets/" + datasetId + "/documents")
          .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(documentRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.indexStatus").value("success"));

    Map<String, Object> retrieveRequest = new LinkedHashMap<>();
    retrieveRequest.put("query", "退款政策");
    retrieveRequest.put("topK", 3);
    mockMvc.perform(post("/api/aio/admin/datasets/" + datasetId + "/retrieve-test")
          .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(retrieveRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.records[0].chunk_id").exists());

    String appResponse = createWorkflowApp(consoleToken);
    String appId = extract(appResponse, "id");
    Map<String, Object> versionRequest = new LinkedHashMap<>();
    versionRequest.put("definitionJson", workflowDefinition());
    String versionResponse = mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/versions")
          .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(versionRequest)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();

    Map<String, Object> publishRequest = new LinkedHashMap<>();
    publishRequest.put("versionId", extract(versionResponse, "id"));
    mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/publish")
        .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(publishRequest)))
        .andExpect(status().isOk());

    String apiKey = createApiKey("Workflow key", appId, consoleToken);
    Map<String, Object> runRequest = new LinkedHashMap<>();
    Map<String, Object> inputs = new LinkedHashMap<>();
    inputs.put("question", "这个客户应该怎么跟进？");
    inputs.put("operator_id", "u_001");
    runRequest.put("inputs", inputs);
    String runResponse = mockMvc.perform(post("/v1/apps/" + appId + "/run")
            .header("Authorization", "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(runRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("waiting"))
        .andExpect(jsonPath("$.wait_task.id").exists())
        .andReturn()
        .getResponse()
        .getContentAsString();

    String runId = extract(runResponse, "run_id");
    String waitTaskId = extractNested(runResponse, "wait_task", "id");
    Map<String, Object> submitRequest = new LinkedHashMap<>();
    submitRequest.put("action", "approve");
    submitRequest.put("comment", "确认继续");
    mockMvc.perform(post("/v1/wait-tasks/" + waitTaskId + "/submit")
            .header("Authorization", "Bearer " + apiKey)
            .header("Idempotency-Key", "idem-workflow-test")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(submitRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.run_status").value("success"));

    mockMvc.perform(get("/v1/runs/" + runId + "/traces")
            .header("Authorization", "Bearer " + apiKey))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").exists());
  }

  @Test
  void runtimeApiRequiresApiKey() throws Exception {
    mockMvc.perform(post("/v1/apps/app_missing/chat")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isUnauthorized());
  }

  @SuppressWarnings("unchecked")
  private String extractApiKey(String response) throws Exception {
    Map<String, Object> body = objectMapper.readValue(response, Map.class);
    return (String) body.get("apiKey");
  }

  private String loginToken() throws Exception {
    return loginToken("admin", "admin");
  }

  private String loginToken(String username, String password) throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("username", username);
    request.put("password", password);
    String response = mockMvc.perform(post("/api/aio/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").exists())
        .andReturn()
        .getResponse()
        .getContentAsString();
    return extract(response, "token");
  }

  private String createAgentApp(String consoleToken) throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "Support Agent");
    request.put("type", "agent");
    request.put("visibility", "public_api");
    return mockMvc.perform(post("/api/aio/admin/apps")
            .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.type").value("agent"))
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String createWorkflowApp(String consoleToken) throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "Human Workflow");
    request.put("type", "workflow");
    request.put("visibility", "public_api");
    return mockMvc.perform(post("/api/aio/admin/apps")
            .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.type").value("workflow"))
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String createApiKey(String name, String appId, String consoleToken) throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", name);
    request.put("workspaceId", "default");
    request.put("appId", appId);
    String response = mockMvc.perform(post("/api/aio/admin/api-keys")
            .header("Authorization", "Bearer " + consoleToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
    return extractApiKey(response);
  }

  @SuppressWarnings("unchecked")
  private String extract(String response, String field) throws Exception {
    Map<String, Object> body = objectMapper.readValue(response, Map.class);
    return (String) body.get(field);
  }

  @SuppressWarnings("unchecked")
  private String extractNested(String response, String objectField, String field) throws Exception {
    Map<String, Object> body = objectMapper.readValue(response, Map.class);
    Map<String, Object> nested = (Map<String, Object>) body.get(objectField);
    return (String) nested.get(field);
  }

  private String workflowDefinition() {
    return "{"
        + "\"type\":\"workflow\","
        + "\"nodes\":["
        + "{\"id\":\"start\",\"type\":\"start\",\"config\":{}},"
        + "{\"id\":\"answer\",\"type\":\"llm\",\"config\":{\"prompt\":\"建议：{{inputs.question}}\"}},"
        + "{\"id\":\"confirm\",\"type\":\"user_confirm\",\"config\":{\"title\":\"确认处理方案\",\"description\":\"{{answer.text}}\",\"actions\":[{\"key\":\"approve\",\"label\":\"确认\"}] }},"
        + "{\"id\":\"end\",\"type\":\"end\",\"config\":{\"output\":\"{{answer.text}}\"}}"
        + "],"
        + "\"edges\":["
        + "{\"from\":\"start\",\"to\":\"answer\"},"
        + "{\"from\":\"answer\",\"to\":\"confirm\"},"
        + "{\"from\":\"confirm\",\"to\":\"end\",\"condition\":\"{{confirm.action == 'approve'}}\"}"
        + "]"
        + "}";
  }

  private String workflowDefinitionWithNamespacedVariables(String output) {
    return "{"
        + "\"type\":\"workflow\","
        + "\"version\":1,"
        + "\"inputs\":[{\"name\":\"question\",\"type\":\"string\",\"required\":true}],"
        + "\"variables\":[],"
        + "\"nodes\":["
        + "{\"id\":\"start\",\"type\":\"start\",\"label\":\"开始\",\"config\":{}},"
        + "{\"id\":\"answer\",\"type\":\"llm\",\"label\":\"生成回复\",\"config\":{\"prompt\":\"建议：{{inputs.question}}\"}},"
        + "{\"id\":\"confirm\",\"type\":\"user_confirm\",\"label\":\"人工确认\",\"config\":{\"title\":\"确认处理方案\",\"description\":\"{{nodes.answer.text}}\",\"expiresInSeconds\":86400,\"actions\":[{\"key\":\"approve\",\"label\":\"确认\"}]}},"
        + "{\"id\":\"end\",\"type\":\"end\",\"label\":\"结束\",\"config\":{\"output\":\"" + output + "：{{nodes.answer.text}}\"}}"
        + "],"
        + "\"edges\":["
        + "{\"id\":\"edge_start_answer\",\"from\":\"start\",\"to\":\"answer\"},"
        + "{\"id\":\"edge_answer_confirm\",\"from\":\"answer\",\"to\":\"confirm\"},"
        + "{\"id\":\"edge_confirm_end\",\"from\":\"confirm\",\"to\":\"end\",\"condition\":\"{{nodes.confirm.action == 'approve'}}\"}"
        + "]"
        + "}";
  }

  private String workflowDraftRunDefinition() {
    return "{"
        + "\"type\":\"workflow\","
        + "\"version\":1,"
        + "\"inputs\":[{\"name\":\"question\",\"type\":\"string\",\"required\":true}],"
        + "\"variables\":[],"
        + "\"nodes\":["
        + "{\"id\":\"start\",\"type\":\"start\",\"label\":\"开始\",\"config\":{}},"
        + "{\"id\":\"capture\",\"type\":\"variable\",\"label\":\"记录变量\",\"config\":{\"draftAnswer\":\"{{inputs.question}}\"}},"
        + "{\"id\":\"end\",\"type\":\"end\",\"label\":\"结束\",\"config\":{\"output\":\"草稿输出：{{nodes.capture.draftAnswer}}\"}}"
        + "],"
        + "\"edges\":["
        + "{\"id\":\"edge_start_capture\",\"from\":\"start\",\"to\":\"capture\"},"
        + "{\"id\":\"edge_capture_end\",\"from\":\"capture\",\"to\":\"end\"}"
        + "]"
        + "}";
  }
}
