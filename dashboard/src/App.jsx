import { useState, useEffect } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const PAGES = ["Dashboard", "How It Works", "Settings"];

const SENTIMENT_COLOR = (score) => {
  if (score >= 0.6) return "#00c853";
  if (score >= 0.2) return "#69f0ae";
  if (score > -0.2) return "#90a4ae";
  if (score > -0.6) return "#ff6e6e";
  return "#d50000";
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function calculatePnL(trades) {
  const sorted = [...trades].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const completed = [];
  const buyQueue = [];

  for (const t of sorted) {
    if (t.action === "buy") {
      buyQueue.push(t);
    } else if (t.action === "sell" && buyQueue.length > 0) {
      const buy = buyQueue.shift();
      const shares = buy.notional / buy.price;
      const pnl = (t.price - buy.price) * shares;
      completed.push({ buy, sell: t, pnl });
    }
  }

  const total = completed.reduce((s, t) => s + t.pnl, 0);
  const wins = completed.filter((t) => t.pnl > 0).length;
  return {
    totalPnL: total,
    completed,
    winRate: completed.length > 0 ? Math.round((wins / completed.length) * 100) : null,
  };
}

// ── Small components ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={accent ? { "--accent": accent } : {}}>
      <div className="stat-value" style={accent ? { color: accent } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function ActionBadge({ action }) {
  return (
    <span className={`badge ${action === "buy" ? "badge-buy" : "badge-sell"}`}>
      {action === "buy" ? "▲ BUY" : "▼ SELL"}
    </span>
  );
}

function SentimentBadge({ label, score }) {
  const c = SENTIMENT_COLOR(score ?? 0);
  return (
    <span className="badge" style={{ background: c + "1a", color: c, border: `1px solid ${c}40` }}>
      {(score >= 0 ? "+" : "") + (score ?? 0).toFixed(2)}
    </span>
  );
}

function ModeBadge({ status }) {
  if (status === "dry_run") return <span className="badge badge-sim">Simulated</span>;
  if (status === "accepted" || status === "filled") return <span className="badge badge-live">Live</span>;
  return <span className="badge badge-sim">{status}</span>;
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
function DashboardPage({ trades, loading, error, lastUpdated, onRefresh }) {
  const buys = trades.filter((t) => t.action === "buy");
  const sells = trades.filter((t) => t.action === "sell");
  const { totalPnL, completed, winRate } = calculatePnL(trades);

  const avgSentiment =
    trades.length > 0
      ? trades.reduce((s, t) => s + (t.sentiment_score ?? 0), 0) / trades.length
      : null;

  const pnlColor = totalPnL >= 0 ? "#00c853" : "#d50000";
  const sentimentColor = avgSentiment != null ? SENTIMENT_COLOR(avgSentiment) : undefined;

  return (
    <div>
      {error && (
        <div className="error-banner">
          ⚠️ {error} —{" "}
          <a href={`${API_URL}/health`} target="_blank" rel="noreferrer">
            check server
          </a>
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Total Signals" value={trades.length} sub="all time" />
        <StatCard label="Buys" value={buys.length} accent="#00c853" />
        <StatCard label="Sells" value={sells.length} accent="#d50000" />
        <StatCard
          label="Simulated P&L"
          value={
            completed.length > 0
              ? `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(0)}`
              : "—"
          }
          sub={completed.length > 0 ? `${completed.length} closed trades` : "No closed trades yet"}
          accent={completed.length > 0 ? pnlColor : undefined}
        />
        <StatCard
          label="Win Rate"
          value={winRate != null ? `${winRate}%` : "—"}
          sub={
            completed.length > 0
              ? `${completed.filter((t) => t.pnl > 0).length}W / ${completed.filter((t) => t.pnl <= 0).length}L`
              : "Need a buy + sell pair"
          }
          accent={winRate != null ? (winRate >= 50 ? "#00c853" : "#d50000") : undefined}
        />
        <StatCard
          label="Avg Sentiment"
          value={avgSentiment != null ? (avgSentiment >= 0 ? "+" : "") + avgSentiment.toFixed(2) : "—"}
          sub={
            avgSentiment == null
              ? "No data"
              : avgSentiment > 0.4
              ? "Broadly positive news"
              : avgSentiment < -0.4
              ? "Broadly negative news"
              : "Mixed / neutral news"
          }
          accent={sentimentColor}
        />
      </div>

      <div className="table-section">
        <div className="section-header">
          <h2>Trade Log</h2>
          <div className="section-meta">
            {lastUpdated && <span className="last-updated">Auto-refreshes · last at {lastUpdated}</span>}
            <button className="refresh-btn" onClick={onRefresh}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" />
            <p>Loading trades…</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No trades yet.</p>
            <p className="empty-sub">
              When TradingView fires a signal, it will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Action</th>
                  <th>Stock</th>
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
                    <td className="mono">{new Date(t.timestamp).toLocaleString()}</td>
                    <td>
                      <ActionBadge action={t.action} />
                    </td>
                    <td className="bold">{t.symbol}</td>
                    <td className="mono">${t.price?.toFixed(2)}</td>
                    <td className="mono">${t.notional?.toFixed(0)}</td>
                    <td>
                      <SentimentBadge label={t.sentiment_label} score={t.sentiment_score} />
                    </td>
                    <td className="summary">{t.sentiment_summary || "—"}</td>
                    <td>
                      <ModeBadge status={t.order_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── How It Works Page ─────────────────────────────────────────────────────────
function HowItWorksPage() {
  return (
    <div className="howto-page">
      <div className="howto-hero">
        <h2>How TradeCortex Works</h2>
        <p>A plain-English guide — no trading experience needed.</p>
      </div>

      {/* Flow */}
      <div className="howto-section">
        <h3 className="section-title">What happens on every trade</h3>
        <div className="flow-list">
          {[
            ["📈", "TradingView watches GEV stock", "GE Vernova (GEV) is tracked live on a chart using a rule-based strategy. TradingView runs continuously 24/7 and checks the chart on every new candle."],
            ["🔔", "A buy or sell signal fires", "The RSI(2) Pullback strategy detects when the stock has dipped sharply (buy) or bounced strongly (sell) — see the signal rules below."],
            ["📡", "TradingView pings your server", "TradingView sends a tiny JSON message (called a \"webhook\") to your Railway server with the action, stock symbol, and price. This is instant — like a text message."],
            ["🤖", "Claude AI reads today's news", "The AI searches the web for the last 24 hours of news about GEV and scores the overall tone: from −1.0 (terrible news) to +1.0 (great news)."],
            ["🧠", "The Brain decides whether to trade", "If the signal says BUY but news is very negative (below −0.6) → skip. If signal says SELL but news is very positive (above +0.6) → skip. Otherwise → proceed."],
            ["💼", "Alpaca places the trade", "Alpaca is a brokerage with a paper trading mode. In paper trading, trades use real market prices but no real money. $500 of GEV is bought or sold in fractional shares."],
            ["📊", "This dashboard updates", "Every 10 seconds, this page fetches the latest trade log and displays it in the table above. You can see each trade, its AI sentiment, and whether it was executed or skipped."],
          ].map(([icon, title, body], i) => (
            <div key={i} className="flow-item">
              <div className="flow-step">{i + 1}</div>
              <div className="flow-icon">{icon}</div>
              <div>
                <div className="flow-title">{title}</div>
                <div className="flow-body">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal rules */}
      <div className="howto-section">
        <h3 className="section-title">When does a signal fire?</h3>
        <div className="signal-grid">
          <div className="signal-card signal-buy">
            <div className="signal-heading">▲ BUY Signal</div>
            <ul>
              <li>RSI(2) drops <strong>below 10</strong></li>
              <li>Stock is <strong>above the 200-day moving average</strong> (uptrend filter)</li>
              <li>No position is currently open</li>
              <li>AI sentiment is not strongly negative (&gt; −0.6)</li>
            </ul>
            <div className="signal-meaning">
              Translation: the stock pulled back sharply inside a long-term uptrend — historically a good entry point.
            </div>
          </div>
          <div className="signal-card signal-sell">
            <div className="signal-heading">▼ SELL Signal</div>
            <ul>
              <li>RSI(2) rises <strong>above 90</strong></li>
              <li>A position is currently open</li>
              <li>AI sentiment is not strongly positive (&lt; +0.6)</li>
            </ul>
            <div className="signal-meaning">
              Translation: the stock bounced hard in the short term — time to take profit before it fades.
            </div>
          </div>
        </div>
      </div>

      {/* Strategy explainer */}
      <div className="howto-section">
        <h3 className="section-title">Understanding the strategy</h3>
        <div className="explainer-grid">
          {[
            ["What is RSI?", "RSI (Relative Strength Index) measures how fast a stock has moved up or down. A very low RSI means the stock dropped quickly. A very high RSI means it shot up fast. Both extremes often reverse."],
            ["Why RSI(2)?", "Using just 2 days makes RSI hyper-sensitive to short-term swings. This strategy catches quick bounces, not long-term holds. Typical trades last a few days, not weeks."],
            ["What is the 200 EMA filter?", "The 200-day Exponential Moving Average is a smoothed line representing the last 200 days of prices. If price is above it, the stock is in a long-term uptrend. The bot only buys in uptrends — to avoid catching a falling knife."],
            ["What is paper trading?", "Paper trading uses real market prices but no real money. It lets you test a strategy risk-free. When you're confident it works, you can switch to live trading in Settings."],
          ].map(([title, body]) => (
            <div key={title} className="explainer-card">
              <div className="explainer-title">{title}</div>
              <div className="explainer-body">{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Glossary */}
      <div className="howto-section">
        <h3 className="section-title">Quick glossary</h3>
        <div className="glossary-grid">
          {[
            ["Webhook", "A message sent automatically by TradingView to your server when an alert fires. Like a text message, but from software to software."],
            ["Sentiment Score", "−1.0 to +1.0. Represents the overall tone of recent news. +1.0 = great news, bullish. −1.0 = bad news, bearish. 0 = neutral / mixed."],
            ["Notional", "Dollar amount per trade. Set to $500 by default. Alpaca converts this into fractional shares automatically."],
            ["Simulated / Dry Run", "The bot runs the full pipeline (sentiment, decision, log) but doesn't submit a real order to Alpaca. Safe for testing."],
            ["200 EMA", "A smoothed 200-day moving average line on the chart. Price above it = uptrend. Price below it = downtrend."],
            ["Fractional Shares", "Buying a piece of a share instead of the whole thing. $500 ÷ $380/share = 1.31 shares. Alpaca supports this automatically."],
          ].map(([term, def]) => (
            <div key={term} className="glossary-item">
              <div className="glossary-term">{term}</div>
              <div className="glossary-def">{def}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage({ config, onSave }) {
  const [symbol, setSymbol] = useState(config?.symbol || "GEV");
  const [notional, setNotional] = useState(config?.order_notional || 500);
  const [dryRun, setDryRun] = useState(config?.dry_run ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.toUpperCase().trim(),
          order_notional: parseFloat(notional),
          dry_run: dryRun,
        }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const updated = await res.json();
      onSave(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setErr(`Could not save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-hero">
        <h2>Bot Settings</h2>
        <p>Change the stock, order size, or switch between paper and live trading. No redeploy needed.</p>
      </div>

      {err && <div className="error-banner">⚠️ {err}</div>}
      {saved && (
        <div className="success-banner">
          ✅ Settings saved. The bot will use these on the next trade signal.
        </div>
      )}

      <div className="settings-grid">
        <div className="settings-card">
          <label className="settings-label">Stock Symbol</label>
          <input
            className="settings-input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="e.g. GEV, AAPL, NVDA"
            maxLength={6}
          />
          <div className="settings-hint">
            ⚠️ After changing this, you must also switch your TradingView chart to the same stock. The bot will reject signals that don't match this symbol.
          </div>
        </div>

        <div className="settings-card">
          <label className="settings-label">Dollar Amount Per Trade</label>
          <div className="prefix-wrap">
            <span className="prefix">$</span>
            <input
              className="settings-input has-prefix"
              type="number"
              value={notional}
              onChange={(e) => setNotional(e.target.value)}
              min={1}
              max={100000}
            />
          </div>
          <div className="settings-hint">
            Alpaca will automatically buy or sell fractional shares worth this amount.
          </div>
        </div>

        <div className="settings-card">
          <label className="settings-label">Trading Mode</label>
          <div className="toggle-row">
            <button
              className={`toggle-btn ${dryRun ? "toggle-on" : "toggle-off"}`}
              onClick={() => setDryRun(true)}
            >
              🧪 Paper (Simulated)
            </button>
            <button
              className={`toggle-btn ${!dryRun ? "toggle-on-live" : "toggle-off"}`}
              onClick={() => setDryRun(false)}
            >
              🔴 Live Trading
            </button>
          </div>
          <div className="settings-hint">
            {dryRun
              ? "Runs the full AI pipeline but no real orders are submitted to Alpaca."
              : "⚠️ Real paper trades will be placed on Alpaca. Confirm your API keys are set in Railway."}
          </div>
        </div>
      </div>

      <button className="save-btn" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Changes"}
      </button>

      <div className="settings-info-box">
        <h3>How changing the stock works</h3>
        <ol>
          <li>Enter the new ticker above (e.g. <strong>NVDA</strong>) and click Save.</li>
          <li>Open TradingView, load the same chart on that stock, and re-add the Pine Script strategy.</li>
          <li>
            Create a new alert pointing to{" "}
            <code>https://web-production-c4c98.up.railway.app/webhook</code>.
          </li>
          <li>The bot will now validate and trade the new symbol.</li>
        </ol>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
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
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTrades([...data].reverse());
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch {
      setError("Cannot reach the backend. Check that Railway is running.");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/config`);
      if (res.ok) setConfig(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchTrades();
    fetchConfig();
    const iv = setInterval(fetchTrades, 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">TradeCortex</span>
          <span className="symbol-chip">{config?.symbol || "GEV"} · RSI(2)</span>
          <span className={`mode-chip ${config?.dry_run === false ? "chip-live" : "chip-paper"}`}>
            {config?.dry_run === false ? "● LIVE" : "● PAPER"}
          </span>
        </div>
        <nav className="nav">
          {PAGES.map((p) => (
            <button
              key={p}
              className={`nav-btn${page === p ? " nav-active" : ""}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        {page === "Dashboard" && (
          <DashboardPage
            trades={trades}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
            onRefresh={fetchTrades}
          />
        )}
        {page === "How It Works" && <HowItWorksPage />}
        {page === "Settings" && <SettingsPage config={config} onSave={setConfig} />}
      </main>
    </div>
  );
}
