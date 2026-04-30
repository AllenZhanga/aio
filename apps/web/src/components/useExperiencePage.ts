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
      await sendStreamingMessage(path, prompt, selectedApp.type);
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
            ...runtimeResponseDetails({ run_id: run.run_id, status: run.status, outputs: run.outputs } as RuntimeResponse),
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
        ? runtimeResponseText(response) || runtimeOutputText(response.outputs, response.status)
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

  async function sendStreamingMessage(path: string, prompt: string, type: AppKind) {
    const assistantId = `msg_${Date.now()}_assistant_stream`;
    let streamedText = "";
    let completed = false;
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
      body: JSON.stringify(
        type === "agent"
          ? { query: prompt, stream: true }
          : {
              inputs: {
                question: prompt,
                operator_id: authSession?.userId || "console-user",
              },
              response_mode: "streaming",
            },
      ),
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
      appendRuntimeResponse(payload, type);
      setStatus("AI 应用体验完成");
      return;
    }
    await readSseStream(response.body, (event, data) => {
      if (event === "run_started") {
        updateMessage(assistantId, { meta: "流式响应 · 已开始", streaming: true });
      }
      if (isStreamingTextEvent(event)) {
        const delta = stringValue(data.delta || data.chunk);
        const fullText = stringValue(data.answer || data.content || data.text);
        streamedText = delta ? `${streamedText}${delta}` : (fullText || streamedText);
        updateMessage(assistantId, {
          text: streamedText || "正在生成...",
          meta: "流式响应 · 生成中",
          streaming: true,
          ...runtimeResponseDetails(data as RuntimeResponse),
        });
      }
      if (isCompletedEvent(event)) {
        completed = true;
        const payload = data as RuntimeResponse;
        if (payload.status === "waiting" && payload.wait_task) {
          setMessages((current) => current.filter((message) => message.id !== assistantId));
          appendWait(payload.wait_task);
          setStatus("AI 应用正在等待用户反馈");
          return;
        }
        const answer =
          type === "agent"
            ? runtimeResponseText(payload) || streamedText
            : runtimeOutputText(payload.outputs, payload.status) || streamedText;
        const responseDetails = runtimeResponseDetails(data as RuntimeResponse);
        updateMessage(assistantId, {
          text: answer || "已完成。",
          meta: `run ${stringValue(data.run_id)} · ${stringValue(data.status)}`,
          streaming: false,
          ...responseDetails,
        });
      }
      if (event === "error") {
        completed = true;
        updateMessage(assistantId, {
          text: stringValue(data.message) || "流式响应失败",
          meta: "error",
          streaming: false,
        });
      }
    });
    if (!completed) {
      updateMessage(assistantId, {
        text: streamedText || "已完成。",
        meta: "流式响应 · 已结束",
        streaming: false,
      });
    }
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
  const outputs = objectValue(response.outputs);
  return {
    runId: stringValue(response.run_id || outputs.run_id || outputs.runId) || undefined,
    status: stringValue(response.status || outputs.status) || undefined,
    conversationId: stringValue(response.conversation_id || outputs.conversation_id || outputs.conversationId) || undefined,
    knowledge: knowledgeRecords(response.knowledge || outputs.knowledge || outputs.references || outputs.citations),
    usage: usageRecord(response.usage || outputs.usage || outputs.token_usage || outputs.tokenUsage),
  };
}

function runtimeResponseText(response: RuntimeResponse) {
  const outputs = objectValue(response.outputs);
  return stringValue(response.answer || outputs.answer || outputs.text || outputs.output || outputs.result);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function knowledgeRecords(value: unknown): RetrieveRecord[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).records)
      ? (value as Record<string, unknown>).records
      : [];
  if (!Array.isArray(records)) return [];
  const normalized: Array<RetrieveRecord | null> = records
    .map((item): RetrieveRecord | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const content = stringValue(record.content || record.text || record.chunk);
      if (!content) return null;
      return {
        chunk_id: stringValue(record.chunk_id || record.chunkId || record.id) || "chunk",
        document_id: stringValue(record.document_id || record.documentId || record.doc_id || record.docId) || "document",
        content,
        score: numberValue(record.score) ?? 0,
        metadata: typeof record.metadata === "string" ? record.metadata : JSON.stringify(record.metadata || {}),
      } satisfies RetrieveRecord;
    });
  return normalized.filter((item): item is RetrieveRecord => !!item);
}

function usageRecord(value: unknown): RuntimeUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const usage = {
    prompt_tokens: numberValue(record.prompt_tokens ?? record.promptTokens ?? record.input_tokens ?? record.inputTokens),
    completion_tokens: numberValue(record.completion_tokens ?? record.completionTokens ?? record.output_tokens ?? record.outputTokens),
    total_tokens: numberValue(record.total_tokens ?? record.totalTokens),
  };
  if (usage.total_tokens === undefined && (usage.prompt_tokens !== undefined || usage.completion_tokens !== undefined)) {
    usage.total_tokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  }
  return usage.prompt_tokens === undefined && usage.completion_tokens === undefined && usage.total_tokens === undefined
    ? undefined
    : usage;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isStreamingTextEvent(event: string) {
  return ["message", "delta", "message_delta", "chunk", "answer"].includes(event);
}

function isCompletedEvent(event: string) {
  return ["run_completed", "completed", "message_end", "done"].includes(event);
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
  if (dataText === "[DONE]") return { event: "done", data: {} };
  try {
    return { event, data: JSON.parse(dataText) as Record<string, any> };
  } catch {
    return { event, data: { text: dataText } };
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}
