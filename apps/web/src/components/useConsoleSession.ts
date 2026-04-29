import { useState } from "react";
import {
  clearStoredConsoleSession,
  readStoredConsoleSession,
  safeJsonParse,
} from "../consoleUtils";
import type { AuthSession } from "../types";

export function useConsoleSession({
  setStatus,
  onLogout,
  onSwitchWorkspace,
}: {
  setStatus: (value: string) => void;
  onLogout: () => void;
  onSwitchWorkspace: (session: AuthSession) => void;
}) {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    readStoredConsoleSession(),
  );
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function loginConsole() {
    setBusyAction("login");
    setLoginError("");
    try {
      const response = await fetch("/api/aio/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      const text = await response.text();
      const body = text ? safeJsonParse(text) : null;
      if (!response.ok) throw new Error(body?.message || "用户名或密码错误");
      const session = body as AuthSession;
      localStorage.setItem("aio.consoleSession", JSON.stringify(session));
      setAuthSession(session);
      setLoginPassword("");
      setStatus("控制台已登录");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusyAction("");
    }
  }

  function clearSession() {
    clearStoredConsoleSession();
    setAuthSession(null);
  }

  function logoutConsole() {
    clearSession();
    onLogout();
    setStatus("已退出登录");
  }

  async function switchWorkspace(workspaceId: string) {
    if (!authSession || workspaceId === authSession.workspaceId) return;
    setBusyAction("switch-workspace");
    try {
      const response = await fetch("/api/aio/auth/switch-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession.token}`,
        },
        body: JSON.stringify({ workspaceId }),
      });
      const text = await response.text();
      const body = text ? safeJsonParse(text) : null;
      if (!response.ok) throw new Error(body?.message || "工作空间切换失败");
      const session = body as AuthSession;
      localStorage.setItem("aio.consoleSession", JSON.stringify(session));
      setAuthSession(session);
      onSwitchWorkspace(session);
      setStatus(`已切换到工作空间 ${session.workspaceId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "工作空间切换失败");
    } finally {
      setBusyAction("");
    }
  }

  return {
    authSession,
    loginUsername,
    loginPassword,
    loginError,
    busyAction,
    setLoginUsername,
    setLoginPassword,
    clearSession,
    loginConsole,
    logoutConsole,
    switchWorkspace,
  };
}
