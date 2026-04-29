import { useState } from "react";
import type { WaitTaskRecord } from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

export function useTaskCenterPage({
  call,
  setStatus,
  refreshRuns,
}: {
  call: ConsoleCall;
  setStatus: (value: string) => void;
  refreshRuns: () => Promise<void>;
}) {
  const [tasks, setTasks] = useState<WaitTaskRecord[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function refreshTasks() {
    setLoading(true);
    setError("");
    try {
      const queryString =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const nextTasks = await call<WaitTaskRecord[]>(
        `/api/aio/admin/wait-tasks${queryString}`,
      );
      setTasks(nextTasks);
      setStatus("流程等待已同步");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "任务中心加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function submitTask(task: WaitTaskRecord, action = "approve") {
    setBusyAction(`wait-${task.id}`);
    try {
      await call(`/api/aio/admin/wait-tasks/${task.id}/submit`, {
        method: "POST",
        headers: { "Idempotency-Key": `console-${task.id}-${Date.now()}` },
        body: JSON.stringify({ action, comment: "流程等待工作台处理" }),
      });
      setStatus(`等待任务已${action === "reject" ? "拒绝" : "提交"}`);
      await refreshTasks();
      await refreshRuns();
    } catch (nextError) {
      setStatus(nextError instanceof Error ? nextError.message : "任务提交失败");
    } finally {
      setBusyAction("");
    }
  }

  return {
    tasks,
    loading,
    error,
    filter,
    busyAction,
    setFilter,
    refreshTasks,
    submitTask,
  };
}
