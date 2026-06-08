import { useState, useEffect } from "react";
import "./App.css";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceDot, Cell,
} from "recharts";

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

// Build cumulative P&L series for the area chart
function buildPnLSeries(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const series = [{ label: "Start", pnl: 0 }];
  const q = [];
  let cum = 0;
  for (const t of sorted) {
    if (t.action === "buy") { q.push(t); }
    else if (t.action === "sell" && q.length > 0) {
      const b = q.shift();
      cum += (t.price - b.price) * (b.notional / b.price);
      series.push({ label: t.timestamp.slice(5, 10), pnl: Math.round(cum * 100) / 100 });
    }
  }
  return series;
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

// ── Custom tooltip for charts ─────────────────────────────────────────────────
function ChartTip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <p className="chart-tip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color || "#111" }}>
          {prefix}{typeof p.value === "number" ? p.value.toFixed(2) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ trades, loading, error, lastUpdated, onRefresh }) {
  const [mkt, setMkt] = useState({ bars: [], symbol: "" });
  const [mktLoading, setMktLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/market-data`)
      .then((r) => r.ok ? r.json() : { bars: [] })
      .then((d) => setMkt(d))
      .catch(() => {})
      .finally(() => setMktLoading(false));
  }, []);

  const buys = trades.filter((t) => t.action === "buy");
  const sells = trades.filter((t) => t.action === "sell");
  const { total, closed, winRate } = calcPnL(trades);
  const avgSent =
    trades.length > 0
      ? trades.reduce((s, t) => s + (t.sentiment_score ?? 0), 0) / trades.length
      : null;

  const pnlSeries = buildPnLSeries(trades);
  const finalPnL = pnlSeries[pnlSeries.length - 1]?.pnl ?? 0;

  const sentimentSeries = [...trades]
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((t) => ({
      label: t.timestamp.slice(5, 10),
      score: t.sentiment_score ?? 0,
      action: t.action,
    }));

  // Map trades to their nearest price bar date for markers
  const tradeDates = trades.reduce((acc, t) => {
    acc[t.id] = t.timestamp.slice(0, 10);
    return acc;
  }, {});

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

      {/* ── Charts ── */}
      <div className="charts-area">

        {/* 1. GEV Price with trade markers */}
        <div className="chart-card chart-card-full">
          <div className="chart-header">
            <div>
              <p className="chart-title">{mkt.symbol || "GEV"} Price — 90 Days</p>
              <p className="chart-sub">
                <span className="legend-dot" style={{ background: "#15803d" }} /> Buy entry &nbsp;
                <span className="legend-dot" style={{ background: "#b91c1c" }} /> Sell exit
              </p>
            </div>
            {mkt.bars.length > 0 && (
              <p className="chart-current">
                ${mkt.bars[mkt.bars.length - 1]?.close?.toFixed(2)}
                <span className="chart-current-label"> current</span>
              </p>
            )}
          </div>
          {mktLoading ? (
            <div className="chart-empty"><div className="spinner" /></div>
          ) : mkt.bars.length === 0 ? (
            <div className="chart-empty">
              <p>Price data unavailable</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mkt.bars} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#f0f0ee" strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#bbb" }}
                  tickFormatter={(d) => d.slice(5)}
                  interval={Math.floor(mkt.bars.length / 6)}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "#bbb" }}
                  width={58}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<ChartTip prefix="$" />} />
                <Line type="monotone" dataKey="close" stroke="#111" strokeWidth={1.5} dot={false} name="Price" />
                {buys.map((t) => {
                  const d = tradeDates[t.id];
                  const bar = mkt.bars.find((b) => b.date === d);
                  return bar ? (
                    <ReferenceDot key={t.id} x={d} y={bar.close} r={5} fill="#15803d" stroke="#fff" strokeWidth={1.5} />
                  ) : null;
                })}
                {sells.map((t) => {
                  const d = tradeDates[t.id];
                  const bar = mkt.bars.find((b) => b.date === d);
                  return bar ? (
                    <ReferenceDot key={t.id} x={d} y={bar.close} r={5} fill="#b91c1c" stroke="#fff" strokeWidth={1.5} />
                  ) : null;
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="charts-row">
          {/* 2. Cumulative P&L */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <p className="chart-title">Cumulative P&amp;L</p>
                <p className="chart-sub">Running paper profit / loss</p>
              </div>
              {pnlSeries.length > 1 && (
                <p className="chart-current" style={{ color: finalPnL >= 0 ? "#15803d" : "#b91c1c" }}>
                  {finalPnL >= 0 ? "+" : ""}${finalPnL.toFixed(0)}
                </p>
              )}
            </div>
            {pnlSeries.length <= 1 ? (
              <div className="chart-empty"><p>No closed trades yet</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={pnlSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={finalPnL >= 0 ? "#15803d" : "#b91c1c"} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={finalPnL >= 0 ? "#15803d" : "#b91c1c"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f0f0ee" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#bbb" }} width={52} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<ChartTip prefix="$" />} />
                  <Area
                    type="monotone"
                    dataKey="pnl"
                    stroke={finalPnL >= 0 ? "#15803d" : "#b91c1c"}
                    strokeWidth={1.5}
                    fill="url(#pnlGrad)"
                    name="P&L"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* 3. Sentiment history */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <p className="chart-title">Sentiment per Signal</p>
                <p className="chart-sub">AI score at time of each trade</p>
              </div>
            </div>
            {sentimentSeries.length === 0 ? (
              <div className="chart-empty"><p>No trade data yet</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sentimentSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f0f0ee" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: "#bbb" }} width={36} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="score" name="Sentiment" radius={[2, 2, 0, 0]}>
                    {sentimentSeries.map((entry, i) => (
                      <Cell key={i} fill={entry.score >= 0.3 ? "#15803d" : entry.score <= -0.3 ? "#b91c1c" : "#aaa"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Trade log */}
      <div className="trade-log-header">
        <div>
          <p className="section-label">COMPLETE RECORD</p>
          <h2 className="trade-log-title">Trade Log</h2>
          <p className="trade-log-sub">Every signal the bot has ever received — buy, sell, skipped, simulated. Nothing is deleted.</p>
        </div>
        {trades.length > 0 && (
          <span className="trade-log-count">{trades.length} entries</span>
        )}
      </div>

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
        body: JSON.stringify({ order_notional: parseFloat(notional), dry_run: true }),
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
        Adjust the dollar amount per trade. The bot trades GEV in paper (simulated) mode — no real money involved.
      </p>

      <div className="rule" />

      {err && <div className="alert-bar alert-error">⚠ {err}</div>}
      {saved && <div className="alert-bar alert-ok">✓ Settings saved. Takes effect on the next trade signal.</div>}

      <div className="settings-form">
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
            <p className="setting-label">Stock</p>
            <p className="setting-desc">
              The bot is configured to trade GE Vernova (GEV) using the RSI(2) Pullback strategy.
            </p>
          </div>
          <span className="setting-badge">GEV</span>
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
    </div>
  );
}

// ── How It Works ─────────────────────────────────────────────────────────────
function HowItWorksPage() {
  const [open, setOpen] = useState(null);

  const toggle = (i) => setOpen(open === i ? null : i);

  const steps = [
    {
      n: "01",
      title: "TradingView watches the stock",
      body: "GE Vernova (ticker: GEV) is loaded on a live chart inside TradingView — a professional charting platform. A strategy called RSI(2) Pullback runs continuously on that chart, checking the price every time a new daily candle closes.",
    },
    {
      n: "02",
      title: "A buy or sell signal fires",
      body: "When specific conditions are met (explained below), the strategy triggers an alert. A buy signal means 'conditions look right to enter a position.' A sell signal means 'conditions suggest it is time to exit.'",
    },
    {
      n: "03",
      title: "TradingView sends a message to the server",
      body: "TradingView fires a webhook — a small JSON packet containing the action (buy or sell), the stock symbol, and the current price — to your server hosted on Railway. This happens in under a second.",
    },
    {
      n: "04",
      title: "Claude AI reads the latest news",
      body: "The server asks Claude (Anthropic's AI) to search the web for the last 24 hours of news about GEV. Claude returns a sentiment score between −1.0 (very bad news) and +1.0 (very good news), plus a short summary of what it found.",
    },
    {
      n: "05",
      title: "The Brain decides whether to trade",
      body: "If the chart says BUY but today's news is very negative (score below −0.6), the trade is skipped — bad news can override a technical signal. The same applies in reverse for sells. Otherwise the trade proceeds.",
    },
    {
      n: "06",
      title: "Alpaca places a paper trade",
      body: "Alpaca is a brokerage that supports paper trading — simulated trades that use real market prices but zero real money. $500 of GEV is bought or sold in fractional shares. You can see every order in your Alpaca dashboard.",
    },
    {
      n: "07",
      title: "The dashboard updates",
      body: "The trade is saved to a log file on the server. This dashboard fetches that log every 10 seconds and shows you every signal, its sentiment score, and the result — all without you needing to do anything.",
    },
  ];

  const concepts = [
    {
      term: "Stock",
      def: "A share of ownership in a company. When you buy a stock, you own a small piece of that business. If the company does well, the stock price rises and your investment is worth more.",
    },
    {
      term: "Ticker Symbol",
      def: "A short code that identifies a stock on an exchange. GEV is the ticker for GE Vernova. AAPL is Apple. TSLA is Tesla. These are used everywhere in trading software.",
    },
    {
      term: "RSI — Relative Strength Index",
      def: "A number between 0 and 100 that measures how fast a stock has been moving. A low RSI (e.g. below 10) means the stock dropped sharply very recently. A high RSI (e.g. above 90) means it surged sharply. Extremes in either direction often reverse.",
    },
    {
      term: "RSI(2)",
      def: "RSI calculated over just 2 days instead of the typical 14. This makes it extremely sensitive — it reacts to even a single bad day. The strategy uses this to spot very short-term pullbacks in an uptrending stock.",
    },
    {
      term: "200-Day Moving Average (EMA)",
      def: "The average closing price of a stock over the last 200 days, calculated with more weight on recent days. If the current price is above this line, the stock is generally considered to be in a long-term uptrend. The bot only buys when this condition is true — a safety filter.",
    },
    {
      term: "Pullback",
      def: "A temporary dip in price during an overall uptrend. Buying a pullback means buying the dip — entering when the stock has briefly moved lower, hoping it resumes its upward trend.",
    },
    {
      term: "Paper Trading",
      def: "Trading with simulated money using real market prices. No actual money is at risk. It's used to test whether a strategy works before committing real capital. All trades in TradeCortex are currently paper trades.",
    },
    {
      term: "Webhook",
      def: "An automatic message sent from one piece of software to another when something happens. TradingView uses webhooks to notify TradeCortex the moment a buy or sell signal fires — like a text message between applications.",
    },
    {
      term: "Sentiment Score",
      def: "A number from −1.0 to +1.0 representing the overall tone of recent news. Positive scores mean bullish (good) news. Negative scores mean bearish (bad) news. TradeCortex uses this as a second opinion before placing a trade.",
    },
    {
      term: "Notional Value",
      def: "The dollar amount invested per trade, regardless of how many shares that buys. Set to $500 by default. If GEV costs $380 per share, $500 buys 1.31 fractional shares automatically.",
    },
    {
      term: "Fractional Shares",
      def: "The ability to buy a partial share instead of a whole one. If a stock costs $1,000 but you only want to invest $500, you buy 0.5 shares. Alpaca supports this, which is why the bot can invest exactly $500 regardless of share price.",
    },
    {
      term: "Win Rate",
      def: "The percentage of closed trades that were profitable. A closed trade is a buy followed by a sell. If 7 out of 10 closed trades made money, the win rate is 70%. The dashboard calculates this automatically once sells start arriving.",
    },
  ];

  const faqs = [
    ["Is real money at risk?", "No. TradeCortex is locked to paper trading mode. Every order is simulated on Alpaca's paper account — real market prices, zero real money."],
    ["Why GEV specifically?", "GE Vernova was selected because it's a high-growth energy infrastructure stock with good daily liquidity, strong narrative momentum (nuclear energy, AI power demand), and clean RSI behaviour that suits a pullback strategy."],
    ["What is the RSI(2) Pullback strategy?", "It buys when GEV dips sharply (RSI drops below 10) while still above its 200-day moving average — betting that the dip is temporary. It sells when the stock bounces hard (RSI rises above 90). The idea is to buy weakness in an uptrend and sell into strength."],
    ["What does the AI sentiment actually do?", "It acts as a news filter. Even if the chart says buy, if Claude finds very negative news (score below −0.6), the trade is skipped. It's an extra layer of protection against buying into a stock that's falling for a fundamental reason, not just a technical one."],
    ["How often does it trade?", "RSI(2) is a short-term strategy — signals can fire several times a month on a volatile stock. But because of the 200 EMA filter and sentiment gate, many potential signals get filtered out. Expect a handful of trades per month."],
    ["What does 'Simulated P&L' mean?", "It's what you would have made or lost if these had been real trades. Calculated by pairing each buy with the next sell: (sell price − buy price) × shares bought. It uses real market prices from the time the signals fired."],
  ];

  return (
    <div className="page howto-page">
      {/* Hero */}
      <div className="howto-hero">
        <p className="eyebrow">TRADECORTEX</p>
        <h1 className="howto-headline">How It Works</h1>
        <p className="howto-sub">
          A complete guide to TradeCortex — what it does, how it makes decisions, and the trading concepts behind it. No prior experience needed.
        </p>
      </div>

      <div className="rule" />

      {/* What is TradeCortex */}
      <div className="howto-section">
        <p className="section-label">WHAT IS TRADECORTEX</p>
        <div className="howto-summary-grid">
          <div className="howto-summary-main">
            <p className="howto-body-lg">
              TradeCortex is an automated trading bot. It watches a single stock (GEV) on TradingView 24/7, uses a rule-based strategy to detect buy and sell opportunities, checks today's news sentiment using AI, and places simulated trades on Alpaca — all without any manual input.
            </p>
            <p className="howto-body">
              You set it up once. After that it runs on its own, logs every decision it makes, and displays everything on this dashboard in real time.
            </p>
          </div>
          <div className="howto-summary-aside">
            <div className="aside-stat"><span className="aside-n">4</span><span className="aside-label">AI Agents</span></div>
            <div className="aside-stat"><span className="aside-n">24/7</span><span className="aside-label">Autonomous</span></div>
            <div className="aside-stat"><span className="aside-n">$0</span><span className="aside-label">Real Money at Risk</span></div>
          </div>
        </div>
      </div>

      <div className="rule" />

      {/* Step by step */}
      <div className="howto-section">
        <p className="section-label">STEP BY STEP</p>
        <p className="howto-section-intro">What happens from the moment a signal fires to the moment it appears on this dashboard.</p>
        <div className="steps-list">
          {steps.map((s, i) => (
            <div key={i} className="step-row">
              <span className="step-n">{s.n}</span>
              <div className="step-body">
                <p className="step-title">{s.title}</p>
                <p className="step-text">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rule" />

      {/* Buy / sell signals */}
      <div className="howto-section">
        <p className="section-label">WHEN SIGNALS FIRE</p>
        <p className="howto-section-intro">The exact conditions that trigger a trade.</p>
        <div className="signal-pair">
          <div className="signal-box signal-box-buy">
            <p className="signal-box-label">▲ BUY</p>
            <ul className="signal-list">
              <li>RSI(2) falls <strong>below 10</strong> — stock pulled back sharply</li>
              <li>Price is <strong>above the 200-day EMA</strong> — long-term uptrend confirmed</li>
              <li>No position currently open</li>
              <li>AI sentiment is not strongly negative (score above −0.6)</li>
            </ul>
            <p className="signal-interp">Interpretation: the stock dipped hard inside an uptrend. Historically this bounces.</p>
          </div>
          <div className="signal-box signal-box-sell">
            <p className="signal-box-label">▼ SELL</p>
            <ul className="signal-list">
              <li>RSI(2) rises <strong>above 90</strong> — stock bounced sharply</li>
              <li>A position is currently open</li>
              <li>AI sentiment is not strongly positive (score below +0.6)</li>
            </ul>
            <p className="signal-interp">Interpretation: the stock ran hard in the short term. Time to take profit before the move fades.</p>
          </div>
        </div>
      </div>

      <div className="rule" />

      {/* Trading concepts */}
      <div className="howto-section">
        <p className="section-label">TRADING CONCEPTS</p>
        <p className="howto-section-intro">Every term you'll encounter on this dashboard, explained plainly.</p>
        <div className="concepts-grid">
          {concepts.map((c) => (
            <div key={c.term} className="concept-card">
              <p className="concept-term">{c.term}</p>
              <p className="concept-def">{c.def}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rule" />

      {/* FAQ accordion */}
      <div className="howto-section">
        <p className="section-label">FREQUENTLY ASKED</p>
        <div className="faq-list">
          {faqs.map(([q, a], i) => (
            <div key={i} className="faq-item">
              <button className="faq-q" onClick={() => toggle(i)}>
                <span>{q}</span>
                <span className="faq-icon">{open === i ? "−" : "+"}</span>
              </button>
              {open === i && <p className="faq-a">{a}</p>}
            </div>
          ))}
        </div>
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

  const PAGES = ["Dashboard", "How It Works", "Knowledge Base", "Settings"];

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
        {page === "How It Works" && <HowItWorksPage />}
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
