package com.dxnow.aio.app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class AppValidationService {

  private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z_][a-zA-Z0-9_\\.]*)");
  private static final Pattern SECRET_PATTERN = Pattern.compile("(?i)(sk_[a-z0-9]{16,}|authorization\\s*[:=]\\s*bearer|api[_-]?key\\s*[:=])");

  private final ObjectMapper objectMapper;

  public AppValidationService(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ValidationReport validate(String appType, String definitionJson) {
    ValidationReport report = new ValidationReport();
    report.appType = appType;
    if (definitionJson == null || definitionJson.isBlank()) {
      report.add("error", "definition.empty", "应用定义为空", "请先保存至少一个可发布版本。", "definition");
      return report.finish();
    }
    JsonNode root;
    try {
      root = objectMapper.readTree(definitionJson);
    } catch (Exception e) {
      report.add("error", "definition.invalid_json", "应用定义不是合法 JSON", e.getMessage(), "definition");
      return report.finish();
    }
    if (!root.isObject()) {
      report.add("error", "definition.object_required", "应用定义必须是 JSON Object", "请检查保存的 DSL 内容。", "definition");
      return report.finish();
    }
    String type = root.path("type").asText(appType);
    if (!appType.equals(type)) {
      report.add("error", "definition.type_mismatch", "应用类型与定义类型不一致", "当前应用类型是 " + appType + "，定义类型是 " + type + "。", "type");
    }
    if (SECRET_PATTERN.matcher(definitionJson).find()) {
      report.add("error", "security.secret_inline", "定义中疑似包含明文密钥", "请改用 Provider、Tool 或环境变量管理密钥，不要把密钥写入 Prompt、Header 或 DSL。", "definition");
    }
    if ("workflow".equals(appType)) {
      validateWorkflow(root, report);
    } else {
      validateAgent(root, report);
    }
    return report.finish();
  }

  private void validateAgent(JsonNode root, ValidationReport report) {
    JsonNode prompt = root.path("prompt");
    String system = prompt.path("system").asText("").trim();
    if (system.isBlank()) {
      report.add("error", "agent.prompt_required", "System Prompt 不能为空", "请补充角色、目标、边界和输出要求。", "prompt.system");
    }
    JsonNode model = root.path("model");
    if (model.path("chatModel").asText("").isBlank()) {
      report.add("error", "agent.model_required", "Chat Model 不能为空", "请选择或填写当前应用要使用的模型。", "model.chatModel");
    }
    if (model.path("providerAccountId").asText("").isBlank()) {
      report.add("warning", "agent.provider_missing", "未绑定模型供应商", "当前会使用本地兜底回复；生产发布前建议绑定可用 Provider。", "model.providerAccountId");
    }
    String mode = root.path("agentMode").asText("chat-assistant");
    if ("text-generation".equals(mode) && !system.contains("模板")) {
      report.add("warning", "agent.template_missing", "文本生成模板不明显", "建议在 Prompt 中包含输入变量和生成格式。", "prompt.system");
    }
    if (!root.path("knowledge").isArray() || root.path("knowledge").size() == 0) {
      report.add("info", "agent.knowledge_optional", "未挂载知识库", "如果用于企业问答，建议挂载知识库并通过调试确认命中片段。", "knowledge");
    }
    report.add("info", "agent.test_case_recommended", "建议保存至少一个调试样例", "后续发布检查会把调试样例作为回归测试依据。", "tests");
  }

  private void validateWorkflow(JsonNode root, ValidationReport report) {
    JsonNode nodes = root.path("nodes");
    JsonNode edges = root.path("edges");
    if (!nodes.isArray() || nodes.size() == 0) {
      report.add("error", "workflow.nodes_required", "Workflow 必须包含节点", "请至少保留 Start 和 End 节点。", "nodes");
      return;
    }
    if (!edges.isArray()) {
      report.add("error", "workflow.edges_array_required", "Workflow edges 必须是数组", "请检查连线 DSL。", "edges");
      return;
    }

    Map<String, JsonNode> nodeById = new HashMap<>();
    int startCount = 0;
    int endCount = 0;
    for (JsonNode node : nodes) {
      String id = node.path("id").asText("").trim();
      String type = node.path("type").asText("").trim();
      if (id.isBlank()) {
        report.add("error", "workflow.node_id_required", "节点 ID 不能为空", "请为所有节点生成稳定 ID。", "nodes");
        continue;
      }
      if (nodeById.containsKey(id)) {
        report.add("error", "workflow.node_id_duplicate", "节点 ID 重复", "重复节点：" + id, "nodes." + id);
      }
      nodeById.put(id, node);
      if ("start".equals(type)) startCount++;
      if ("end".equals(type)) endCount++;
      validateWorkflowNode(node, report);
    }
    if (startCount != 1) {
      report.add("error", "workflow.start_unique", "Start 节点必须且只能有一个", "当前 Start 数量：" + startCount, "nodes");
    }
    if (endCount == 0) {
      report.add("error", "workflow.end_required", "至少需要一个 End 节点", "请补充流程结束节点。", "nodes");
    }

    Map<String, List<String>> adjacency = new HashMap<>();
    for (JsonNode edge : edges) {
      String from = edge.path("from").asText("").trim();
      String to = edge.path("to").asText("").trim();
      if (!nodeById.containsKey(from)) {
        report.add("error", "workflow.edge_from_missing", "连线起点不存在", "缺失节点：" + from, "edges");
      }
      if (!nodeById.containsKey(to)) {
        report.add("error", "workflow.edge_to_missing", "连线终点不存在", "缺失节点：" + to, "edges");
      }
      adjacency.computeIfAbsent(from, ignored -> new ArrayList<>()).add(to);
    }

    Set<String> reachable = reachableFromStart(nodeById, adjacency);
    for (String nodeId : nodeById.keySet()) {
      if (!reachable.contains(nodeId)) {
        report.add("error", "workflow.node_unreachable", "节点无法从 Start 到达", "不可达节点：" + nodeId, "nodes." + nodeId);
      }
    }
    if (!hasReachableEnd(nodeById, reachable)) {
      report.add("error", "workflow.end_unreachable", "没有可达的 End 节点", "请检查连线是否能从 Start 走到 End。", "edges");
    }
    if (hasCycle(adjacency)) {
      report.add("error", "workflow.cycle_detected", "当前 Workflow 存在环路", "轻量运行时第一版暂不支持循环，请改为 DAG。", "edges");
    }
    validateVariables(root, nodeById.keySet(), report);
  }

  private void validateWorkflowNode(JsonNode node, ValidationReport report) {
    String id = node.path("id").asText("");
    String type = node.path("type").asText("");
    JsonNode config = node.path("config");
    if (type.isBlank()) {
      report.add("error", "workflow.node_type_required", "节点类型不能为空", "节点 " + id + " 缺少 type。", "nodes." + id + ".type");
      return;
    }
    if ("llm".equals(type) && config.path("prompt").asText("").trim().isBlank()) {
      report.add("error", "workflow.llm_prompt_required", "LLM 节点 Prompt 不能为空", "节点 " + id + " 需要配置 prompt。", "nodes." + id + ".config.prompt");
    }
    if ("tool".equals(type) && config.path("toolId").asText("").trim().isBlank()) {
      report.add("warning", "workflow.tool_missing", "Tool 节点未选择工具", "节点 " + id + " 运行时会缺少工具引用。", "nodes." + id + ".config.toolId");
    }
    if ("user_confirm".equals(type)) {
      if (config.path("title").asText("").trim().isBlank()) {
        report.add("error", "workflow.confirm_title_required", "人工确认节点标题不能为空", "节点 " + id + " 需要可读标题。", "nodes." + id + ".config.title");
      }
      if (!config.path("actions").isArray() || config.path("actions").size() == 0) {
        report.add("error", "workflow.confirm_actions_required", "人工确认节点必须配置动作", "至少配置确认或拒绝动作。", "nodes." + id + ".config.actions");
      }
      if (!config.has("expiresInSeconds")) {
        report.add("warning", "workflow.confirm_expiry_missing", "人工确认节点未配置超时", "建议设置 expiresInSeconds 并配置超时处理策略。", "nodes." + id + ".config.expiresInSeconds");
      }
    }
    if ("condition".equals(type) && config.path("expression").asText("").trim().isBlank()) {
      report.add("error", "workflow.condition_required", "条件节点表达式不能为空", "请填写表达式或删除该条件节点。", "nodes." + id + ".config.expression");
    }
  }

  private Set<String> reachableFromStart(Map<String, JsonNode> nodeById, Map<String, List<String>> adjacency) {
    String startId = nodeById.entrySet().stream()
        .filter(entry -> "start".equals(entry.getValue().path("type").asText()))
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse(null);
    Set<String> visited = new HashSet<>();
    if (startId == null) return visited;
    ArrayDeque<String> queue = new ArrayDeque<>();
    queue.add(startId);
    while (!queue.isEmpty()) {
      String current = queue.removeFirst();
      if (!visited.add(current)) continue;
      for (String next : adjacency.getOrDefault(current, List.of())) {
        if (nodeById.containsKey(next)) queue.add(next);
      }
    }
    return visited;
  }

  private boolean hasReachableEnd(Map<String, JsonNode> nodeById, Set<String> reachable) {
    return reachable.stream().anyMatch(nodeId -> "end".equals(nodeById.get(nodeId).path("type").asText()));
  }

  private boolean hasCycle(Map<String, List<String>> adjacency) {
    Set<String> visiting = new HashSet<>();
    Set<String> visited = new HashSet<>();
    for (String nodeId : adjacency.keySet()) {
      if (detectCycle(nodeId, adjacency, visiting, visited)) return true;
    }
    return false;
  }

  private boolean detectCycle(String nodeId, Map<String, List<String>> adjacency, Set<String> visiting, Set<String> visited) {
    if (visited.contains(nodeId)) return false;
    if (!visiting.add(nodeId)) return true;
    for (String next : adjacency.getOrDefault(nodeId, List.of())) {
      if (detectCycle(next, adjacency, visiting, visited)) return true;
    }
    visiting.remove(nodeId);
    visited.add(nodeId);
    return false;
  }

  private void validateVariables(JsonNode root, Set<String> nodeIds, ValidationReport report) {
    Set<String> allowedRoots = new HashSet<>(nodeIds);
    allowedRoots.add("inputs");
    allowedRoots.add("vars");
    allowedRoots.add("nodes");
    allowedRoots.add("sys");
    allowedRoots.add("metadata");
    allowedRoots.add("env");
    allowedRoots.add("run_id");
    allowedRoots.add("app_id");
    allowedRoots.add("user_id");
    allowedRoots.add("tenant_id");
    collectVariableReferences(root, allowedRoots, nodeIds, report, "definition");
  }

  private void collectVariableReferences(JsonNode node, Set<String> allowedRoots, Set<String> nodeIds, ValidationReport report, String path) {
    if (node.isTextual()) {
      Matcher matcher = VARIABLE_PATTERN.matcher(node.asText());
      while (matcher.find()) {
        String expression = matcher.group(1);
        String[] parts = expression.split("\\.");
        String root = parts[0];
        if (!allowedRoots.contains(root)) {
          report.add("error", "workflow.variable_missing", "变量引用不存在", "表达式 {{" + expression + "}} 无法定位到输入、系统变量或节点输出。", path);
        } else if ("nodes".equals(root) && (parts.length < 2 || !nodeIds.contains(parts[1]))) {
          report.add("error", "workflow.variable_node_missing", "节点输出引用不存在", "表达式 {{" + expression + "}} 引用了不存在的节点。", path);
        }
      }
    } else if (node.isObject()) {
      Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
      while (fields.hasNext()) {
        Map.Entry<String, JsonNode> entry = fields.next();
        collectVariableReferences(entry.getValue(), allowedRoots, nodeIds, report, path + "." + entry.getKey());
      }
    } else if (node.isArray()) {
      for (int i = 0; i < node.size(); i++) {
        collectVariableReferences(node.get(i), allowedRoots, nodeIds, report, path + "[" + i + "]");
      }
    }
  }

  public static class ValidationReport {
    public String appType;
    public boolean passed;
    public int blockingErrors;
    public int warnings;
    public int suggestions;
    public List<ValidationIssue> issues = new ArrayList<>();

    void add(String severity, String code, String title, String detail, String target) {
      ValidationIssue issue = new ValidationIssue();
      issue.severity = severity;
      issue.code = code;
      issue.title = title;
      issue.detail = detail;
      issue.target = target;
      issues.add(issue);
    }

    ValidationReport finish() {
      blockingErrors = (int) issues.stream().filter(issue -> "error".equals(issue.severity)).count();
      warnings = (int) issues.stream().filter(issue -> "warning".equals(issue.severity)).count();
      suggestions = (int) issues.stream().filter(issue -> "info".equals(issue.severity)).count();
      passed = blockingErrors == 0;
      return this;
    }
  }

  public static class ValidationIssue {
    public String severity;
    public String code;
    public String title;
    public String detail;
    public String target;
  }
}