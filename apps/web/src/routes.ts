import type { AppRecord, RouteState } from "./types";

export function parseRoute(): RouteState {
  const hash = window.location.hash.replace(/^#/, "") || "/apps";
  if (hash === "/knowledge") return { view: "knowledge" };
  if (hash === "/tasks") return { view: "tasks" };
  if (hash === "/providers") return { view: "providers" };
  if (hash === "/api-keys") return { view: "apiKeys" };
  if (hash === "/org") return { view: "org" };
  if (hash === "/observability/runs") return { view: "observability" };

  const experienceMatch = hash.match(/^\/apps\/([^/]+)\/experience$/);
  if (experienceMatch?.[1]) {
    return { view: "experience", appId: decodeURIComponent(experienceMatch[1]) };
  }

  const apiMatch = hash.match(/^\/apps\/([^/]+)\/api$/);
  if (apiMatch?.[1]) return { view: "api", appId: decodeURIComponent(apiMatch[1]) };

  const runsMatch = hash.match(/^\/apps\/([^/]+)\/runs$/);
  if (runsMatch?.[1]) {
    return { view: "observability", appId: decodeURIComponent(runsMatch[1]) };
  }

  const match = hash.match(/^\/apps\/([^/]+)/);
  if (match?.[1]) return { view: "designer", appId: decodeURIComponent(match[1]) };

  return { view: "center" };
}

export function navigateCenter() {
  navigateHash("#/apps");
}

export function navigateDesigner(app: AppRecord) {
  const segment = app.type === "workflow" ? "workflow" : "agent";
  navigateHash(`#/apps/${encodeURIComponent(app.id)}/${segment}`);
}

export function navigateApiDocs(app: AppRecord) {
  navigateHash(`#/apps/${encodeURIComponent(app.id)}/api`);
}

export function navigateExperience(app: AppRecord) {
  navigateHash(`#/apps/${encodeURIComponent(app.id)}/experience`);
}

export function navigateObservability(app?: AppRecord) {
  navigateHash(app ? `#/apps/${encodeURIComponent(app.id)}/runs` : "#/observability/runs");
}

export function navigateKnowledge() {
  navigateHash("#/knowledge");
}

export function navigateProviders() {
  navigateHash("#/providers");
}

export function navigateTasks() {
  navigateHash("#/tasks");
}

export function navigateApiKeys() {
  navigateHash("#/api-keys");
}

export function navigateOrg() {
  navigateHash("#/org");
}

function navigateHash(nextHash: string) {
  if (window.location.hash !== nextHash) window.location.hash = nextHash;
}
