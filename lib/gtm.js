// lib/gtm.js  – thin wrapper around GTM REST API v2
const BASE = "https://www.googleapis.com/tagmanager/v2";

async function gtmFetch(accessToken, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `GTM API error ${res.status}`);
  return json;
}

// ── Accounts & Containers ──────────────────────────────────────────────────
export const listAccounts = (token) => gtmFetch(token, "/accounts");

export const listContainers = (token, accountId) =>
  gtmFetch(token, `/accounts/${accountId}/containers`);

export const listWorkspaces = (token, accountId, containerId) =>
  gtmFetch(token, `/accounts/${accountId}/containers/${containerId}/workspaces`);

// ── Audit reads ────────────────────────────────────────────────────────────
export const listTags = (token, path) => gtmFetch(token, `/${path}/tags`);
export const listTriggers = (token, path) => gtmFetch(token, `/${path}/triggers`);
export const listVariables = (token, path) => gtmFetch(token, `/${path}/variables`);
export const listBuiltinVariables = (token, path) =>
  gtmFetch(token, `/${path}/built_in_variables`);

// ── Create helpers ─────────────────────────────────────────────────────────
export const createTag = (token, path, body) =>
  gtmFetch(token, `/${path}/tags`, { method: "POST", body: JSON.stringify(body) });

export const createTrigger = (token, path, body) =>
  gtmFetch(token, `/${path}/triggers`, { method: "POST", body: JSON.stringify(body) });

export const createVariable = (token, path, body) =>
  gtmFetch(token, `/${path}/variables`, { method: "POST", body: JSON.stringify(body) });

// ── Google Tag (gtag_config) ───────────────────────────────────────────────
export const listGtagConfigs = (token, path) =>
  gtmFetch(token, `/${path}/gtag_config`);

export const createGtagConfig = (token, path, body) =>
  gtmFetch(token, `/${path}/gtag_config`, { method: "POST", body: JSON.stringify(body) });

// ── Workspace path helper ──────────────────────────────────────────────────
export function wsPath(accountId, containerId, workspaceId) {
  return `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`;
}

// ── Audit engine ───────────────────────────────────────────────────────────
export async function runAudit(token, accountId, containerId, workspaceId) {
  const path = wsPath(accountId, containerId, workspaceId);
  const [tagsRes, triggersRes, variablesRes, builtinsRes] = await Promise.all([
    listTags(token, path),
    listTriggers(token, path),
    listVariables(token, path),
    listBuiltinVariables(token, path),
  ]);

  const tags = tagsRes.tag || [];
  const triggers = triggersRes.trigger || [];
  const variables = variablesRes.variable || [];
  const builtins = builtinsRes.builtInVariable || [];

  const issues = [];
  const usedTriggerIds = new Set();
  const usedVariableNames = new Set();

  // Collect used trigger IDs and variable refs from tags
  tags.forEach((tag) => {
    (tag.firingTriggerId || []).forEach((id) => usedTriggerIds.add(id));
    (tag.blockingTriggerId || []).forEach((id) => usedTriggerIds.add(id));
    // Scan parameter values for variable references {{…}}
    const paramStr = JSON.stringify(tag.parameter || []);
    const varRefs = paramStr.match(/{{([^}]+)}}/g) || [];
    varRefs.forEach((v) => usedVariableNames.add(v.replace(/{{|}}/g, "")));
  });

  // Collect variable refs used inside trigger conditions
  triggers.forEach((tr) => {
    const condStr = JSON.stringify(tr.filter || []);
    const varRefs = condStr.match(/{{([^}]+)}}/g) || [];
    varRefs.forEach((v) => usedVariableNames.add(v.replace(/{{|}}/g, "")));
  });

  // ── Tag checks ─────────────────────────────────────────────────────────
  tags.forEach((tag) => {
    if (!tag.firingTriggerId?.length) {
      issues.push({ severity: "error", entity: "Tag", name: tag.name, msg: "No firing trigger assigned" });
    }
    if (tag.paused) {
      issues.push({ severity: "warn", entity: "Tag", name: tag.name, msg: "Tag is paused" });
    }
    if (!tag.parameter?.length) {
      issues.push({ severity: "warn", entity: "Tag", name: tag.name, msg: "Tag has no parameters configured" });
    }
  });

  // ── Trigger checks ─────────────────────────────────────────────────────
  triggers.forEach((tr) => {
    if (!usedTriggerIds.has(tr.triggerId)) {
      issues.push({ severity: "warn", entity: "Trigger", name: tr.name, msg: "Trigger is not used by any tag" });
    }
  });

  // ── Variable checks ────────────────────────────────────────────────────
  variables.forEach((v) => {
    if (!usedVariableNames.has(v.name)) {
      issues.push({ severity: "info", entity: "Variable", name: v.name, msg: "Variable is defined but never referenced" });
    }
  });

  // ── Duplicate name checks ──────────────────────────────────────────────
  const tagNames = tags.map((t) => t.name);
  const dupTags = tagNames.filter((n, i) => tagNames.indexOf(n) !== i);
  dupTags.forEach((n) => issues.push({ severity: "error", entity: "Tag", name: n, msg: "Duplicate tag name detected" }));

  return {
    summary: { tags: tags.length, triggers: triggers.length, variables: variables.length, builtins: builtins.length, issues: issues.length },
    tags, triggers, variables, builtins, issues,
  };
}

// ── DataLayer doc parser ───────────────────────────────────────────────────
// Expects rows: [eventName, variableName, variableType, scope, description]
export function parseDataLayerDoc(rows) {
  const events = {};
  rows.forEach((row) => {
    const [eventName, varName, varType, scope, desc] = row.map((c) => String(c || "").trim());
    if (!eventName || eventName === "Event Name") return; // skip header
    if (!events[eventName]) events[eventName] = { eventName, variables: [] };
    if (varName) events[eventName].variables.push({ varName, varType: varType || "dataLayer", scope: scope || "hit", desc });
  });
  return Object.values(events);
}

// ── Build GTM payloads from datalayer event ────────────────────────────────
export function buildPayloadsFromEvent(event, customEventTriggerId) {
  const { eventName, variables } = event;
  const payloads = { triggers: [], variables: [], tags: [] };

  // Custom Event Trigger for this event
  payloads.triggers.push({
    name: `CE - ${eventName}`,
    type: "customEvent",
    customEventFilter: [{ type: "equals", parameter: [{ type: "template", key: "arg0", value: "{{_event}}" }, { type: "template", key: "arg1", value: eventName }] }],
  });

  // Variables
  variables.forEach((v) => {
    if (v.varType === "dataLayer" || v.varType === "dlv") {
      payloads.variables.push({
        name: `DLV - ${v.varName}`,
        type: "v",
        parameter: [
          { type: "integer", key: "dataLayerVersion", value: "2" },
          { type: "boolean", key: "setDefaultValue", value: "false" },
          { type: "template", key: "name", value: v.varName },
        ],
      });
    }
  });

  return payloads;
}