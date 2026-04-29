import type { AuthSession } from "./types";

export function runtimeOutputText(
  outputs?: Record<string, unknown>,
  status = "success",
) {
  if (!outputs || !Object.keys(outputs).length) {
    return status === "success" ? "流程已完成。" : `运行状态：${status}`;
  }
  const answer = outputs.answer;
  if (typeof answer === "string" && answer.trim()) return answer;
  const text =
    outputs.outputs || outputs.text || outputs.output || outputs.result;
  if (typeof text === "string" && text.trim()) return text;
  return JSON.stringify(outputs, null, 2);
}

export function readStoredConsoleSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem("aio.consoleSession");
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || session.expiresAt * 1000 < Date.now()) {
      clearStoredConsoleSession();
      return null;
    }
    return session;
  } catch {
    clearStoredConsoleSession();
    return null;
  }
}

export function clearStoredConsoleSession() {
  localStorage.removeItem("aio.consoleSession");
}

export function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
