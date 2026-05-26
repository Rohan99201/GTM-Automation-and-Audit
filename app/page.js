"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import AuditView from "./components/AuditView";
import CreateView from "./components/CreateView";

export default function Home() {
  const { data: session, status } = useSession();
  const [view, setView] = useState("audit");

  // GTM context
  const [accounts, setAccounts] = useState([]);
  const [containers, setContainers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [loading, setLoading] = useState(false);

  const gtmGet = useCallback(async (params) => {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`/api/gtm?${qs}`);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    return d;
  }, []);

  useEffect(() => {
    if (session) {
      setLoading(true);
      gtmGet({ action: "accounts" })
        .then((d) => setAccounts(d.account || []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [session, gtmGet]);

  useEffect(() => {
    if (accountId) {
      setContainerId(""); setContainers([]);
      setWorkspaceId(""); setWorkspaces([]);
      gtmGet({ action: "containers", accountId }).then((d) => setContainers(d.container || []));
    }
  }, [accountId, gtmGet]);

  useEffect(() => {
    if (accountId && containerId) {
      setWorkspaceId(""); setWorkspaces([]);
      gtmGet({ action: "workspaces", accountId, containerId }).then((d) => setWorkspaces(d.workspace || []));
    }
  }, [accountId, containerId, gtmGet]);

  if (status === "loading") {
    return (
      <div className="login-page">
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto" }} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <svg width="52" height="52" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#1a1a0a"/>
              <text x="16" y="23" fontFamily="Georgia, serif" fontSize="20" fontWeight="700" fill="#b1e8fe" textAnchor="middle">R</text>
            </svg>
          </div>
          <div className="logo">▸ GTM AUTOMATION STUDIO</div>
          <h2>Tag Manager Automation</h2>
          <p>Automate tag creation from DataLayer docs & audit your GTM containers — all via the official GTM API.</p>

          <div style={{ marginBottom: 32, textAlign: "left" }}>
            {["✦ Create tags, triggers & variables in bulk", "✦ Upload DataLayer spec docs (CSV/XLSX)", "✦ Full container audit with issue detection", "✦ Works on any GTM account you have access to"].map((f) => (
              <div key={f} style={{ padding: "6px 0", fontSize: 13, color: "var(--text2)" }}>{f}</div>
            ))}
          </div>

          <button className="btn-google" onClick={() => signIn("google")}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
          <p style={{ marginTop: 16, marginBottom: 0, fontSize: 11, color: "var(--text2)" }}>
            Requires TagManager API access. Scopes requested: tagmanager.readonly + tagmanager.edit.containers
          </p>
        </div>
      </div>
    );
  }

  const ctxReady = accountId && containerId && workspaceId;

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <svg width="36" height="36" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <rect width="32" height="32" rx="8" fill="#b1e8fe"/>
              <text x="16" y="23" fontFamily="Georgia, serif" fontSize="20" fontWeight="700" fill="#1a1a0a" textAnchor="middle">R</text>
            </svg>
            <div>
              <h1 style={{ marginBottom: 0 }}>GTM STUDIO</h1>
              <span>Automation v1.0</span>
            </div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Mode</div>
          <button className={`nav-btn ${view === "audit" ? "active" : ""}`} onClick={() => setView("audit")}>
            <span className="icon">🔍</span> Audit Container
          </button>
          <button className={`nav-btn ${view === "create" ? "active" : ""}`} onClick={() => setView("create")}>
            <span className="icon">⚡</span> Create / Automate
          </button>
        </div>

        <div style={{ marginTop: "auto", padding: "0 12px" }}>
          <div style={{ padding: "12px", background: "#2a2a10", borderRadius: "var(--radius)", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#888860", marginBottom: 4 }}>Signed in as</div>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#fffceb" }}>{session.user.email}</div>
          </div>
          <button className="nav-btn" onClick={() => signOut()} style={{ color: "#ff8866" }}>
            <span className="icon">↩</span> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            {view === "audit" ? "🔍 Container Audit" : "⚡ Create & Automate"}
          </h2>
          <p style={{ color: "var(--text2)", fontSize: 13 }}>
            {view === "audit"
              ? "Analyse your GTM container for issues, unused entities, and configuration gaps."
              : "Create tags, triggers, and variables manually or from a DataLayer specification document."}
          </p>
        </div>

        {/* Context selector */}
        <div className="context-bar">
          <div>
            <div className="ctx-label">Account</div>
            <select className="ctx-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">— Select account —</option>
              {accounts.map((a) => (
                <option key={a.accountId} value={a.accountId}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="ctx-label">Container</div>
            <select className="ctx-select" value={containerId} onChange={(e) => setContainerId(e.target.value)} disabled={!accountId}>
              <option value="">— Select container —</option>
              {containers.map((c) => (
                <option key={c.containerId} value={c.containerId}>{c.name} ({c.publicId})</option>
              ))}
            </select>
          </div>
          <div>
            <div className="ctx-label">Workspace</div>
            <select className="ctx-select" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} disabled={!containerId}>
              <option value="">— Select workspace —</option>
              {workspaces.map((w) => (
                <option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {!ctxReady ? (
          <div className="card" style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{loading ? "⏳" : "☝️"}</div>
            <p style={{ color: "var(--text2)" }}>
              {loading ? "Loading your GTM accounts…" : "Select an Account, Container, and Workspace above to get started."}
            </p>
          </div>
        ) : view === "audit" ? (
          <AuditView accountId={accountId} containerId={containerId} workspaceId={workspaceId} />
        ) : (
          <CreateView accountId={accountId} containerId={containerId} workspaceId={workspaceId} />
        )}
      </main>
    </div>
  );
}