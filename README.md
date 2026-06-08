# TradeCortex

An automated paper trading bot that watches GE Vernova (GEV) on TradingView, filters signals through AI sentiment analysis, and executes simulated trades on Alpaca — all running 24/7 with no manual input.

**Live dashboard → [trade-cortex.vercel.app](https://trade-cortex.vercel.app)**

---

## What It Does

- Watches **GEV stock** on TradingView using the RSI(2) Pullback strategy
- When a buy or sell signal fires, TradingView sends an instant webhook to the server
- **Claude AI** searches the web for today's news and scores market sentiment (−1.0 to +1.0)
- If sentiment strongly contradicts the signal, the trade is skipped
- A **paper trade** is placed on Alpaca ($500 of GEV, real prices, no real money)
- Every trade is logged and displayed on the dashboard in real time
- An **email notification** is sent for every trade signal

---

## Accessing the Dashboard

The dashboard is publicly available — no login required.

**→ [https://trade-cortex.vercel.app](https://trade-cortex.vercel.app)**

| Page | What's there |
|---|---|
| **Dashboard** | Live stats, GEV price chart (90 days), cumulative P&L, sentiment history, full trade log |
| **How It Works** | Plain-English explanation of every component, the strategy, trading concepts, and FAQ |
| **Knowledge Base** | Personal log for strategy updates, research notes, and system changes |
| **Settings** | Change the stock symbol or order size (no redeploy needed) |

The dashboard auto-refreshes every 10 seconds. All data comes from the Railway backend.

---

## Architecture

```
TradingView (Pine Script — RSI(2) Pullback on GEV)
        ↓  POST /webhook  (HMAC secret validated)
main.py (FastAPI — Railway)
        ↓
core/orchestrator.py  ← The Brain
        ├── agents/sentiment_agent.py   Claude AI + web search → score −1.0 to +1.0
        ├── agents/broker_agent.py      Alpaca paper trade ($500 notional)
        ├── agents/reporting_agent.py   Appends to trades.json on Railway volume
        └── agents/notification_agent.py  Gmail SMTP alert
        
dashboard/ (React + Vite — Vercel)
        └── Fetches /trades, /market-data, /config every 10s
```

---

## Environment Variables (Railway)

| Variable | Description |
|---|---|
| `WEBHOOK_SECRET` | Secret key included in every TradingView alert |
| `ALPACA_API_KEY` | Alpaca paper account API key |
| `ALPACA_SECRET_KEY` | Alpaca paper account secret key |
| `ANTHROPIC_API_KEY` | Claude API key for sentiment analysis |
| `GMAIL_ADDRESS` | Gmail address to send and receive trade notifications |
| `GMAIL_APP_PASSWORD` | Gmail App Password (16 chars, no spaces) — not your regular password |
| `SYMBOL` | Stock ticker to trade (default: `GEV`) |
| `ORDER_NOTIONAL` | Dollar amount per trade (default: `500`) |
| `DRY_RUN` | `True` = simulate only, `False` = real paper orders (currently `True`) |
| `TRADE_LOG_PATH` | Path to trades file on Railway volume (e.g. `/data/trades.json`) |

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server status check |
| `GET` | `/trades` | All logged trades (used by dashboard) |
| `GET` | `/market-data` | 90-day price bars for configured symbol (Alpaca) |
| `GET` | `/config` | Current bot config (symbol, notional, dry_run) |
| `POST` | `/config` | Update bot config live — no redeploy needed |
| `GET` | `/docs` | Knowledge base entries |
| `POST` | `/docs` | Create a new knowledge base entry |
| `DELETE` | `/docs/{id}` | Delete a knowledge base entry |
| `POST` | `/webhook` | Receives TradingView alerts |
| `POST` | `/test-email` | Sends a test email to verify Gmail is configured |

---

## Testing Locally

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Fill in your API keys

# 3. Run the server
python main.py

# 4. Send a test signal
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{"secret":"change-me-in-production","action":"buy","symbol":"GEV","price":380.00}'

# 5. Test email notification
curl -X POST http://localhost:8000/test-email
```

## Testing Against Production (Railway)

```bash
# Trigger a test trade
curl -X POST https://web-production-c4c98.up.railway.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"secret":"change-me-in-production","action":"buy","symbol":"GEV","price":380.00}'

# Test email
curl -X POST https://web-production-c4c98.up.railway.app/test-email
```

---

## Strategy: RSI(2) Pullback on GEV

**Buy signal fires when:**
- RSI(2) drops below 10 — stock pulled back sharply
- Price is above the 200-day EMA — long-term uptrend confirmed
- AI sentiment score is above −0.6 — news not strongly negative

**Sell signal fires when:**
- RSI(2) rises above 90 — stock bounced hard
- An open position is held
- AI sentiment score is below +0.6 — news not strongly positive

The 200 EMA filter prevents buying into a downtrend. The sentiment gate prevents trading against very strong news.

---

## Deployment

| Component | Platform | Auto-deploy |
|---|---|---|
| Backend (FastAPI) | Railway | ✅ On every push to main |
| Frontend (React) | Vercel | ✅ On every push to main |
| Trade log | Railway Volume (`/data/trades.json`) | Persistent across redeploys |

---

## Notes

- All trades are paper trades — no real money is at risk
- The bot is currently locked to paper mode (cannot be switched to live from the dashboard)
- Never commit `.env` to git — all secrets go in Railway environment variables
- Gmail App Password must be 16 characters with no spaces (remove spaces from the one Gmail generates)
