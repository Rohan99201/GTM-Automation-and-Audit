"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { parseDataLayerDoc } from "../../lib/gtmClient";

export default function CreateView({ accountId, containerId, workspaceId }) {
  const [mode, setMode] = useState("manual");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function post(body) {
    const r = await fetch("/api/gtm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, accountId, containerId, workspaceId }),
    });
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  async function gtmGet(params) {
    const qs = new URLSearchParams({ ...params, accountId, containerId, workspaceId }).toString();
    const r = await fetch(`/api/gtm?${qs}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${mode === "manual" ? "active" : ""}`}
          onClick={() => { setMode("manual"); setResult(null); setError(""); }}>
          ✏️ Manual Create
        </button>
        <button className={`tab-btn ${mode === "datalayer" ? "active" : ""}`}
          onClick={() => { setMode("datalayer"); setResult(null); setError(""); }}>
          📄 DataLayer Doc Upload
        </button>
      </div>

      {error  && <div className="alert alert-error">⚠ {error}</div>}
      {result && <ResultPanel result={result} />}

      {mode === "manual"    && <ManualCreate  post={post} gtmGet={gtmGet} setResult={setResult} setError={setError} setLoading={setLoading} loading={loading} />}
      {mode === "datalayer" && <DataLayerUpload post={post} setResult={setResult} setError={setError} setLoading={setLoading} loading={loading} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL CREATE
// ─────────────────────────────────────────────────────────────────────────────
function ManualCreate({ post, gtmGet, setResult, setError, setLoading, loading }) {
  const [entityType, setEntityType] = useState("tag");

  // ── Tag state ──────────────────────────────────────────────────────────────
  const [tagName,      setTagName]      = useState("");
  const [tagType,      setTagType]      = useState("gaawe");
  const [tagNotes,     setTagNotes]     = useState("");
  const [firingOption, setFiringOption] = useState("unlimited");

  // GA4
  const [measurementId,  setMeasurementId]  = useState("");
  const [ga4EventName,   setGa4EventName]   = useState("");
  const [sendEcommerce,  setSendEcommerce]  = useState(false);
  const [eventParams,    setEventParams]    = useState([{ name: "", value: "" }]);

  // UA
  const [trackingId, setTrackingId] = useState("");
  const [trackType,  setTrackType]  = useState("TRACK_EVENT");

  // Custom HTML
  const [htmlContent, setHtmlContent] = useState("");

  // Consent
  const [consentStatus, setConsentStatus] = useState("notSet");
  const [consentTypes,  setConsentTypes]  = useState("");

  // ── Trigger section state ──────────────────────────────────────────────────
  const [availableTriggers,  setAvailableTriggers]  = useState([]);
  const [triggersLoading,    setTriggersLoading]    = useState(false);
  const [selectedTriggerIds, setSelectedTriggerIds] = useState([]);
  // "existing" | "new"
  const [triggerMode, setTriggerMode] = useState("existing");
  // inline new trigger fields
  const [newTrigType,      setNewTrigType]      = useState("customEvent");
  const [newTrigName,      setNewTrigName]       = useState("");
  const [newTrigEventName, setNewTrigEventName]  = useState("");

  // ── Google Tag (gtag_config) state ────────────────────────────────────────
  const [gtagType,     setGtagType]     = useState("googtag");
  const [gtagConfigId, setGtagConfigId] = useState("");   // e.g. G-XXXXXXXX or AW-XXXXXXXX
  const [gtagParams,   setGtagParams]   = useState([{ key: "", value: "" }]);

  // ── Trigger state (standalone) ────────────────────────────────────────────
  const [trigName,      setTrigName]      = useState("");
  const [trigType,      setTrigType]      = useState("customEvent");
  const [trigEventName, setTrigEventName] = useState("");

  // ── Variable state ────────────────────────────────────────────────────────
  const [varName, setVarName] = useState("");
  const [varType, setVarType] = useState("v");
  const [dlvKey,  setDlvKey]  = useState("");

  // Load existing triggers on mount / entity switch
  useEffect(() => {
    if (entityType === "tag") {
      setTriggersLoading(true);
      gtmGet({ action: "triggers" })
        .then((d) => setAvailableTriggers(d.trigger || []))
        .catch(() => {})
        .finally(() => setTriggersLoading(false));
    }
  }, [entityType]);

  function toggleTrigger(id) {
    setSelectedTriggerIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError(""); setResult(null); setLoading(true);
    try {
      // ── GOOGLE TAG ──────────────────────────────────────────────────────
      if (entityType === "googletag") {
        if (!gtagConfigId.trim()) throw new Error("Measurement ID is required");

        // gtagConfigId is auto-assigned by GTM — never sent in create.
        // The Measurement ID (G-XX / AW-XX) goes as a parameter.
        const measurementKey =
          gtagType === "awct" ? "conversionId"  :
          gtagType === "flc"  ? "advertiserId"  :
                                "measurementId";

        const parameter = [
          { type: "template", key: measurementKey, value: gtagConfigId.trim() },
          ...gtagParams
            .filter((p) => p.key && p.value)
            .map((p) => ({ type: "template", key: p.key, value: p.value })),
        ];
        // Validate every param has type (safety check)
        parameter.forEach((p, i) => { if (!p.type) throw new Error(`parameter[${i}] is missing a type`); });

        const d = await post({
          action: "createGtagConfig",
          payload: { type: gtagType, parameter },   // no gtagConfigId field
        });
        setResult({ type: "single", entity: "Google Tag Config", data: d });
        return;
      }

      // ── TAG ─────────────────────────────────────────────────────────────
      if (entityType === "tag") {
        if (!tagName) throw new Error("Tag name is required");
        let builtParams = [];

        if (tagType === "gaawe") {
          if (!measurementId) throw new Error("Measurement ID is required for GA4 tags");
          if (!ga4EventName)  throw new Error("Event Name is required for GA4 tags");
          builtParams = [
            { type: "template", key: "measurementIdOverride", value: measurementId },
            { type: "template", key: "eventName",             value: ga4EventName  },
          ];
          const validEP = eventParams.filter((p) => p.name && p.value);
          if (validEP.length) {
            builtParams.push({
              type: "list", key: "eventSettingsTable",
              list: validEP.map((p) => ({
                type: "map",
                map: [
                  { type: "template", key: "parameter",      value: p.name  },
                  { type: "template", key: "parameterValue", value: p.value },
                ],
              })),
            });
          }
          if (sendEcommerce) {
            builtParams.push({ type: "boolean",  key: "sendEcommerceData", value: "true" });
            builtParams.push({ type: "template", key: "ecommerceMacroData", value: "{{dlv - ecommerce}}" });
          }
        } else if (tagType === "ua") {
          if (!trackingId) throw new Error("Tracking ID is required for UA tags");
          builtParams = [
            { type: "template", key: "trackingId", value: trackingId },
            { type: "template", key: "trackType",  value: trackType  },
          ];
        } else if (tagType === "html") {
          if (!htmlContent) throw new Error("HTML content is required");
          builtParams = [
            { type: "template", key: "html",                 value: htmlContent },
            { type: "boolean",  key: "supportDocumentWrite", value: "false"     },
          ];
        }

        const consentSettings = { consentStatus };
        if (consentStatus === "needed" && consentTypes.trim()) {
          consentSettings.consentType = {
            type: "list",
            list: consentTypes.split(",").map((t) => ({
              type: "map",
              map: [{ type: "template", key: "consentType", value: t.trim() }],
            })),
          };
        }

        const tagPayload = {
          name: tagName, type: tagType,
          parameter: builtParams,
          tagFiringOption: firingOption,
          consentSettings,
          ...(tagNotes ? { notes: tagNotes } : {}),
          firingTriggerId: [...selectedTriggerIds],
        };

        // If user wants to create a new trigger inline, do that first
        if (triggerMode === "new") {
          if (!newTrigName) throw new Error("New trigger name is required");
          const trigPayload = {
            name: newTrigName, type: newTrigType,
            ...(newTrigType === "customEvent" && newTrigEventName
              ? { customEventFilter: [{ type: "equals", parameter: [
                  { type: "template", key: "arg0", value: "{{_event}}" },
                  { type: "template", key: "arg1", value: newTrigEventName },
                ]}] }
              : {}),
          };
          const d = await post({ action: "createTriggerThenTag", payload: { trigger: trigPayload, tag: tagPayload } });
          setResult({ type: "triggerAndTag", data: d });
        } else {
          const d = await post({ action: "createTag", payload: tagPayload });
          setResult({ type: "single", entity: "tag", data: d });
        }
        return;
      }

      // ── TRIGGER (standalone) ────────────────────────────────────────────
      if (entityType === "trigger") {
        if (!trigName) throw new Error("Trigger name is required");
        const payload = {
          name: trigName, type: trigType,
          ...(trigType === "customEvent" && trigEventName
            ? { customEventFilter: [{ type: "equals", parameter: [
                { type: "template", key: "arg0", value: "{{_event}}" },
                { type: "template", key: "arg1", value: trigEventName },
              ]}] }
            : {}),
        };
        const d = await post({ action: "createTrigger", payload });
        setResult({ type: "single", entity: "trigger", data: d });
        return;
      }

      // ── VARIABLE ────────────────────────────────────────────────────────
      if (!varName) throw new Error("Variable name is required");
      const payload = {
        name: varName, type: varType,
        parameter: varType === "v"
          ? [
              { type: "integer",  key: "dataLayerVersion", value: "2"     },
              { type: "boolean",  key: "setDefaultValue",  value: "false" },
              { type: "template", key: "name",             value: dlvKey  },
            ]
          : [],
      };
      const d = await post({ action: "createVariable", payload });
      setResult({ type: "single", entity: "variable", data: d });

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Live preview ───────────────────────────────────────────────────────────
  const previewPayload =
    entityType === "googletag"
      ? {
          type: gtagType,
          parameter: [
            { type: "template", key: gtagType === "awct" ? "conversionId" : "measurementId", value: gtagConfigId || "(required)" },
            ...gtagParams.filter((p) => p.key && p.value).map((p) => ({ type: "template", key: p.key, value: p.value })),
          ],
        }
      : entityType === "tag"
      ? {
          name: tagName, type: tagType,
          ...(tagType === "gaawe" ? { measurementIdOverride: measurementId, eventName: ga4EventName, eventSettingsTable: eventParams.filter((p) => p.name), sendEcommerceData: sendEcommerce } : {}),
          ...(tagType === "ua"   ? { trackingId, trackType } : {}),
          firingTriggerId: selectedTriggerIds,
          consentSettings: { consentStatus }, tagFiringOption: firingOption,
          ...(triggerMode === "new" ? { newTrigger: { name: newTrigName, type: newTrigType, eventName: newTrigEventName } } : {}),
        }
      : entityType === "trigger"
      ? { name: trigName, type: trigType, ...(trigType === "customEvent" ? { eventName: trigEventName } : {}) }
      : { name: varName, type: varType, ...(varType === "v" ? { dataLayerKey: dlvKey } : {}) };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div>
        {/* Entity type tabs */}
        <div className="card">
          <div className="card-title">📦 Entity Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { id: "tag",       icon: "🏷️",  label: "Tag"         },
              { id: "googletag", icon: "⚙️",  label: "Google Tag"  },
              { id: "trigger",   icon: "⚡",  label: "Trigger"     },
              { id: "variable",  icon: "📐",  label: "Variable"    },
            ].map(({ id, icon, label }) => (
              <button key={id}
                className={`btn ${entityType === id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setEntityType(id)}
                style={{ flexDirection: "column", gap: 4, padding: "10px 6px", fontSize: 12 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* ══ GOOGLE TAG CONFIG ══════════════════════════════════════════════ */}
        {entityType === "googletag" && (
          <div className="card">
            <div className="card-title">⚙️ Google Tag Configuration</div>

            <div className="alert alert-info" style={{ marginBottom: 16 }}>
              Google Tag configs link your container to GA4, Google Ads, or other Google products. Creates a <code>gtag_config</code> entity — not a Tag.
            </div>

            <div className="form-group">
              <label className="form-label">Config Type</label>
              <select className="form-select" value={gtagType} onChange={(e) => { setGtagType(e.target.value); setGtagConfigId(""); }}>
                <option value="googtag">Google Tag (googtag)</option>
                <option value="gaawc">GA4 Configuration (gaawc)</option>
                <option value="awct">Google Ads Conversion Tracking (awct)</option>
                <option value="flc">Floodlight Counter (flc)</option>
              </select>
            </div>

            {/* Measurement ID — sent as a parameter, NOT as gtagConfigId */}
            <div className="ga4-fields" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#003355", marginBottom: 10, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                ✦ MEASUREMENT ID (REQUIRED)
              </div>
              <div className="alert alert-info" style={{ marginBottom: 10, fontSize: 11 }}>
                This is sent as a <code>parameter</code> in the API — the numeric <code>gtagConfigId</code> is auto-assigned by GTM on creation.
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {gtagType === "googtag" && "Measurement ID *"}
                  {gtagType === "gaawc"   && "GA4 Measurement ID *"}
                  {gtagType === "awct"    && "Google Ads Conversion ID *"}
                  {gtagType === "flc"     && "Floodlight Advertiser ID *"}
                </label>
                <input
                  className="form-input"
                  value={gtagConfigId}
                  onChange={(e) => setGtagConfigId(e.target.value)}
                  placeholder={
                    gtagType === "googtag" ? "G-XXXXXXXXXX" :
                    gtagType === "gaawc"   ? "G-XXXXXXXXXX" :
                    gtagType === "awct"    ? "AW-XXXXXXXXXX" :
                                            "DC-XXXXXXXXXX"
                  }
                  style={{ background: "white" }}
                />
                <div className="section-hint" style={{ color: "#005580" }}>
                  {gtagType === "googtag" && "Sent as measurementId parameter — e.g. G-ABC123XYZ"}
                  {gtagType === "gaawc"   && "Sent as measurementId parameter — e.g. G-ABC123XYZ"}
                  {gtagType === "awct"    && "Sent as conversionId parameter — e.g. AW-123456789"}
                  {gtagType === "flc"     && "Sent as advertiserId parameter — e.g. DC-123456789"}
                </div>
              </div>
            </div>

            {/* Additional parameters */}
            <div className="form-group">
              <label className="form-label">Additional Parameters <span style={{ color: "var(--text2)", fontWeight: 400 }}>(optional)</span></label>
              <div style={{ fontSize: 11, color: "#005580", marginBottom: 10 }}>
                {gtagType === "googtag" && "e.g. send_page_view → true, cookie_domain → auto"}
                {gtagType === "gaawc"   && "e.g. send_page_view → true, cookie_expires → 63072000"}
                {gtagType === "awct"    && "e.g. conversion_label → XXXXXXXXXXX, conversion_value → {{Order Value}}"}
                {gtagType === "flc"     && "e.g. group_tag_string → my-group, counting_method → STANDARD"}
              </div>
              {gtagParams.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="form-input" value={p.key}
                    onChange={(e) => { const n = [...gtagParams]; n[i].key = e.target.value; setGtagParams(n); }}
                    placeholder="parameter key" style={{ flex: 1 }} />
                  <input className="form-input" value={p.value}
                    onChange={(e) => { const n = [...gtagParams]; n[i].value = e.target.value; setGtagParams(n); }}
                    placeholder="value" style={{ flex: 1 }} />
                  <button className="btn btn-secondary" style={{ padding: "0 10px", flexShrink: 0 }}
                    onClick={() => setGtagParams(gtagParams.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary" style={{ marginTop: 4 }}
                onClick={() => setGtagParams([...gtagParams, { key: "", value: "" }])}>
                + Add parameter
              </button>
            </div>
          </div>
        )}

        {/* ══ TAG ═══════════════════════════════════════════════════════════ */}
        {entityType === "tag" && (
          <>
            {/* Core tag fields */}
            <div className="card">
              <div className="card-title">🏷️ Tag Configuration</div>
              <div className="form-group">
                <label className="form-label">Tag Name *</label>
                <input className="form-input" value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="e.g. GA4 - Purchase Event" />
              </div>
              <div className="form-group">
                <label className="form-label">Tag Type</label>
                <select className="form-select" value={tagType} onChange={(e) => setTagType(e.target.value)}>
                  <option value="gaawe">GA4 Event</option>
                  <option value="ua">Universal Analytics</option>
                  <option value="html">Custom HTML</option>
                  <option value="img">Custom Image</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tag Firing Option</label>
                <select className="form-select" value={firingOption} onChange={(e) => setFiringOption(e.target.value)}>
                  <option value="unlimited">Unlimited</option>
                  <option value="oncePerEvent">Once Per Event</option>
                  <option value="oncePerLoad">Once Per Load</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={tagNotes} onChange={(e) => setTagNotes(e.target.value)} placeholder="Add a note for your team…" />
              </div>
            </div>

            {/* GA4 specific */}
            {tagType === "gaawe" && (
              <div className="card">
                <div className="card-title" style={{ color: "#003355" }}>✦ GA4 Event Settings</div>
                <div className="ga4-fields" style={{ marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Measurement ID *</label>
                    <input className="form-input" value={measurementId} onChange={(e) => setMeasurementId(e.target.value)} placeholder="G-XXXXXXXXXX or {{GA4 Measurement ID}}" />
                    <div className="section-hint">Your GA4 property ID or a GTM variable reference</div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Event Name *</label>
                    <input className="form-input" value={ga4EventName} onChange={(e) => setGa4EventName(e.target.value)} placeholder="e.g. purchase or {{Event}}" />
                    <div className="section-hint">Use {"{{Event}}"} to dynamically pass the datalayer event name</div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Event Parameters <span style={{ color: "var(--text2)", fontWeight: 400 }}>(sent as eventSettingsTable LIST)</span></label>
                  {eventParams.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input className="form-input" value={p.name}
                        onChange={(e) => { const n = [...eventParams]; n[i].name = e.target.value; setEventParams(n); }}
                        placeholder="parameter name e.g. transaction_id" style={{ flex: 1 }} />
                      <input className="form-input" value={p.value}
                        onChange={(e) => { const n = [...eventParams]; n[i].value = e.target.value; setEventParams(n); }}
                        placeholder="value or {{Variable}}" style={{ flex: 1 }} />
                      <button className="btn btn-secondary" style={{ padding: "0 10px", flexShrink: 0 }}
                        onClick={() => setEventParams(eventParams.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-secondary" onClick={() => setEventParams([...eventParams, { name: "", value: "" }])}>+ Add parameter</button>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", background: sendEcommerce ? "var(--highlight)" : "var(--bg)", border: "1.5px solid", borderColor: sendEcommerce ? "var(--highlight-border)" : "var(--border)", borderRadius: "var(--radius)", transition: "all 0.15s" }}>
                  <input type="checkbox" checked={sendEcommerce} onChange={(e) => setSendEcommerce(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent2)", cursor: "pointer" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: sendEcommerce ? "#003355" : "var(--text)" }}>Send Ecommerce Data</div>
                    <div style={{ fontSize: 11, color: sendEcommerce ? "#005588" : "var(--text2)" }}>Reads from dataLayer ecommerce object</div>
                  </div>
                </label>
              </div>
            )}

            {/* UA specific */}
            {tagType === "ua" && (
              <div className="card">
                <div className="card-title">✦ Universal Analytics Settings</div>
                <div className="ga4-fields">
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Tracking ID *</label>
                    <input className="form-input" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} placeholder="UA-XXXXXXXX-X" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Track Type</label>
                    <select className="form-select" value={trackType} onChange={(e) => setTrackType(e.target.value)} style={{ background: "white" }}>
                      <option value="TRACK_EVENT">Event</option>
                      <option value="TRACK_PAGEVIEW">Page View</option>
                      <option value="TRACK_TRANSACTION">Transaction</option>
                      <option value="TRACK_SOCIAL">Social</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Custom HTML */}
            {tagType === "html" && (
              <div className="card">
                <div className="card-title">✦ Custom HTML</div>
                <textarea className="form-textarea" value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)}
                  placeholder={"<script>\n  // your code here\n</script>"}
                  style={{ minHeight: 120, fontFamily: "var(--font-mono)", fontSize: 12 }} />
              </div>
            )}

            {/* ── TRIGGERS ─────────────────────────────────────────── */}
            <div className="card">
              <div className="card-title">⚡ Firing Triggers</div>

              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                {[
                  { val: "existing", label: "🔗 Use Existing Trigger" },
                  { val: "new",      label: "✨ Create New Trigger"   },
                ].map(({ val, label }) => (
                  <button key={val} onClick={() => setTriggerMode(val)}
                    style={{ flex: 1, padding: "9px 12px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: triggerMode === val ? 600 : 400, background: triggerMode === val ? "var(--highlight)" : "var(--surface)", color: triggerMode === val ? "#003355" : "var(--text2)", transition: "all 0.12s" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Existing triggers */}
              {triggerMode === "existing" && (
                <>
                  {triggersLoading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text2)", fontSize: 13 }}>
                      <span className="spinner" /> Loading triggers…
                    </div>
                  ) : availableTriggers.length === 0 ? (
                    <div style={{ color: "var(--text2)", fontSize: 13, padding: "12px 0" }}>
                      No triggers in this workspace yet. Switch to "Create New Trigger" above.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                      {availableTriggers.map((tr) => {
                        const sel = selectedTriggerIds.includes(tr.triggerId);
                        return (
                          <label key={tr.triggerId} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "9px 12px", background: sel ? "var(--highlight)" : "var(--bg)", border: "1.5px solid", borderColor: sel ? "var(--highlight-border)" : "var(--border)", borderRadius: "var(--radius)", transition: "all 0.12s" }}>
                            <input type="checkbox" checked={sel} onChange={() => toggleTrigger(tr.triggerId)} style={{ width: 15, height: 15, accentColor: "var(--accent2)", cursor: "pointer" }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: sel ? 500 : 400, color: sel ? "#003355" : "var(--text)" }}>{tr.name}</span>
                              <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: 10 }}>{tr.type}</span>
                            </div>
                            <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--font-mono)" }}>#{tr.triggerId}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {selectedTriggerIds.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--accent2)" }}>
                      ✓ {selectedTriggerIds.length} trigger{selectedTriggerIds.length > 1 ? "s" : ""} selected
                    </div>
                  )}
                </>
              )}

              {/* Create new trigger inline */}
              {triggerMode === "new" && (
                <div className="ga4-fields">
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#003355", marginBottom: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                    ✦ NEW TRIGGER — will be created &amp; linked automatically
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Trigger Name *</label>
                    <input className="form-input" value={newTrigName} onChange={(e) => setNewTrigName(e.target.value)} placeholder="e.g. CE - purchase" style={{ background: "white" }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: newTrigType === "customEvent" ? 12 : 0 }}>
                    <label className="form-label">Trigger Type</label>
                    <select className="form-select" value={newTrigType} onChange={(e) => setNewTrigType(e.target.value)} style={{ background: "white" }}>
                      <option value="customEvent">Custom Event</option>
                      <option value="pageview">Page View</option>
                      <option value="domReady">DOM Ready</option>
                      <option value="windowLoaded">Window Loaded</option>
                      <option value="click">All Clicks</option>
                      <option value="linkClick">Link Click</option>
                      <option value="formSubmit">Form Submission</option>
                      <option value="scrollDepth">Scroll Depth</option>
                      <option value="historyChange">History Change</option>
                    </select>
                  </div>
                  {newTrigType === "customEvent" && (
                    <div className="form-group" style={{ marginBottom: 0, marginTop: 12 }}>
                      <label className="form-label">DataLayer Event Name *</label>
                      <input className="form-input" value={newTrigEventName} onChange={(e) => setNewTrigEventName(e.target.value)} placeholder="e.g. purchase" style={{ background: "white" }} />
                      <div className="section-hint" style={{ color: "#005580" }}>Must exactly match the event name pushed to dataLayer</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Consent */}
            <div className="card">
              <div className="card-title">🔒 Consent Settings</div>
              <div className="form-group">
                <label className="form-label">Consent Status</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { val: "notSet",    label: "Not Set",    hint: "Default" },
                    { val: "notNeeded", label: "Not Needed", hint: "No check" },
                    { val: "needed",    label: "Needed",     hint: "Requires consent" },
                  ].map(({ val, label, hint }) => (
                    <button key={val} onClick={() => setConsentStatus(val)}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: "var(--radius)", border: "1.5px solid", borderColor: consentStatus === val ? "var(--highlight-border)" : "var(--border)", background: consentStatus === val ? "var(--highlight)" : "var(--surface)", cursor: "pointer" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: consentStatus === val ? "#003355" : "var(--text)" }}>{label}</div>
                      <div style={{ fontSize: 10, color: consentStatus === val ? "#005580" : "var(--text2)", marginTop: 2 }}>{hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              {consentStatus === "needed" && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Consent Types (comma-separated)</label>
                  <input className="form-input" value={consentTypes} onChange={(e) => setConsentTypes(e.target.value)} placeholder="ad_storage, analytics_storage" />
                  <div className="section-hint">Standard: ad_storage, analytics_storage, ad_personalization, ad_user_data</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ STANDALONE TRIGGER ════════════════════════════════════════════ */}
        {entityType === "trigger" && (
          <div className="card">
            <div className="card-title">⚡ Trigger Configuration</div>
            <div className="form-group">
              <label className="form-label">Trigger Name *</label>
              <input className="form-input" value={trigName} onChange={(e) => setTrigName(e.target.value)} placeholder="e.g. CE - purchase" />
            </div>
            <div className="form-group">
              <label className="form-label">Trigger Type</label>
              <select className="form-select" value={trigType} onChange={(e) => setTrigType(e.target.value)}>
                <option value="customEvent">Custom Event</option>
                <option value="pageview">Page View</option>
                <option value="domReady">DOM Ready</option>
                <option value="windowLoaded">Window Loaded</option>
                <option value="click">All Clicks</option>
                <option value="linkClick">Link Click</option>
                <option value="formSubmit">Form Submission</option>
                <option value="scrollDepth">Scroll Depth</option>
                <option value="historyChange">History Change</option>
                <option value="jsError">JavaScript Error</option>
                <option value="timer">Timer</option>
              </select>
            </div>
            {trigType === "customEvent" && (
              <div className="ga4-fields">
                <div style={{ fontSize: 11, fontWeight: 600, color: "#003355", marginBottom: 10, fontFamily: "var(--font-mono)" }}>✦ CUSTOM EVENT SETTINGS</div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">DataLayer Event Name *</label>
                  <input className="form-input" value={trigEventName} onChange={(e) => setTrigEventName(e.target.value)} placeholder="e.g. purchase" />
                  <div className="section-hint">Must match the event pushed to dataLayer exactly</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ VARIABLE ══════════════════════════════════════════════════════ */}
        {entityType === "variable" && (
          <div className="card">
            <div className="card-title">📐 Variable Configuration</div>
            <div className="form-group">
              <label className="form-label">Variable Name *</label>
              <input className="form-input" value={varName} onChange={(e) => setVarName(e.target.value)} placeholder="e.g. DLV - transaction_id" />
            </div>
            <div className="form-group">
              <label className="form-label">Variable Type</label>
              <select className="form-select" value={varType} onChange={(e) => setVarType(e.target.value)}>
                <option value="v">Data Layer Variable (DLV)</option>
                <option value="k">1st Party Cookie</option>
                <option value="jsm">JavaScript Variable</option>
                <option value="u">URL</option>
                <option value="e">Auto-Event Variable</option>
              </select>
            </div>
            {varType === "v" && (
              <div className="ga4-fields">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">DataLayer Key Name *</label>
                  <input className="form-input" value={dlvKey} onChange={(e) => setDlvKey(e.target.value)} placeholder="e.g. ecommerce.purchase.transaction_id" />
                  <div className="section-hint">Use dot notation for nested keys</div>
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: 12 }} onClick={handleSubmit} disabled={loading}>
          {loading
            ? <><span className="spinner" /> Creating…</>
            : entityType === "googletag" ? "▶ Create Google Tag Config"
            : entityType === "tag"       ? (triggerMode === "new" ? "▶ Create Trigger + Tag" : "▶ Create Tag in GTM")
            : entityType === "trigger"   ? "▶ Create Trigger in GTM"
            : "▶ Create Variable in GTM"}
        </button>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
        <div className="card">
          <div className="card-title">👁️ Live Payload Preview</div>
          <div className="code-block" style={{ maxHeight: 340, overflowY: "auto" }}>{JSON.stringify(previewPayload, null, 2)}</div>
        </div>

        <div className="card card-highlight">
          <div className="card-title" style={{ color: "#003355" }}>📖 GTM Type Reference</div>
          <div style={{ fontSize: 12, color: "#003355", lineHeight: 2 }}>
            {[
              ["gaawe",       "GA4 Event Tag"],
              ["ua",          "Universal Analytics Tag"],
              ["html",        "Custom HTML Tag"],
              ["googtag",     "Google Tag Config"],
              ["gaawc",       "GA4 Config (gtag_config)"],
              ["awct",        "Google Ads Conversion"],
              ["customEvent", "Custom Event Trigger"],
              ["v",           "DataLayer Variable (DLV)"],
              ["k",           "1st Party Cookie"],
            ].map(([code, label]) => (
              <div key={code}>
                <code style={{ background: "white", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)", fontSize: 11 }}>{code}</code>
                <span style={{ marginLeft: 8 }}>→ {label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--highlight-border)", fontSize: 11, color: "#005580", lineHeight: 1.6 }}>
            <strong>Event params</strong> go as <code style={{ background: "white", padding: "1px 4px", borderRadius: 2 }}>eventSettingsTable</code> LIST of MAPs — not flat template params.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATALAYER UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
function DataLayerUpload({ post, setResult, setError, setLoading, loading }) {
  const [events, setEvents]                 = useState([]);
  const [dragover, setDragover]             = useState(false);
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const fileRef = useRef();

  function parseFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["xlsx", "xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        processRows(XLSX.utils.sheet_to_json(ws, { header: 1 }));
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "csv") {
      Papa.parse(file, { complete: (r) => processRows(r.data), skipEmptyLines: true });
    } else {
      setError("Please upload a CSV or XLSX file.");
    }
  }

  function processRows(data) {
    const parsed = parseDataLayerDoc(data);
    setEvents(parsed);
    setSelectedEvents(new Set(parsed.map((e) => e.eventName)));
  }

  function handleDrop(e) {
    e.preventDefault(); setDragover(false);
    if (e.dataTransfer.files[0]) parseFile(e.dataTransfer.files[0]);
  }

  function toggleEvent(name) {
    const s = new Set(selectedEvents);
    s.has(name) ? s.delete(name) : s.add(name);
    setSelectedEvents(s);
  }

  async function handleCreate() {
    setLoading(true); setError(""); setResult(null);
    try {
      const selectedEvts = events.filter((e) => selectedEvents.has(e.eventName));
      const d = await post({ action: "createFromDataLayer", payload: { events: selectedEvts } });
      setResult({ type: "bulk", data: d });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        📋 <strong>Expected columns:</strong> Event Name &nbsp;|&nbsp; Variable Name &nbsp;|&nbsp; Variable Type &nbsp;|&nbsp; Scope &nbsp;|&nbsp; Description
      </div>

      {!events.length && (
        <div className={`upload-zone ${dragover ? "dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}>
          <div className="upload-icon">📄</div>
          <p><strong>Drop your DataLayer spec here</strong> or click to browse</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>Supports .csv and .xlsx</p>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => e.target.files[0] && parseFile(e.target.files[0])} />
        </div>
      )}

      {events.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <span style={{ color: "var(--accent2)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{events.length} events</span>
              <span style={{ color: "var(--text2)" }}> detected</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setEvents([]); setSelectedEvents(new Set()); }}>↩ Clear</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading || selectedEvents.size === 0}>
                {loading ? <><span className="spinner" /> Creating…</> : `▶ Create ${selectedEvents.size} Event(s) in GTM`}
              </button>
            </div>
          </div>

          {events.map((evt) => (
            <div key={evt.eventName} className="card" style={{ marginBottom: 12, border: selectedEvents.has(evt.eventName) ? "2px solid var(--highlight-border)" : "1.5px solid var(--border)", background: selectedEvents.has(evt.eventName) ? "#f8fcff" : "white" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: evt.variables.length ? 12 : 0 }}>
                <input type="checkbox" checked={selectedEvents.has(evt.eventName)} onChange={() => toggleEvent(evt.eventName)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent2)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent2)", fontWeight: 700 }}>{evt.eventName}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                    <span className="badge badge-highlight">1 trigger</span>{" "}
                    <span className="badge badge-neutral" style={{ marginLeft: 4 }}>{evt.variables.filter((v) => ["dataLayer","dlv"].includes(v.varType)).length} DLV variables</span>
                  </div>
                </div>
              </div>
              {evt.variables.length > 0 && (
                <table className="data-table" style={{ marginTop: 4 }}>
                  <thead><tr><th>Variable</th><th>Type</th><th>Scope</th><th>Description</th></tr></thead>
                  <tbody>
                    {evt.variables.map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.varName}</td>
                        <td><span className="badge badge-neutral">{v.varType}</span></td>
                        <td style={{ color: "var(--text2)", fontSize: 12 }}>{v.scope}</td>
                        <td style={{ color: "var(--text2)", fontSize: 12 }}>{v.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}

      {!events.length && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">📋 Sample Format</div>
          <div className="code-block">{`Event Name,Variable Name,Variable Type,Scope,Description\npurchase,transaction_id,dataLayer,hit,Unique order ID\npurchase,revenue,dataLayer,hit,Total revenue\nadd_to_cart,item_id,dataLayer,hit,Product SKU`}</div>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => {
            const csv = `Event Name,Variable Name,Variable Type,Scope,Description\npurchase,transaction_id,dataLayer,hit,Unique order ID\npurchase,revenue,dataLayer,hit,Total revenue\nadd_to_cart,item_id,dataLayer,hit,Product SKU`;
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "datalayer_template.csv"; a.click();
          }}>⬇ Download CSV Template</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ResultPanel({ result }) {
  if (result.type === "single") {
    return (
      <div className="alert alert-success">
        ✅ <strong>{result.entity}</strong> created successfully in GTM!
        {result.data?.tagManagerUrl && (
          <div style={{ marginTop: 6 }}>
            <a href={result.data.tagManagerUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 12 }}>Open in GTM →</a>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <div className="code-block" style={{ maxHeight: 140 }}>{JSON.stringify(result.data, null, 2)}</div>
        </div>
      </div>
    );
  }
  if (result.type === "triggerAndTag") {
    const { trigger, tag } = result.data;
    return (
      <div className="alert alert-success">
        ✅ Created trigger <strong>{trigger?.name}</strong> (#{trigger?.triggerId}) and tag <strong>{tag?.name}</strong> — linked automatically!
        {tag?.tagManagerUrl && (
          <div style={{ marginTop: 6 }}>
            <a href={tag.tagManagerUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 12 }}>Open tag in GTM →</a>
          </div>
        )}
      </div>
    );
  }
  if (result.type === "bulk") {
    const { created } = result.data;
    return (
      <div className="alert alert-success">
        ✅ Created <strong>{created.length}</strong> entities in GTM:
        <div style={{ marginTop: 8 }}>
          {created.map((c, i) => (
            <div key={i} style={{ fontSize: 12, marginTop: 4 }}>
              <span className="badge badge-neutral" style={{ marginRight: 8 }}>{c.type}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{c.name}</span>
              <span style={{ color: "var(--text2)", marginLeft: 8 }}>ID: {c.id}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}