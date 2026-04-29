import { useState } from "react";
import { runtimeOutputText } from "../consoleUtils";
import type {
  AppKind,
  AppRecord,
  AuthSession,
  ExperienceMessage,
  RetrieveRecord,
  RuntimeResponse,
  RuntimeUsage,
  RuntimeRunResponse,
  RuntimeWaitTask,
  WaitSubmitResponse,
} from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

export function useExperiencePage({
  call,
  setStatus,
  selectedApp,
  authSession,
  runtimeKey,
}: {
  call: ConsoleCall;
  setStatus: (value: string) => void;
  selectedApp?: AppRecord;
  authSession: AuthSession | null;
  runtimeKey: string;
}) {
  const [messages, setMessages] = useState<ExperienceMessage[]>([]);
  const [input, setInput] = useState("请帮我处理一个退款咨询");
  const [feedback, setFeedback] = useState("确认继续");
  const [busyAction, setBusyAction] = useState("");

  function resetMessages() {
    setMessages([]);
  }

  async function sendMessage() {
    if (!selectedApp) return;
    if (!runtimeKey) {
      setStatus("请先在 API Key 菜单创建或填入 Runtime API Key");
      return;
    }
    const prompt = input.trim();
    if (!prompt) return;
    const userMessage: ExperienceMessage = {
      id: `msg_${Date.now()}_user`,
      role: "user",
      text: prompt,
      meta: selectedApp.type === "workflow" ? "Workflow 输入" : "用户消息",
    };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setBusyAction("experience-send");
    try {
      const path =
        selectedApp.type === "workflow"
          ? `/v1/apps/${selectedApp.id}/run`
          : `/v1/apps/${selectedApp.id}/chat`;
      if (selectedApp.type === "agent") {
        await sendStreamingAgentMessage(path, prompt);
        return;
      }
      const body =
        {
          inputs: {
            question: prompt,
            operator_id: authSession?.userId || "console-user",
          },
          response_mode: "blocking",
        };
      const response = await call<RuntimeResponse>(
        path,
        { method: "POST", body: JSON.stringify(body) },
        true,
      );
      appendRuntimeResponse(response, selectedApp.type);
      setStatus(
        response.status === "waiting"
          ? "AI 应用正在等待用户反馈"
          : "AI 应用体验完成",
      );
    } catch (error) {
      appendSystem(error instanceof Error ? error.message : "应用体验调用失败");
      setStatus(error instanceof Error ? error.message : "应用体验调用失败");
    } finally {
      setBusyAction("");
    }
  }

  async function submitWait(waitTask: RuntimeWaitTask, action = "approve") {
    if (!runtimeKey) {
      setStatus("请先在 API Key 菜单创建或填入 Runtime API Key");
      return;
    }
    setBusyAction(`experience-wait-${waitTask.id}`);
    const comment = feedback.trim() || (action === "reject" ? "拒绝" : "确认继续");
    setMessages((current) => [
      ...current,
      {
        id: `msg_${Date.now()}_feedback`,
        role: "user",
        text: comment,
        meta: action === "reject" ? "用户拒绝" : "用户反馈",
      },
    ]);
    try {
      const response = await call<WaitSubmitResponse>(
        `/v1/wait-tasks/${waitTask.id}/submit`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": `experience-${waitTask.id}-${Date.now()}`,
          },
          body: JSON.stringify({
            action,
            comment,
            submitted_by: authSession?.userId || "console-user",
          }),
        },
        true,
      );
      setMessages((current) =>
        current.map((message) =>
          message.waitTask?.id === waitTask.id
            ? {
                ...message,
                waitTask: {
                  ...message.waitTask,
                  status: response.wait_task_status,
                },
              }
            : message,
        ),
      );
      if (response.next_wait_task) {
        appendWait(response.next_wait_task);
        setStatus("流程继续后再次等待用户反馈");
      } else {
        const run = await call<RuntimeRunResponse>(
          `/v1/runs/${response.run_id}`,
          {},
          true,
        );
        setMessages((current) => [
          ...current,
          {
            id: `msg_${Date.now()}_assistant`,
            role: "assistant",
            text: runtimeOutputText(run.outputs, run.status),
            meta: `run ${run.run_id} · ${run.status}`,
            runId: run.run_id,
            status: run.status,
          },
        ]);
        setStatus(`流程已${run.status === "success" ? "完成" : run.status}`);
      }
    } catch (error) {
      appendSystem(error instanceof Error ? error.message : "用户反馈提交失败");
      setStatus(error instanceof Error ? error.message : "用户反馈提交失败");
    } finally {
      setBusyAction("");
    }
  }

  function appendRuntimeResponse(response: RuntimeResponse, type: AppKind) {
    if (response.status === "waiting" && response.wait_task) {
      appendWait(response.wait_task);
      return;
    }
    const text =
      type === "agent"
        ? response.answer || runtimeOutputText(response.outputs, response.status)
        : runtimeOutputText(response.outputs, response.status);
    setMessages((current) => [
      ...current,
      {
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        text,
        meta: `run ${response.run_id} · ${response.status}`,
        ...runtimeResponseDetails(response),
      },
    ]);
  }

  async function sendStreamingAgentMessage(path: string, prompt: string) {
    const assistantId = `msg_${Date.now()}_assistant_stream`;
    setMessages((current) => [
      ...current,
      { id: assistantId, role: "assistant", text: "", meta: "连接中", streaming: true },
    ]);
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtimeKey}`,
      },
      body: JSON.stringify({ query: prompt, stream: true }),
    });
    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        throw new Error("Runtime API Key 无效、已吊销、已过期，或当前只填了前缀。请在 API Key 菜单创建 Key，并使用创建结果里的完整 sk_ 明文。Runtime Key 列表中的 sk_xxx*** 前缀不能用于调用。");
      }
      if (response.status === 403) {
        throw new Error("Runtime API Key 没有访问当前应用的权限。请创建 Workspace Key，或创建绑定当前应用的 App Key。");
      }
      throw new Error(text || response.statusText);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream") || !response.body) {
      const payload = (await response.json()) as RuntimeResponse;
      setMessages((current) => current.filter((message) => message.id !== assistantId));
      appendRuntimeResponse(payload, "agent");
      setStatus("AI 应用体验完成");
      return;
    }
    await readSseStream(response.body, (event, data) => {
      if (event === "run_started") {
        updateMessage(assistantId, { meta: "流式响应 · 已开始", streaming: true });
      }
      if (event === "message") {
        const text = stringValue(data.answer || data.delta || data.content || data.text);
        updateMessage(assistantId, { text: text || "正在生成...", meta: "流式响应 · 生成中", streaming: true });
      }
      if (event === "run_completed") {
        const answer = stringValue(data.answer || data.outputs?.answer);
        const responseDetails = runtimeResponseDetails(data as RuntimeResponse);
        updateMessage(assistantId, {
          text: answer || "已完成。",
          meta: `run ${stringValue(data.run_id)} · ${stringValue(data.status)}`,
          streaming: false,
          ...responseDetails,
        });
      }
      if (event === "error") {
        updateMessage(assistantId, {
          text: stringValue(data.message) || "流式响应失败",
          meta: "error",
          streaming: false,
        });
      }
    });
    setStatus("AI 应用流式体验完成");
  }

  function updateMessage(id: string, patch: Partial<ExperienceMessage>) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, ...patch } : message)),
    );
  }

  function appendWait(waitTask: RuntimeWaitTask) {
    setMessages((current) => [
      ...current,
      {
        id: `msg_${Date.now()}_wait`,
        role: "wait",
        text:
          waitTask.description ||
          waitTask.title ||
          "AI 应用需要你的反馈后继续。",
        meta: waitTask.title || "等待用户反馈",
        waitTask,
      },
    ]);
  }

  function appendSystem(text: string) {
    setMessages((current) => [
      ...current,
      { id: `msg_${Date.now()}_system`, role: "system", text },
    ]);
  }

  return {
    messages,
    input,
    feedback,
    busyAction,
    setInput,
    setFeedback,
    resetMessages,
    sendMessage,
    submitWait,
  };
}

function runtimeResponseDetails(response: RuntimeResponse): Partial<ExperienceMessage> {
  const outputs = response.outputs || {};
  return {
    runId: response.run_id,
    status: response.status,
    conversationId: stringValue(response.conversation_id || outputs.conversation_id),
    knowledge: knowledgeRecords(response.knowledge || outputs.knowledge),
    usage: usageRecord(response.usage || outputs.usage),
  };
}

function knowledgeRecords(value: unknown): RetrieveRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => item && typeof item === "object" ? item as RetrieveRecord : null)
    .filter((item): item is RetrieveRecord => !!item && typeof item.content === "string");
}

function usageRecord(value: unknown): RuntimeUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    prompt_tokens: numberValue(record.prompt_tokens),
    completion_tokens: numberValue(record.completion_tokens),
    total_tokens: numberValue(record.total_tokens),
  };
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: Record<string, any>) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || "";
    for (const part of parts) {
      const parsed = parseSseEvent(part);
      if (parsed) onEvent(parsed.event, parsed.data);
    }
  }
  if (buffer.trim()) {
    const parsed = parseSseEvent(buffer);
    if (parsed) onEvent(parsed.event, parsed.data);
  }
}

function parseSseEvent(block: string) {
  const lines = block.split(/\r?\n/);
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
  const dataText = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!dataText) return null;
  try {
    return { event, data: JSON.parse(dataText) as Record<string, any> };
  } catch {
    return { event, data: { text: dataText } };
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
