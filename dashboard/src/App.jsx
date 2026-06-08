import { useState, useEffect } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const CATEGORIES = ["Strategy Update", "Trade Notes", "Research", "System Change", "General"];

// ── Utilities ────────────────────────────────────────────────────────────────
const sentColor = (s) => {
  if (s >= 0.5) return "#00c853";
  if (s > -0.5) return "#aaa";
  return "#e53935";
};

function calcPnL(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const closed = [];
  const q = [];
  for (const t of sorted) {
    if (t.action === "buy") q.push(t);
    else if (t.action === "sell" && q.length > 0) {
      const b = q.shift();
      closed.push({ pnl: (t.price - b.price) * (b.notional / b.price) });
    }
  }
  const total = closed.reduce((s, t) => s + t.pnl, 0);
  const wins = closed.filter((t) => t.pnl > 0).length;
  return { total, closed, winRate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : null };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Shared badges ─────────────────────────────────────────────────────────────
function ActionBadge({ action }) {
  return (
    <span className={`pill ${action === "buy" ? "pill-buy" : "pill-sell"}`}>
      {action === "buy" ? "▲ BUY" : "▼ SELL"}
    </span>
  );
}
function ModeBadge({ status }) {
  const live = status === "accepted" || status === "filled";
  return <span className={`pill ${live ? "pill-live" : "pill-sim"}`}>{live ? "Executed" : "Simulated"}</span>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ trades, loading, error, lastUpdated, onRefresh }) {
  const buys = trades.filter((t) => t.action === "buy");
  const sells = trades.filter((t) => t.action === "sell");
  const { total, closed, winRate } = calcPnL(trades);
  const avgSent =
    trades.length > 0
      ? trades.reduce((s, t) => s + (t.sentiment_score ?? 0), 0) / trades.length
      : null;

  return (
    <div className="page">
      {/* Page title row */}
      <div className="page-top">
        <div>
          <p className="eyebrow">GEV · RSI(2) PULLBACK</p>
          <h1 className="page-title">Portfolio Overview</h1>
        </div>
        <div className="page-top-right">
          {lastUpdated && <span className="meta-text">Updated {lastUpdated}</span>}
          <button className="ghost-btn" onClick={onRefresh}>↻ Refresh</button>
        </div>
      </div>

      {error && (
        <div className="alert-bar alert-error">
          ⚠ {error} —{" "}
          <a href={`${API_URL}/health`} target="_blank" rel="noreferrer">check server</a>
        </div>
      )}

      {/* Dark stat panels */}
      <div className="dark-panels">
        <div className="dark-panel dark-panel-lg">
          <p className="dp-label">Simulated P&amp;L</p>
          <p className="dp-value" style={{ color: closed.length > 0 ? (total >= 0 ? "#00c853" : "#e53935") : "#fff" }}>
            {closed.length > 0 ? `${total >= 0 ? "+" : ""}$${total.toFixed(0)}` : "—"}
          </p>
          <p className="dp-sub">{closed.length} closed trades</p>
        </div>
        <div className="dark-panel">
          <p className="dp-label">Win Rate</p>
          <p className="dp-value" style={{ color: winRate != null ? (winRate >= 50 ? "#00c853" : "#e53935") : "#fff" }}>
            {winRate != null ? `${winRate}%` : "—"}
          </p>
          <p className="dp-sub">
            {closed.length > 0
              ? `${closed.filter((t) => t.pnl > 0).length}W · ${closed.filter((t) => t.pnl <= 0).length}L`
              : "No closed trades yet"}
          </p>
        </div>
        <div className="dark-panel">
          <p className="dp-label">Total Signals</p>
          <p className="dp-value">{trades.length}</p>
          <p className="dp-sub">{buys.length} buys · {sells.length} sells</p>
        </div>
        <div className="dark-panel">
          <p className="dp-label">Avg Sentiment</p>
          <p className="dp-value" style={{ color: avgSent != null ? sentColor(avgSent) : "#fff" }}>
            {avgSent != null ? (avgSent >= 0 ? "+" : "") + avgSent.toFixed(2) : "—"}
          </p>
          <p className="dp-sub">
            {avgSent == null ? "No data" : avgSent > 0.3 ? "Broadly positive" : avgSent < -0.3 ? "Broadly negative" : "Mixed / neutral"}
          </p>
        </div>
      </div>

      {/* Trade log */}
      <p className="section-label">TRADE LOG</p>

      {loading ? (
        <div className="state-box"><div className="spinner" /></div>
      ) : trades.length === 0 ? (
        <div className="state-box">
          <p className="state-title">No trades yet</p>
          <p className="state-body">When TradingView fires a signal it will appear here automatically.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Symbol</th>
                <th>Price</th>
                <th>Amount</th>
                <th>AI Score</th>
                <th>What the AI Read</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{fmtDateTime(t.timestamp)}</td>
                  <td><ActionBadge action={t.action} /></td>
                  <td className="bold">{t.symbol}</td>
                  <td className="mono">${t.price?.toFixed(2)}</td>
                  <td className="mono">${t.notional?.toFixed(0)}</td>
                  <td>
                    <span className="sent-val" style={{ color: sentColor(t.sentiment_score ?? 0) }}>
                      {(t.sentiment_score >= 0 ? "+" : "") + (t.sentiment_score ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="summary-cell">{t.sentiment_summary || "—"}</td>
                  <td><ModeBadge status={t.order_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Knowledge Base ────────────────────────────────────────────────────────────
function KnowledgeBasePage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // "list" | "new" | "read"
  const [activeDoc, setActiveDoc] = useState(null);

  // New doc form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/docs`);
      if (res.ok) setDocs(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) { setSaveErr("Title and content are required."); return; }
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch(`${API_URL}/docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, category }),
      });
      if (!res.ok) throw new Error();
      await fetchDocs();
      setTitle(""); setContent(""); setCategory("General");
      setView("list");
    } catch { setSaveErr("Could not save. Check the backend is running."); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this entry?")) return;
    await fetch(`${API_URL}/docs/${id}`, { method: "DELETE" });
    setDocs((d) => d.filter((x) => x.id !== id));
    if (activeDoc?.id === id) setView("list");
  };

  // ── List view ──
  if (view === "list") {
    return (
      <div className="page">
        <div className="page-top">
          <div>
            <p className="eyebrow">TRADECORTEX</p>
            <h1 className="page-title">Knowledge Base</h1>
          </div>
          <button className="primary-btn" onClick={() => setView("new")}>+ New Entry</button>
        </div>

        <p className="kb-intro">
          A personal log of strategy updates, research notes, and system changes. Everything in one place.
        </p>

        <div className="rule" />

        {loading ? (
          <div className="state-box"><div className="spinner" /></div>
        ) : docs.length === 0 ? (
          <div className="state-box">
            <p className="state-title">No entries yet</p>
            <p className="state-body">Click "New Entry" to document your first strategy update or research note.</p>
          </div>
        ) : (
          <div className="kb-grid">
            {docs.map((doc) => (
              <div key={doc.id} className="kb-card" onClick={() => { setActiveDoc(doc); setView("read"); }}>
                <div className="kb-card-top">
                  <span className="kb-category">{doc.category}</span>
                  <span className="kb-date">{fmtDate(doc.date)}</span>
                </div>
                <h2 className="kb-card-title">{doc.title}</h2>
                <p className="kb-card-excerpt">{doc.content.slice(0, 160)}{doc.content.length > 160 ? "…" : ""}</p>
                <div className="kb-card-footer">
                  <span className="kb-read-more">Read →</span>
                  <button
                    className="kb-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── New entry view ──
  if (view === "new") {
    return (
      <div className="page">
        <div className="page-top">
          <div>
            <p className="eyebrow">KNOWLEDGE BASE</p>
            <h1 className="page-title">New Entry</h1>
          </div>
          <button className="ghost-btn" onClick={() => { setView("list"); setSaveErr(null); }}>← Back</button>
        </div>

        <div className="rule" />

        {saveErr && <div className="alert-bar alert-error">⚠ {saveErr}</div>}

        <div className="doc-form">
          <div className="form-row">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Changed RSI threshold to 8, Added 50 EMA filter…"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label className="form-label">Category</label>
            <select className="form-input form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-row">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input form-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what you changed, why you changed it, what results you observed…"
              rows={14}
            />
          </div>

          <button className="primary-btn" onClick={handleCreate} disabled={saving}>
            {saving ? "Saving…" : "Save Entry"}
          </button>
        </div>
      </div>
    );
  }

  // ── Read view ──
  if (view === "read" && activeDoc) {
    return (
      <div className="page">
        <div className="page-top">
          <button className="ghost-btn" onClick={() => setView("list")}>← Knowledge Base</button>
          <button className="danger-btn" onClick={() => handleDelete(activeDoc.id)}>Delete</button>
        </div>

        <div className="rule" />

        <div className="doc-read">
          <div className="doc-meta-row">
            <span className="kb-category">{activeDoc.category}</span>
            <span className="kb-date">{fmtDate(activeDoc.date)}</span>
          </div>
          <h1 className="doc-read-title">{activeDoc.title}</h1>
          <div className="rule" />
          <pre className="doc-read-body">{activeDoc.content}</pre>
        </div>
      </div>
    );
  }

  return null;
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage({ config, onSave }) {
  const [symbol, setSymbol] = useState(config?.symbol || "GEV");
  const [notional, setNotional] = useState(config?.order_notional || 500);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`${API_URL}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.toUpperCase().trim(), order_notional: parseFloat(notional), dry_run: true }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      onSave(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) { setErr(`Could not save: ${e.message}`); }
    setSaving(false);
  };

  return (
    <div className="page">
      <div className="page-top">
        <div>
          <p className="eyebrow">TRADECORTEX</p>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      <p className="settings-intro">
        Change the stock symbol or order size. All trades run in paper (simulated) mode — no real money involved.
      </p>

      <div className="rule" />

      {err && <div className="alert-bar alert-error">⚠ {err}</div>}
      {saved && <div className="alert-bar alert-ok">✓ Settings saved. Takes effect on the next trade signal.</div>}

      <div className="settings-form">
        <div className="setting-row">
          <div className="setting-info">
            <p className="setting-label">Stock Symbol</p>
            <p className="setting-desc">
              The ticker the bot watches. After changing this, update your TradingView chart to the same stock.
            </p>
          </div>
          <input
            className="setting-input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="GEV"
            maxLength={6}
          />
        </div>

        <div className="rule-light" />

        <div className="setting-row">
          <div className="setting-info">
            <p className="setting-label">Dollar Amount Per Trade</p>
            <p className="setting-desc">
              Alpaca will buy or sell fractional shares worth this amount on each signal.
            </p>
          </div>
          <div className="prefix-wrap">
            <span className="prefix">$</span>
            <input
              className="setting-input has-prefix"
              type="number"
              value={notional}
              onChange={(e) => setNotional(e.target.value)}
              min={1}
            />
          </div>
        </div>

        <div className="rule-light" />

        <div className="setting-row">
          <div className="setting-info">
            <p className="setting-label">Trading Mode</p>
            <p className="setting-desc">
              Paper trading is permanently enabled. All trades simulate real market prices with no real money.
            </p>
          </div>
          <span className="setting-badge">🧪 Paper Only</span>
        </div>
      </div>

      <button className="primary-btn" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </button>

      <div className="rule" style={{ marginTop: 48 }} />

      <div className="info-block">
        <p className="info-block-title">How to change the stock</p>
        <ol className="info-list">
          <li>Enter the new ticker above (e.g. <code>NVDA</code>) and click Save.</li>
          <li>Open TradingView, load the same ticker on a chart, and re-apply the Pine Script strategy.</li>
          <li>Create a new alert pointing your Railway webhook URL. The bot will now accept signals for the new symbol.</li>
        </ol>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [config, setConfig] = useState(null);

  const fetchTrades = async () => {
    try {
      const res = await fetch(`${API_URL}/trades`);
      if (!res.ok) throw new Error();
      setTrades([...await res.json()].reverse());
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch { setError("Cannot reach the backend."); }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
    fetch(`${API_URL}/config`).then((r) => r.ok && r.json()).then((d) => d && setConfig(d)).catch(() => {});
    const iv = setInterval(fetchTrades, 10000);
    return () => clearInterval(iv);
  }, []);

  const PAGES = ["Dashboard", "Knowledge Base", "Settings"];

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">TradeCortex</span>
          <span className="header-chip">{config?.symbol || "GEV"} · RSI(2)</span>
          <span className="header-chip chip-paper">● PAPER</span>
        </div>
        <nav className="nav">
          {PAGES.map((p) => (
            <button key={p} className={`nav-link${page === p ? " nav-active" : ""}`} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {page === "Dashboard" && (
          <DashboardPage trades={trades} loading={loading} error={error} lastUpdated={lastUpdated} onRefresh={fetchTrades} />
        )}
        {page === "Knowledge Base" && <KnowledgeBasePage />}
        {page === "Settings" && <SettingsPage config={config} onSave={setConfig} />}
      </main>

      <footer className="footer">
        <span>TradeCortex · Paper Trading · GEV RSI(2) Pullback</span>
        <span>{new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
