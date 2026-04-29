import { AlertCircle, ArrowLeft, Bot, Code2, Settings2, Workflow } from "lucide-react";
import type { AppRecord, AuthSession } from "../types";
import { CodeBlock, CopyButton, Field, StatePanel } from "./ui";

export function AppApiDocsPage(props: {
  selectedApp?: AppRecord;
  selectedAppId: string;
  appsLoading: boolean;
  session: AuthSession;
  runtimeKey: string;
  setRuntimeKey: (value: string) => void;
  busyAction: string;
  openDesigner: (app: AppRecord) => void;
  back: () => void;
}) {
  if (!props.selectedApp) {
    return (
      <section className="workspacePane">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <StatePanel icon={props.appsLoading ? "loading" : "missing"} title={props.appsLoading ? "正在打开 API 文档" : "未找到应用"} text={props.appsLoading ? `正在加载 ${props.selectedAppId || "当前应用"} 的 API 信息。` : "该应用不存在、已归档，或当前空间没有访问权限。"} />
      </section>
    );
  }

  const app = props.selectedApp;
  const docs = buildApiDocs(app, props.runtimeKey);
  const statusMeta = getAppStatusMeta(app);
  return (
    <section className="workspacePane apiDocsPane">
      <div className="apiDocsHeader">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <div className="designerTitle">
          <span className={`tileIcon ${app.type}`}>{app.type === "agent" ? <Bot size={20} /> : <Workflow size={20} />}</span>
          <div>
            <h1>{app.name} API 文档</h1>
            <p>{app.type} · {statusMeta.label} · {app.id}</p>
          </div>
        </div>
        <div className="designerActions">
          <button className="ghostBtn" onClick={() => props.openDesigner(app)}><Settings2 size={16} /> 返回设计</button>
        </div>
      </div>
      <div className="apiDocsGrid">
        <aside className="designCard apiMetaCard">
          <h3>调用信息</h3>
          <dl>
            <dt>Base URL</dt><dd>{docs.baseUrl}</dd>
            <dt>App ID</dt><dd>{app.id}</dd>
            <dt>鉴权方式</dt><dd>Authorization: Bearer sk_xxx</dd>
            <dt>Key Scope</dt><dd>tenant={props.session.tenantId} / workspace={props.session.workspaceId}</dd>
          </dl>
          <Field label="Runtime API Key">
            <input value={props.runtimeKey} onChange={(event) => props.setRuntimeKey(event.target.value)} placeholder="sk_..." />
          </Field>
          <p className="mutedText">Runtime API Key 统一在 API Key 菜单创建，这里只用于预览示例。</p>
          {app.status !== "published" && <div className="warningBox"><AlertCircle size={16} /> 当前应用尚未发布，外部运行 API 只会调用已发布版本。</div>}
        </aside>
        <main className="apiExampleStack">
          <section className="designCard">
            <div className="sectionTitle">
              <Code2 size={18} />
              <div><h2>{docs.primaryTitle}</h2><p>{docs.primaryDescription}</p></div>
            </div>
            <EndpointRow method="POST" path={docs.primaryPath} />
            <CodeBlock title="curl" code={docs.curl} />
            <CodeBlock title="JavaScript" code={docs.javascript} />
            <CodeBlock title="Java" code={docs.java} />
            <CodeBlock title="Python" code={docs.python} />
          </section>
          <section className="designCard">
            <h3>{app.type === "workflow" ? "Workflow 等待任务与 Trace" : "Run 与 Trace 查询"}</h3>
            {docs.extra.map((item) => <CodeBlock key={item.title} title={item.title} code={item.code} />)}
          </section>
        </main>
      </div>
    </section>
  );
}

function EndpointRow({ method, path }: { method: string; path: string }) {
  return (
    <div className="endpointRow">
      <strong>{method}</strong>
      <span>{path}</span>
      <CopyButton text={path} />
    </div>
  );
}

function getAppStatusMeta(app: AppRecord) {
  if (app.status === "published") return { label: "已发布", tone: "success" };
  if (app.status === "published_with_draft") return { label: "有未发布变更", tone: "warning" };
  if (app.status === "disabled") return { label: "已禁用", tone: "danger" };
  if (app.status === "archived") return { label: "已归档", tone: "muted" };
  if (app.publishedVersionId) return { label: "有未发布变更", tone: "warning" };
  return { label: "草稿", tone: "draft" };
}

