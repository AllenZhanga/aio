import React from "react";
import { createRoot } from "react-dom/client";
import { Activity, Boxes, CheckCircle2, KeyRound, Network, ShieldCheck } from "lucide-react";
import "./styles.css";

const stats = [
  { label: "Apps", value: "0", note: "Ready for Agent and Workflow setup" },
  { label: "Runs", value: "0", note: "Trace pipeline will land in Phase 1" },
  { label: "Tenants", value: "1", note: "Private mode defaults to one tenant" }
];

const foundations = [
  { icon: ShieldCheck, title: "Tenant Guardrails", text: "Every runtime path will resolve tenant and workspace context before data access." },
  { icon: KeyRound, title: "API Key Scope", text: "Keys bind to tenants first, then optionally to workspaces and published apps." },
  { icon: Network, title: "Single Runtime", text: "API, console assets, runtime, workers, and migrations ship as one image." },
  { icon: Boxes, title: "Embedded Stack", text: "Postgres, Redis, MinIO, and Qdrant stay internal for the default Docker profile." }
];

function App() {
  return (
    <main className="shell">
      <aside className="rail" aria-label="Primary">
        <div className="mark">A</div>
        <button className="railButton active" aria-label="Dashboard"><Activity size={20} /></button>
        <button className="railButton" aria-label="Security"><ShieldCheck size={20} /></button>
        <button className="railButton" aria-label="Keys"><KeyRound size={20} /></button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Aio Console</p>
            <h1>Operational base for agent workflows</h1>
          </div>
          <div className="statusPill">
            <CheckCircle2 size={18} />
            Phase 0
          </div>
        </header>

        <section className="metrics" aria-label="Workspace metrics">
          {stats.map((stat) => (
            <article className="metric" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.note}</p>
            </article>
          ))}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <p className="eyebrow">Foundation</p>
            <h2>Security and deployment primitives</h2>
          </div>
          <div className="foundationGrid">
            {foundations.map((item) => (
              <article className="foundation" key={item.title}>
                <item.icon size={22} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
