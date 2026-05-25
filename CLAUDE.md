# TradeCortex — Webhook Server

FastAPI webhook server that receives TradingView alerts and routes them through an AI-powered trading pipeline.

## Architecture

```
TradingView Alert (Pine Script)
    ↓ POST /webhook
FastAPI Server (main.py)
    ↓
Orchestrator (core/orchestrator.py) — Brain
    ├→ SentimentAgent  → Claude + web search → score (-1.0 to +1.0)
    ├→ BrokerAgent     → Alpaca paper/live trading
    ├→ ReportingAgent  → trades.json log
    └→ NotificationAgent → Slack
```

## Project Structure

```
TradeCortex/
├── main.py                       # FastAPI entry point
├── core/
│   ├── config.py                 # Settings (pydantic-settings, reads .env)
│   ├── models.py                 # TradingViewAlert + WebhookResponse schemas
│   └── orchestrator.py           # Pipeline coordinator
├── agents/
│   ├── sentiment_agent.py        # Claude sentiment analysis
│   ├── broker_agent.py           # Alpaca order execution
│   ├── reporting_agent.py        # JSON trade logging
│   └── notification_agent.py     # Slack notifications
├── .env.example                  # Copy to .env and fill in keys
├── requirements.txt
└── trades.json                   # Created at runtime
```

## Setup

```bash
# 1. Create virtual environment
python -m venv .venv && source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure secrets
cp .env.example .env
# Edit .env and fill in your keys

# 4. Start the server
python -m uvicorn main:app --reload --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/webhook` | Receives TradingView alerts |

## TradingView Alert Payload

```json
{
    "secret":    "your-webhook-secret",
    "action":    "buy",
    "symbol":    "MSFT",
    "price":     420.00,
    "strategy":  "Supertrend",
    "timeframe": "D",
    "timestamp": "2025-01-01T00:00:00Z"
}
```

## Testing Locally

```bash
# Health check
curl http://localhost:8000/health

# Simulate a buy alert (DRY_RUN=True — no real order)
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{"secret":"change-me-in-production","action":"buy","symbol":"MSFT","price":420.00}'
```

## Key Config Flags

| Variable | Default | Notes |
|----------|---------|-------|
| `DRY_RUN` | `True` | Set to `False` only when ready for live trading |
| `ORDER_NOTIONAL` | `500.0` | Dollar amount per trade |
| `SYMBOL` | `MSFT` | Target ticker (validator in models.py enforces this) |

## Sentiment Gate

The orchestrator blocks trades when sentiment strongly contradicts the signal:
- BUY + sentiment score < -0.6 → skipped
- SELL + sentiment score > +0.6 → skipped

Sentiment falls back to neutral (0.0) if Claude is unreachable — trading continues.
