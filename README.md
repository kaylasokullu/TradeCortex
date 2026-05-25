# MSFT AI Trading Bot

TradingView Supertrend alerts → AI Orchestrator (Claude) → Alpaca paper account

## Architecture

```
TradingView (Pine Script Alert)
        ↓  POST /webhook
main.py (FastAPI server)
        ↓
core/orchestrator.py (Brain)
        ├── agents/sentiment_agent.py  (Claude + web search)
        ├── agents/broker_agent.py     (Alpaca paper orders)
        ├── agents/reporting_agent.py  (trades.json log)
        └── agents/notification_agent.py (Slack)
```

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your real keys

# 3. Run the server
python main.py

# 4. Expose publicly (for TradingView to reach)
# Using ngrok for dev:
ngrok http 8000
# Copy the https URL → paste into TradingView alert webhook field
```

## TradingView Alert Message

Paste this JSON into your TradingView alert "Message" field:

```json
{
  "secret":    "your-webhook-secret",
  "action":    "{{strategy.order.action}}",
  "symbol":    "{{ticker}}",
  "price":     {{close}},
  "strategy":  "Supertrend",
  "timeframe": "{{interval}}",
  "timestamp": "{{time}}"
}
```

## Test the Webhook Manually

```bash
curl -X POST http://localhost:8000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "change-me-to-something-random-and-long",
    "action": "buy",
    "symbol": "MSFT",
    "price": 420.50,
    "strategy": "Supertrend",
    "timeframe": "D",
    "timestamp": "2026-05-25T14:30:00Z"
  }'
```

## Safety Checklist Before Going Live

- [ ] `DRY_RUN=false` only when fully tested
- [ ] Paper trade for at least 30 days first
- [ ] Whitelist TradingView IPs in `main.py` (see comments)
- [ ] Change `WEBHOOK_SECRET` to something long and random
- [ ] Never commit `.env` to git
- [ ] Monitor `trades.json` after every signal