function buildApiDocs(app: AppRecord, runtimeKey: string) {
  const baseUrl = window.location.origin;
  const key = runtimeKey || "sk_REPLACE_ME";
  const path = app.type === "workflow" ? `/v1/apps/${app.id}/run` : `/v1/apps/${app.id}/chat`;
  const body =
    app.type === "workflow"
      ? JSON.stringify(
          {
            inputs: { question: "这个客户应该怎么跟进？", operator_id: "user_001" },
            response_mode: "blocking",
            metadata: { external_biz_id: "crm_task_123" },
          },
          null,
          2,
        )
      : JSON.stringify(
          {
            query: "帮我总结一下退款政策",
            inputs: { user_name: "张三" },
            stream: false,
          },
          null,
          2,
        );
  const pythonBody = body
    .replace(/true/g, "True")
    .replace(/false/g, "False")
    .replace(/null/g, "None");
  return {
    baseUrl,
    primaryTitle: app.type === "workflow" ? "Workflow Run API" : "Agent Chat API",
    primaryDescription:
      app.type === "workflow"
        ? "用于触发已发布工作流。遇到人工确认或表单节点时会返回 waiting 和 wait_task。"
        : "用于调用已发布 Agent，支持多轮 conversation_id 和非流式/流式响应。",
    primaryPath: path,
    curl: [
      `curl -X POST '${baseUrl}${path}'`,
      `  -H 'Authorization: Bearer ${key}'`,
      "  -H 'Content-Type: application/json'",
      `  -d '${body.replace(/'/g, "'\\''")}'`,
    ].join("\n"),
    javascript: [
      `const response = await fetch("${baseUrl}${path}", {`,
      '  method: "POST",',
      `  headers: { "Authorization": "Bearer ${key}", "Content-Type": "application/json" },`,
      `  body: JSON.stringify(${body})`,
      "});",
      "const result = await response.json();",
    ].join("\n"),
    java: [
      "HttpRequest request = HttpRequest.newBuilder()",
      `    .uri(URI.create("${baseUrl}${path}"))`,
      `    .header("Authorization", "Bearer ${key}")`,
      '    .header("Content-Type", "application/json")',
      `    .POST(HttpRequest.BodyPublishers.ofString("""${body}"""))`,
      "    .build();",
    ].join("\n"),
    python: [
      "import requests",
      `response = requests.post("${baseUrl}${path}",`,
      `  headers={"Authorization": "Bearer ${key}"},`,
      `  json=${pythonBody})`,
      "print(response.json())",
    ].join("\n"),
    extra:
      app.type === "workflow"
        ? [
            {
              title: "提交等待任务",
              code: [
                `curl -X POST '${baseUrl}/v1/wait-tasks/{wait_task_id}/submit'`,
                `  -H 'Authorization: Bearer ${key}'`,
                "  -H 'Idempotency-Key: 8e4b1a1c-6d4f-4fd8-a2ef-42d0a5b39c11'",
                "  -H 'Content-Type: application/json'",
                `  -d '{"action":"approve","comment":"确认继续"}'`,
              ].join("\n"),
            },
            {
              title: "查询 Run Trace",
              code: `curl -H 'Authorization: Bearer ${key}' '${baseUrl}/v1/runs/{run_id}/traces'`,
            },
            {
              title: "Streaming / Async 调用提示",
              code: "将请求体 response_mode 改为 streaming 可接收节点事件；改为 async 可立即返回 run_id，后续用 /v1/runs/{run_id} 查询。",
            },
          ]
        : [
            {
              title: "查询 Run",
              code: `curl -H 'Authorization: Bearer ${key}' '${baseUrl}/v1/runs/{run_id}'`,
            },
            {
              title: "查询 Trace",
              code: `curl -H 'Authorization: Bearer ${key}' '${baseUrl}/v1/runs/{run_id}/traces'`,
            },
            {
              title: "流式调用提示",
              code: "将请求体 stream 设置为 true；接口会以 text/event-stream 返回 run_started、message、run_completed 或 error 事件。",
            },
          ],
  };
}
