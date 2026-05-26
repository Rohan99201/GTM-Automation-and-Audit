// lib/gtmClient.js – client-safe helpers (no Node/server imports)

export function parseDataLayerDoc(rows) {
  const events = {};
  rows.forEach((row) => {
    const [eventName, varName, varType, scope, desc] = row.map((c) => String(c || "").trim());
    if (!eventName || eventName.toLowerCase() === "event name") return;
    if (!events[eventName]) events[eventName] = { eventName, variables: [] };
    if (varName) events[eventName].variables.push({ varName, varType: varType || "dataLayer", scope: scope || "hit", desc });
  });
  return Object.values(events);
}

export function buildPayloadsFromEvent(event) {
  const { eventName, variables } = event;
  const payloads = { triggers: [], variables: [] };

  payloads.triggers.push({
    name: `CE - ${eventName}`,
    type: "customEvent",
    customEventFilter: [{ type: "equals", parameter: [{ type: "template", key: "arg0", value: "{{_event}}" }, { type: "template", key: "arg1", value: eventName }] }],
  });

  variables.forEach((v) => {
    if (["dataLayer", "dlv"].includes(v.varType)) {
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
