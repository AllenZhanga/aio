package com.dxnow.aio;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
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
    mockMvc.perform(get("/api/aio/admin/tenants"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("default"));
  }

  @Test
  void apiKeySecretIsReturnedOnlyOnCreate() throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "Joget integration");
    request.put("workspaceId", "default");

    String createResponse = mockMvc.perform(post("/api/aio/admin/api-keys")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.apiKey").exists())
        .andExpect(jsonPath("$.keyPrefix").exists())
        .andReturn()
        .getResponse()
        .getContentAsString();

    mockMvc.perform(get("/api/aio/admin/api-keys"))
        .andExpect(status().isOk())
        .andExpect(content().string(not(containsString("keyHash"))))
        .andExpect(content().string(not(containsString(extractApiKey(createResponse)))));
  }

  @Test
  void providerSecretIsNeverEchoed() throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "OpenAI Compatible");
    request.put("workspaceId", "default");
    request.put("providerType", "openai_compatible");
    request.put("baseUrl", "https://api.example.com/v1");
    request.put("apiKey", "provider-secret-value");
    request.put("defaultChatModel", "gpt-4.1-mini");

    mockMvc.perform(post("/api/aio/admin/providers")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.hasApiKey").value(true))
        .andExpect(content().string(not(containsString("provider-secret-value"))))
        .andExpect(content().string(not(containsString("apiKeyCiphertext"))));
  }

  @Test
  void publishedAgentCanBeInvokedWithApiKey() throws Exception {
    String appResponse = createAgentApp();
    String appId = extract(appResponse, "id");

    Map<String, Object> versionRequest = new LinkedHashMap<>();
    versionRequest.put("definitionJson", "{\"type\":\"agent\",\"model\":{\"chatModel\":\"test\"},\"prompt\":{\"system\":\"You are a support assistant.\"}}");
    String versionResponse = mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/versions")
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
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(publishRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("published"));

    String apiKey = createApiKey("Runtime key", appId);
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
    Map<String, Object> datasetRequest = new LinkedHashMap<>();
    datasetRequest.put("name", "Support Policy");
    String datasetResponse = mockMvc.perform(post("/api/aio/admin/datasets")
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
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(documentRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.indexStatus").value("success"));

    Map<String, Object> retrieveRequest = new LinkedHashMap<>();
    retrieveRequest.put("query", "退款政策");
    retrieveRequest.put("topK", 3);
    mockMvc.perform(post("/api/aio/admin/datasets/" + datasetId + "/retrieve-test")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(retrieveRequest)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.records[0].chunk_id").exists());

    String appResponse = createWorkflowApp();
    String appId = extract(appResponse, "id");
    Map<String, Object> versionRequest = new LinkedHashMap<>();
    versionRequest.put("definitionJson", workflowDefinition());
    String versionResponse = mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/versions")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(versionRequest)))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();

    Map<String, Object> publishRequest = new LinkedHashMap<>();
    publishRequest.put("versionId", extract(versionResponse, "id"));
    mockMvc.perform(post("/api/aio/admin/apps/" + appId + "/publish")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(publishRequest)))
        .andExpect(status().isOk());

    String apiKey = createApiKey("Workflow key", appId);
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

  private String createAgentApp() throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "Support Agent");
    request.put("type", "agent");
    request.put("visibility", "public_api");
    return mockMvc.perform(post("/api/aio/admin/apps")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.type").value("agent"))
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String createWorkflowApp() throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", "Human Workflow");
    request.put("type", "workflow");
    request.put("visibility", "public_api");
    return mockMvc.perform(post("/api/aio/admin/apps")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.type").value("workflow"))
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private String createApiKey(String name, String appId) throws Exception {
    Map<String, Object> request = new LinkedHashMap<>();
    request.put("name", name);
    request.put("workspaceId", "default");
    request.put("appId", appId);
    String response = mockMvc.perform(post("/api/aio/admin/api-keys")
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
}
