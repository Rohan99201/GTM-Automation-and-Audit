"use client";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { parseDataLayerDoc, buildPayloadsFromEvent } from "../../lib/gtmClient";

export default function CreateView({ accountId, containerId, workspaceId }) {
  const [mode, setMode] = useState("manual"); // "manual" | "datalayer"
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

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${mode === "manual" ? "active" : ""}`} onClick={() => { setMode("manual"); setResult(null); setError(""); }}>
          ✏️ Manual Create
        </button>
        <button className={`tab-btn ${mode === "datalayer" ? "active" : ""}`} onClick={() => { setMode("datalayer"); setResult(null); setError(""); }}>
          📄 DataLayer Doc Upload
        </button>
      </div>

      {error && <div className="alert alert-error">⚠ {error}</div>}
      {result && <ResultPanel result={result} />}

      {mode === "manual" && (
        <ManualCreate post={post} setResult={setResult} setError={setError} setLoading={setLoading} loading={loading} />
      )}
      {mode === "datalayer" && (
        <DataLayerUpload post={post} setResult={setResult} setError={setError} setLoading={setLoading} loading={loading} />
      )}
    </div>
  );
}

// ── Manual Create ──────────────────────────────────────────────────────────
function ManualCreate({ post, setResult, setError, setLoading, loading }) {
  const [entityType, setEntityType] = useState("tag");

  // Tag state
  const [tagName, setTagName] = useState("");
  const [tagType, setTagType] = useState("ua"); // ua | gaawe | html | custom
  const [triggerId, setTriggerId] = useState("");
  const [tagParams, setTagParams] = useState([{ key: "", value: "" }]);

  // Trigger state
  const [trigName, setTrigName] = useState("");
  const [trigType, setTrigType] = useState("customEvent");
  const [eventName, setEventName] = useState("");

  // Variable state
  const [varName, setVarName] = useState("");
  const [varType, setVarType] = useState("v"); // v=DLV, k=1stparty, jsm=JS var
  const [dlvKey, setDlvKey] = useState("");

  async function handleSubmit() {
    setError(""); setResult(null); setLoading(true);
    try {
      let payload, action;

      if (entityType === "tag") {
        action = "createTag";
        const parameters = tagParams
          .filter((p) => p.key && p.value)
          .map((p) => ({ type: "template", key: p.key, value: p.value }));
        payload = {
          name: tagName,
          type: tagType,
          parameter: parameters,
          ...(triggerId ? { firingTriggerId: [triggerId] } : {}),
        };
      } else if (entityType === "trigger") {
        action = "createTrigger";
        payload = {
          name: trigName,
          type: trigType,
          ...(trigType === "customEvent" && eventName
            ? { customEventFilter: [{ type: "equals", parameter: [{ type: "template", key: "arg0", value: "{{_event}}" }, { type: "template", key: "arg1", value: eventName }] }] }
            : {}),
        };
      } else {
        action = "createVariable";
        payload = {
          name: varName,
          type: varType,
          parameter: varType === "v"
            ? [{ type: "integer", key: "dataLayerVersion", value: "2" }, { type: "boolean", key: "setDefaultValue", value: "false" }, { type: "template", key: "name", value: dlvKey }]
            : [],
        };
      }

      const d = await post({ action, payload });
      setResult({ type: "single", entity: entityType, data: d });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div>
        <div className="card">
          <div className="card-title">📦 Entity Type</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["tag", "trigger", "variable"].map((t) => (
              <button key={t} className={`btn ${entityType === t ? "btn-primary" : "btn-secondary"}`} onClick={() => setEntityType(t)} style={{ flex: 1 }}>
                {t === "tag" ? "🏷️" : t === "trigger" ? "⚡" : "📐"} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {entityType === "tag" && (
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
              <label className="form-label">Firing Trigger ID (optional)</label>
              <input className="form-input" value={triggerId} onChange={(e) => setTriggerId(e.target.value)} placeholder="e.g. 12345678" />
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>Get trigger IDs from the Audit tab → Triggers</div>
            </div>
            <div className="form-group">
              <label className="form-label">Parameters</label>
              {tagParams.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="form-input" value={p.key} onChange={(e) => { const n = [...tagParams]; n[i].key = e.target.value; setTagParams(n); }} placeholder="key" style={{ flex: 1 }} />
                  <input className="form-input" value={p.value} onChange={(e) => { const n = [...tagParams]; n[i].value = e.target.value; setTagParams(n); }} placeholder="value" style={{ flex: 1 }} />
                  <button className="btn btn-secondary" style={{ padding: "0 10px" }} onClick={() => setTagParams(tagParams.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={() => setTagParams([...tagParams, { key: "", value: "" }])}>+ Add param</button>
            </div>
          </div>
        )}

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
                <option value="click">Click</option>
                <option value="linkClick">Link Click</option>
                <option value="formSubmit">Form Submission</option>
                <option value="scrollDepth">Scroll Depth</option>
                <option value="historyChange">History Change</option>
              </select>
            </div>
            {trigType === "customEvent" && (
              <div className="form-group">
                <label className="form-label">Event Name (dataLayer event)</label>
                <input className="form-input" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. purchase" />
              </div>
            )}
          </div>
        )}

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
                <option value="v">Data Layer Variable</option>
                <option value="k">1st Party Cookie</option>
                <option value="jsm">JavaScript Variable</option>
                <option value="u">URL</option>
                <option value="e">Auto-Event Variable</option>
              </select>
            </div>
            {varType === "v" && (
              <div className="form-group">
                <label className="form-label">DataLayer Key Name</label>
                <input className="form-input" value={dlvKey} onChange={(e) => setDlvKey(e.target.value)} placeholder="e.g. ecommerce.purchase.transaction_id" />
              </div>
            )}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleSubmit} disabled={loading}>
          {loading ? <><span className="spinner" /> Creating…</> : `▶ Create ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`}
        </button>
      </div>

      {/* Right: Preview pane */}
      <div className="card">
        <div className="card-title">👁️ Payload Preview</div>
        <div className="code-block">
          {JSON.stringify(
            entityType === "tag"
              ? { name: tagName, type: tagType, firingTriggerId: triggerId ? [triggerId] : [], parameter: tagParams.filter((p) => p.key) }
              : entityType === "trigger"
              ? { name: trigName, type: trigType, ...(trigType === "customEvent" ? { customEventFilter: [{ type: "equals", arg0: "{{_event}}", arg1: eventName }] } : {}) }
              : { name: varName, type: varType, ...(varType === "v" ? { dataLayerKey: dlvKey } : {}) },
            null, 2
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>📖 GTM Type Reference</div>
          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.8 }}>
            <div><code style={{ color: "var(--accent2)" }}>gaawe</code> → GA4 Event Tag</div>
            <div><code style={{ color: "var(--accent2)" }}>ua</code> → Universal Analytics Tag</div>
            <div><code style={{ color: "var(--accent2)" }}>html</code> → Custom HTML Tag</div>
            <div><code style={{ color: "var(--accent2)" }}>customEvent</code> → Custom Event Trigger</div>
            <div><code style={{ color: "var(--accent2)" }}>v</code> → DataLayer Variable (DLV)</div>
            <div><code style={{ color: "var(--accent2)" }}>k</code> → 1st Party Cookie</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DataLayer Doc Upload ───────────────────────────────────────────────────
function DataLayerUpload({ post, setResult, setError, setLoading, loading }) {
  const [rows, setRows] = useState(null);
  const [events, setEvents] = useState([]);
  const [dragover, setDragover] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState(new Set());
  const fileRef = useRef();

  function parseFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (["xlsx", "xls"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        processRows(data);
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === "csv") {
      Papa.parse(file, {
        complete: (r) => processRows(r.data),
        skipEmptyLines: true,
      });
    } else {
      setError("Please upload a CSV or XLSX file.");
    }
  }

  function processRows(data) {
    setRows(data);
    const parsed = parseDataLayerDoc(data);
    setEvents(parsed);
    setSelectedEvents(new Set(parsed.map((e) => e.eventName)));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function toggleEvent(name) {
    const s = new Set(selectedEvents);
    if (s.has(name)) s.delete(name);
    else s.add(name);
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
      {/* Template download hint */}
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        📋 <strong>Expected columns:</strong> Event Name | Variable Name | Variable Type (dataLayer/jsm/k) | Scope | Description
      </div>

      {/* Upload zone */}
      {!events.length && (
        <div
          className={`upload-zone ${dragover ? "dragover" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
          onDragLeave={() => setDragover(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
        >
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
              <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{events.length} events</span>
              <span style={{ color: "var(--text2)", fontSize: 13 }}> detected in file</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setEvents([]); setRows(null); setSelectedEvents(new Set()); }}>↩ Clear</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading || selectedEvents.size === 0}>
                {loading ? <><span className="spinner" /> Creating…</> : `▶ Create ${selectedEvents.size} Event(s) in GTM`}
              </button>
            </div>
          </div>

          {events.map((evt) => (
            <div key={evt.eventName} className="card" style={{ marginBottom: 12, border: selectedEvents.has(evt.eventName) ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: evt.variables.length ? 12 : 0 }}>
                <input type="checkbox" checked={selectedEvents.has(evt.eventName)} onChange={() => toggleEvent(evt.eventName)} style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent2)" }}>{evt.eventName}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                    Will create: 1 Custom Event trigger + {evt.variables.filter((v) => v.varType === "dataLayer" || v.varType === "dlv").length} DLV variable(s)
                  </div>
                </div>
                <span className="badge badge-neutral">{evt.variables.length} vars</span>
              </div>

              {evt.variables.length > 0 && (
                <table className="data-table" style={{ marginTop: 4 }}>
                  <thead>
                    <tr><th>Variable</th><th>Type</th><th>Scope</th><th>Description</th></tr>
                  </thead>
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

      {/* Sample template */}
      {!events.length && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">📋 Sample DataLayer Doc Format</div>
          <div className="code-block">{`Event Name,Variable Name,Variable Type,Scope,Description
purchase,transaction_id,dataLayer,hit,Unique order ID
purchase,revenue,dataLayer,hit,Total revenue
purchase,currency,dataLayer,hit,Currency code (e.g. GBP)
add_to_cart,item_id,dataLayer,hit,Product SKU
add_to_cart,item_name,dataLayer,hit,Product name
add_to_cart,price,dataLayer,hit,Unit price
page_view,page_type,dataLayer,session,Type of page`}</div>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => {
            const csv = `Event Name,Variable Name,Variable Type,Scope,Description\npurchase,transaction_id,dataLayer,hit,Unique order ID\npurchase,revenue,dataLayer,hit,Total revenue\npurchase,currency,dataLayer,hit,Currency code\nadd_to_cart,item_id,dataLayer,hit,Product SKU\nadd_to_cart,item_name,dataLayer,hit,Product name`;
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "datalayer_template.csv";
            a.click();
          }}>
            ⬇ Download CSV Template
          </button>
        </div>
      )}
    </div>
  );
}

// ── Result Panel ───────────────────────────────────────────────────────────
function ResultPanel({ result }) {
  if (result.type === "single") {
    return (
      <div className="alert alert-success">
        ✅ <strong>{result.entity}</strong> created successfully!
        <div style={{ marginTop: 8 }}>
          <div className="code-block" style={{ maxHeight: 120 }}>{JSON.stringify(result.data, null, 2)}</div>
        </div>
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
