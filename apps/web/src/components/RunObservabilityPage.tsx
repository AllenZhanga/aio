import { AlertCircle, ArrowLeft, Loader2, Play, RefreshCw, Settings2, Workflow } from "lucide-react";
import type { AppRecord, RunRecord, TraceRecord } from "../types";
import { CodeBlock, StatePanel } from "./ui";

export function RunObservabilityPage(props: {
  apps: AppRecord[];
  selectedApp?: AppRecord;
  selectedAppId: string;
  runs: RunRecord[];
  traces: TraceRecord[];
  selectedRun?: RunRecord;
  selectedRunId: string;
  loading: boolean;
  tracesLoading: boolean;
  error: string;
  refreshRuns: () => Promise<void>;
  selectRun: (runId: string) => void;
  openDesigner: (app: AppRecord) => void;
  openGlobal: () => void;
  back: () => void;
}) {
  const scopeTitle = props.selectedApp ? `${props.selectedApp.name} 运行观测` : "全局运行观测";
  const successCount = props.runs.filter((run) => run.status === "success").length;
  const waitingCount = props.runs.filter((run) => run.status === "waiting").length;
  const failedCount = props.runs.filter((run) => run.status === "failed").length;
  const avgLatency = props.runs.length
    ? Math.round(props.runs.reduce((sum, run) => sum + (run.latencyMs || 0), 0) / props.runs.length)
    : 0;
  const selectedAppRecord = props.selectedRun ? props.apps.find((app) => app.id === props.selectedRun?.appId) : undefined;

  return (
    <section className="workspacePane runObsPane">
      <div className="runObsHeader">
        <button className="backBtn" onClick={props.back}><ArrowLeft size={17} /> 应用中心</button>
        <div>
          <h1>{scopeTitle}</h1>
          <p>{props.selectedApp ? `仅查看 ${props.selectedApp.id} 的运行记录` : "跨应用查看最近运行、Trace、输入输出和错误原因"}</p>
        </div>
        <div className="designerActions">
          {props.selectedApp && <button className="ghostBtn" onClick={props.openGlobal}>全局运行</button>}
          <button className="ghostBtn" disabled={props.loading} onClick={() => void props.refreshRuns()}>
            {props.loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />} 刷新
          </button>
          {props.selectedApp && (
            <button className="primaryBtn" onClick={() => props.openDesigner(props.selectedApp!)}>
              <Settings2 size={16} /> 返回设计
            </button>
          )}
        </div>
      </div>
      {props.error && (
        <div className="errorBanner">
          <AlertCircle size={16} />
          <span>{props.error}</span>
          <button onClick={() => void props.refreshRuns()}>重试</button>
        </div>
      )}
      <div className="runStats">
        <article><span>Runs</span><strong>{props.runs.length}</strong><p>最近 50 条</p></article>
        <article><span>成功</span><strong>{successCount}</strong><p>成功完成</p></article>
        <article><span>等待</span><strong>{waitingCount}</strong><p>人工任务</p></article>
        <article><span>失败</span><strong>{failedCount}</strong><p>需排障</p></article>
        <article><span>平均耗时</span><strong>{avgLatency}ms</strong><p>端到端</p></article>
      </div>
      {props.loading && <StatePanel icon="loading" title="正在同步运行记录" text="正在读取当前空间的 Run、Trace 摘要和最近执行状态。" />}
      {!props.loading && !props.error && !props.runs.length && <StatePanel title="暂无运行记录" text="发布应用后在设计页试运行，或通过 API 调用应用，即可在这里看到 Run 和 Trace。" />}
      {!props.loading && props.runs.length > 0 && (
        <div className="runObsGrid">
          <aside className="runListPane designCard">
            <div className="sectionTitle">
              <Play size={18} />
              <div><h2>Run 列表</h2><p>按创建时间倒序</p></div>
            </div>
            <div className="runListStack">
              {props.runs.map((run) => (
                <button
                  key={run.runId}
                  className={`runListItem ${props.selectedRunId === run.runId ? "active" : ""}`}
                  onClick={() => props.selectRun(run.runId)}
                >
                  <div className="runListItemTop">
                    <strong>{run.appName}</strong>
                    <span className={`runStatus ${run.status}`}>{run.status}</span>
                  </div>
                  <code>{run.runId}</code>
                  <div className="runListItemMeta">
                    <span>{run.runType}</span>
                    <span>{formatDate(run.createdAt)} · {run.latencyMs ?? 0}ms</span>
                  </div>
                  <small>tokens {run.totalTokens ?? 0}</small>
                </button>
              ))}
            </div>
          </aside>
          <main className="runDetailPane">
            <section className="designCard">
              <div className="runDetailTop">
                <div>
                  <h2>{props.selectedRun?.appName || "未选择 Run"}</h2>
                  <p>{props.selectedRun?.runId} · {props.selectedRun?.runType} · version {props.selectedRun?.appVersionId || "-"}</p>
                </div>
                {props.selectedRun && <span className={`runStatus large ${props.selectedRun.status}`}>{props.selectedRun.status}</span>}
              </div>
              {props.selectedRun && (
                <div className="runMetaGrid">
                  <dl>
                    <dt>App ID</dt><dd>{props.selectedRun.appId}</dd>
                    <dt>Run Type</dt><dd>{props.selectedRun.runType}</dd>
                    <dt>Latency</dt><dd>{props.selectedRun.latencyMs ?? 0}ms</dd>
                    <dt>Tokens</dt><dd>{props.selectedRun.totalTokens ?? 0}</dd>
                    <dt>Wait Task</dt><dd>{props.selectedRun.currentWaitTaskId || "-"}</dd>
                    <dt>Created</dt><dd>{formatDate(props.selectedRun.createdAt)}</dd>
                  </dl>
                  {selectedAppRecord && (
                    <button className="ghostBtn" onClick={() => props.openDesigner(selectedAppRecord)}>
                      <Settings2 size={16} /> 打开应用设计
                    </button>
                  )}
                </div>
              )}
              {props.selectedRun?.errorMessage && <div className="warningBox"><AlertCircle size={16} /> {props.selectedRun.errorMessage}</div>}
              <div className="ioGrid">
                <CodeBlock title="Run Input" code={JSON.stringify(props.selectedRun?.input || {}, null, 2)} />
                <CodeBlock title="Run Output" code={JSON.stringify(props.selectedRun?.output || {}, null, 2)} />
              </div>
            </section>
            <section className="designCard">
              <div className="sectionTitle">
                <Workflow size={18} />
                <div><h2>Trace 时间线</h2><p>{props.tracesLoading ? "正在加载 Trace" : `${props.traces.length} 个步骤`}</p></div>
              </div>
              {props.tracesLoading && <StatePanel icon="loading" title="正在加载 Trace" text="正在读取节点、模型、工具或检索步骤。" />}
              {!props.tracesLoading && !props.traces.length && <StatePanel title="暂无 Trace" text="该 Run 尚未写入 Trace，或当前记录还在执行中。" />}
              {!props.tracesLoading && props.traces.map((trace, index) => (
                <article className="traceItem" key={trace.id}>
                  <div className="traceIndex">{index + 1}</div>
                  <div className="traceBody">
                    <div><strong>{trace.name}</strong><span className={`runStatus ${trace.status}`}>{trace.status}</span></div>
                    <p>{trace.type} · {trace.latencyMs ?? 0}ms · {formatDate(trace.createdAt)}</p>
                    {trace.errorMessage && <div className="warningBox"><AlertCircle size={16} /> {trace.errorMessage}</div>}
                    <div className="ioGrid compact">
                      <CodeBlock title="Input" code={JSON.stringify(trace.input || {}, null, 2)} />
                      <CodeBlock title="Output" code={JSON.stringify(trace.output || {}, null, 2)} />
                      {trace.token && Object.keys(trace.token).length > 0 && <CodeBlock title="Token / Usage" code={JSON.stringify(trace.token, null, 2)} />}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </main>
        </div>
      )}
    </section>
  );
}

function formatDate(value?: string) {
  if (!value) return "刚刚";
  try {
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}
