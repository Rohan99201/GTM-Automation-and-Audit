"use client";
import { useState } from "react";

export default function AuditView({ accountId, containerId, workspaceId }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("issues");

  async function runAudit() {
    setLoading(true);
    setError("");
    setAudit(null);
    try {
      const r = await fetch(
        `/api/gtm?action=audit&accountId=${accountId}&containerId=${containerId}&workspaceId=${workspaceId}`
      );
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setAudit(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const severityOrder = { error: 0, warn: 1, info: 2 };
  const sortedIssues = audit
    ? [...audit.issues].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    : [];

  const errorCount = sortedIssues.filter((i) => i.severity === "error").length;
  const warnCount = sortedIssues.filter((i) => i.severity === "warn").length;
  const infoCount = sortedIssues.filter((i) => i.severity === "info").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={runAudit} disabled={loading}>
          {loading ? <><span className="spinner" /> Running audit…</> : "▶ Run Audit"}
        </button>
        {audit && (
          <span style={{ color: "var(--text2)", fontSize: 13 }}>
            Last run: {new Date().toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && <div className="alert alert-error">⚠ {error}</div>}

      {audit && (
        <>
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{audit.summary.tags}</div>
              <div className="stat-label">Tags</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{audit.summary.triggers}</div>
              <div className="stat-label">Triggers</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{audit.summary.variables}</div>
              <div className="stat-label">Variables</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: errorCount > 0 ? "var(--error)" : "var(--accent)" }}>
                {errorCount}
              </div>
              <div className="stat-label">Errors</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: warnCount > 0 ? "var(--warn)" : "var(--accent)" }}>
                {warnCount}
              </div>
              <div className="stat-label">Warnings</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: "var(--info)" }}>{infoCount}</div>
              <div className="stat-label">Info</div>
            </div>
          </div>

          {/* Health score */}
          <HealthScore issues={audit.issues} total={audit.summary.tags + audit.summary.triggers + audit.summary.variables} />

          {/* Tabs */}
          <div className="tabs">
            {["issues", "tags", "triggers", "variables"].map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === "issues" && audit.issues.length > 0 && (
                  <span style={{ marginLeft: 6, background: "var(--error)", color: "white", borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>
                    {audit.issues.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "issues" && <IssuesTable issues={sortedIssues} />}
          {tab === "tags" && <TagsTable tags={audit.tags} triggers={audit.triggers} />}
          {tab === "triggers" && <TriggersTable triggers={audit.triggers} />}
          {tab === "variables" && <VariablesTable variables={audit.variables} />}
        </>
      )}

      {!audit && !loading && (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
          <p style={{ color: "var(--text2)" }}>Click "Run Audit" to analyse your container for configuration issues, unused entities, and best-practice gaps.</p>
        </div>
      )}
    </div>
  );
}

function HealthScore({ issues, total }) {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const penalty = errors * 10 + warns * 3;
  const score = Math.max(0, 100 - penalty);
  const color = score >= 80 ? "var(--accent)" : score >= 50 ? "var(--warn)" : "var(--error)";
  const label = score >= 80 ? "Good" : score >= 50 ? "Needs attention" : "Critical issues";

  return (
    <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 48, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>Health Score</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", color, fontSize: 13, marginBottom: 8 }}>● {label}</div>
        <div style={{ background: "var(--bg)", borderRadius: 99, height: 6, overflow: "hidden" }}>
          <div style={{ width: `${score}%`, height: "100%", background: color, transition: "width 0.5s ease", borderRadius: 99 }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text2)" }}>
          Based on {issues.length} issue{issues.length !== 1 ? "s" : ""} across {total} entities
        </div>
      </div>
    </div>
  );
}

function IssuesTable({ issues }) {
  if (!issues.length) return (
    <div className="card" style={{ textAlign: "center", padding: 32 }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
      <p style={{ color: "var(--text2)" }}>No issues found — container looks clean!</p>
    </div>
  );

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Entity Type</th>
            <th>Name</th>
            <th>Issue</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, i) => (
            <tr key={i} className={`issue-${issue.severity}`}>
              <td>
                <span className={`badge badge-${issue.severity === "error" ? "error" : issue.severity === "warn" ? "warn" : "info"}`}>
                  {issue.severity}
                </span>
              </td>
              <td><span className="badge badge-neutral">{issue.entity}</span></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{issue.name}</td>
              <td style={{ color: "var(--text2)" }}>{issue.msg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagsTable({ tags, triggers }) {
  const triggerMap = {};
  triggers.forEach((t) => { triggerMap[t.triggerId] = t.name; });

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Firing Triggers</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag.tagId}>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{tag.name}</td>
              <td><span className="badge badge-neutral">{tag.type}</span></td>
              <td style={{ fontSize: 12, color: "var(--text2)" }}>
                {(tag.firingTriggerId || []).map((id) => triggerMap[id] || id).join(", ") || "—"}
              </td>
              <td>
                <span className={`badge ${tag.paused ? "badge-warn" : "badge-ok"}`}>
                  {tag.paused ? "paused" : "active"}
                </span>
              </td>
            </tr>
          ))}
          {!tags.length && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text2)", padding: 24 }}>No tags found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TriggersTable({ triggers }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>ID</th></tr>
        </thead>
        <tbody>
          {triggers.map((t) => (
            <tr key={t.triggerId}>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{t.name}</td>
              <td><span className="badge badge-neutral">{t.type}</span></td>
              <td style={{ color: "var(--text2)", fontSize: 12 }}>{t.triggerId}</td>
            </tr>
          ))}
          {!triggers.length && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text2)", padding: 24 }}>No triggers found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function VariablesTable({ variables }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>ID</th></tr>
        </thead>
        <tbody>
          {variables.map((v) => (
            <tr key={v.variableId}>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.name}</td>
              <td><span className="badge badge-neutral">{v.type}</span></td>
              <td style={{ color: "var(--text2)", fontSize: 12 }}>{v.variableId}</td>
            </tr>
          ))}
          {!variables.length && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text2)", padding: 24 }}>No user-defined variables found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
