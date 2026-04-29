import { useMemo, useState } from "react";
import type { RunRecord, TraceRecord } from "../types";

type ConsoleCall = <T>(
  path: string,
  init?: RequestInit,
  runtime?: boolean,
) => Promise<T>;

export function useRunObservabilityPage({
  call,
  setStatus,
}: {
  call: ConsoleCall;
  setStatus: (value: string) => void;
}) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRun = useMemo(
    () => runs.find((item) => item.runId === selectedRunId),
    [runs, selectedRunId],
  );

  async function refreshRuns(appId?: string) {
    setLoading(true);
    setError("");
    try {
      const queryString = appId ? `?appId=${encodeURIComponent(appId)}` : "";
      const nextRuns = await call<RunRecord[]>(
        `/api/aio/admin/runs${queryString}`,
      );
      setRuns(nextRuns);
      setSelectedRunId((current) =>
        nextRuns.some((run) => run.runId === current)
          ? current
          : nextRuns[0]?.runId || "",
      );
      if (!nextRuns.length) setTraces([]);
      setStatus(appId ? "应用运行记录已同步" : "全局运行记录已同步");
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "运行记录加载失败";
      setError(message);
      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRunTraces(runId: string) {
    setTracesLoading(true);
    try {
      const nextTraces = await call<TraceRecord[]>(
        `/api/aio/admin/runs/${encodeURIComponent(runId)}/traces`,
      );
      setTraces(nextTraces);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Trace 加载失败");
    } finally {
      setTracesLoading(false);
    }
  }

  return {
    runs,
    traces,
    selectedRun,
    selectedRunId,
    loading,
    tracesLoading,
    error,
    refreshRuns,
    loadRunTraces,
    selectRun: setSelectedRunId,
  };
}
