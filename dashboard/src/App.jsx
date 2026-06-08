import { useState, useEffect } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SENTIMENT_COLORS = {
  very_positive: "#16a34a",
  positive: "#4ade80",
  neutral: "#94a3b8",
  negative: "#f87171",
  very_negative: "#dc2626",
};

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function SentimentBadge({ label, score }) {
  return (
    <span className="badge" style={{ background: SENTIMENT_COLORS[label] || "#94a3b8", color: "#fff" }}>
      {label?.replace("_", " ")} ({score?.toFixed(2)})
    </span>
  );
}

function ActionBadge({ action }) {
  return (
    <span className={`badge ${action === "buy" ? "badge-buy" : "badge-sell"}`}>
      {action?.toUpperCase()}
    </span>
  );
}

export default function App() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchTrades = async () => {
    try {
      const res = await fetch(`${API_URL}/trades`);
      if (!res.ok) throw new Error("Failed to fetch trades");
      const data = await res.json();
      setTrades([...data].reverse());
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch {
      setError("Cannot reach backend. Make sure the server is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 10000);
    return () => clearInterval(interval);
  }, []);

  const buys = trades.filter((t) => t.action === "buy");
  const sells = trades.filter((t) => t.action === "sell");
  const successRate = trades.length
    ? Math.round((trades.filter((t) => t.success).length / trades.length) * 100)
    : 0;
  const avgSentiment = trades.length
    ? (trades.reduce((sum, t) => sum + (t.sentiment_score || 0), 0) / trades.length).toFixed(2)
    : "—";

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>TradeCortex</h1>
          <span className="symbol-tag">GEV · RSI(2) Pullback</span>
        </div>
        <div className="header-right">
          <span className="status-dot" />
          <span className="status-text">Live</span>
          {lastUpdated && <span className="last-updated">Updated {lastUpdated}</span>}
          <button className="refresh-btn" onClick={fetchTrades}>↻ Refresh</button>
        </div>
      </header>

      <main className="main">
        {error && <div className="error-banner">{error}</div>}

        <div className="stats-grid">
          <StatCard label="Total Trades" value={trades.length} />
          <StatCard label="Buys" value={buys.length} />
          <StatCard label="Sells" value={sells.length} />
          <StatCard label="Success Rate" value={`${successRate}%`} />
          <StatCard label="Avg Sentiment" value={avgSentiment} sub="−1.0 to +1.0" />
        </div>

        <div className="table-section">
          <h2>Trade History</h2>
          {loading ? (
            <div className="loading">Loading trades...</div>
          ) : trades.length === 0 ? (
            <div className="empty">No trades yet. Send a webhook signal to get started.</div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>Notional</th>
                    <th>Sentiment</th>
                    <th>Summary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{new Date(t.timestamp).toLocaleString()}</td>
                      <td><ActionBadge action={t.action} /></td>
                      <td className="bold">{t.symbol}</td>
                      <td className="mono">${t.price?.toFixed(2)}</td>
                      <td className="mono">${t.notional?.toFixed(0)}</td>
                      <td>
                        <SentimentBadge label={t.sentiment_label} score={t.sentiment_score} />
                      </td>
                      <td className="summary">{t.sentiment_summary || "—"}</td>
                      <td>
                        <span className={`badge ${t.order_status === "dry_run" ? "badge-dry" : "badge-live"}`}>
                          {t.order_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
