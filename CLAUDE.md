# TradeCortex — How It All Works

This document explains the logic behind TradeCortex in plain English. No assumed coding knowledge.

---

## The Big Picture

TradeCortex is an automated trading bot. Its job is simple:

> Watch a stock (GEV) on TradingView. When the RSI(2) strategy signals a buy or sell, check the news sentiment using AI, then place a paper trade on Alpaca automatically.

You set it up once. After that, it runs on its own.

---

## How a Trade Actually Happens (Step by Step)

```
1. TradingView is watching GEV on a chart
         ↓
2. RSI(2) indicator fires a buy or sell signal
         ↓
3. TradingView sends a message (webhook) to your server
         ↓
4. Your server receives it and wakes up the Brain (Orchestrator)
         ↓
5. Brain asks Claude: "What's the news on GEV right now?"
         ↓
6. Claude searches the web and returns a sentiment score (-1.0 to +1.0)
         ↓
7. Brain checks: does the sentiment contradict the signal?
   - Trying to BUY but news is very negative? → Skip the trade
   - Trying to SELL but news is very positive? → Skip the trade
   - Otherwise → proceed
         ↓
8. Alpaca places the trade ($500 of GEV, paper account)
         ↓
9. Trade is saved to trades.json
         ↓
10. Dashboard updates automatically to show the new trade
```

---

## What Each File Does

### `main.py` — The Front Door
This is the entry point. Think of it as the receptionist.
- Starts the server on port 8000
- Listens for incoming messages from TradingView
- Checks the secret key to make sure the message is legitimate
- Hands the message off to the Orchestrator
- Has two public URLs: `/health` (is the server alive?) and `/webhook` (receive alerts)

### `core/config.py` — Settings
Reads your `.env` file and makes all your settings available to the rest of the code.
- API keys for Alpaca, Anthropic, Slack
- Which stock to trade (`GEV`)
- How much money per trade (`$500`)
- Whether to actually trade or just pretend (`DRY_RUN`)

Think of it as the settings panel — change things here (via `.env`) without touching any other code.

### `core/models.py` — Shape of the Data
Defines exactly what a valid message from TradingView looks like.
- Must have: `secret`, `action` (buy or sell), `symbol` (GEV), `price`
- Rejects anything that isn't GEV — a safety guard
- Rejects negative prices

Think of it as a form with required fields. If the message doesn't fill in the right fields correctly, it gets rejected before anything else happens.

### `core/orchestrator.py` — The Brain
This is the coordinator. It runs the full pipeline in order.
1. Calls the Sentiment Agent
2. Decides whether to trade based on the sentiment score
3. Calls the Broker Agent to place the order
4. Calls the Reporting Agent to log it
5. Calls the Notification Agent to send a Slack message

Think of it as the manager that delegates tasks to specialists.

---

### `agents/sentiment_agent.py` — The News Analyst
Uses Claude (Anthropic's AI) to search the web for recent GEV news.
- Searches for the last 24 hours of headlines
- Returns a score from -1.0 (very bad news) to +1.0 (very good news)
- Also returns a label: `very_positive`, `positive`, `neutral`, `negative`, `very_negative`
- If it can't reach Claude, it returns neutral (0.0) so trading isn't blocked

**Sentiment gate logic (in orchestrator.py):**
- BUY signal + score below -0.6 → trade skipped (bad news, don't buy)
- SELL signal + score above +0.6 → trade skipped (great news, don't sell)
- Everything else → trade goes through

### `agents/broker_agent.py` — The Trader
Connects to Alpaca and places the actual order.
- Buys or sells $500 worth of GEV (fractional shares)
- If `DRY_RUN=True` in your `.env`, it just logs "would have done this" without actually trading
- Checks if you hold a position before trying to sell (can't sell what you don't own)

### `agents/reporting_agent.py` — The Record Keeper
Saves every trade to a file called `trades.json`.
- Stores: timestamp, symbol, action, price, sentiment score, sentiment summary, order status
- This is what the React dashboard reads to show you your trade history
- Nothing is ever deleted — it's a running log

### `agents/notification_agent.py` — The Messenger
Sends a Slack message every time a trade happens (or gets skipped).
- If you haven't set up Slack, it just logs the message locally instead
- Never crashes the system — if Slack fails, the trade still goes through

---

## The Strategy: RSI(2) Pullback

RSI stands for Relative Strength Index. The (2) means it looks at only the last 2 candles, making it very sensitive to short-term price moves.

**Buy signal:** RSI(2) drops below 10 AND price is above the 200-day moving average
- Interpretation: the stock has pulled back sharply in a long-term uptrend — likely a dip worth buying

**Sell signal:** RSI(2) rises above 90
- Interpretation: the stock has bounced hard in the short term — time to take profit

The 200-day EMA filter is the safety net — it only takes buy signals when the stock is in an overall uptrend, avoiding catching falling knives.

The Pine Script file (`GEV_RSI2_Pullback_Strategy.pine`) is what you load into TradingView. It draws the signals on the chart and fires the webhook alerts automatically.

---

## The Two Layers of the Application

This project has two separate parts that work together:

| Part | What it is | Where it runs |
|------|-----------|---------------|
| **Backend** | Python server (FastAPI) | Your laptop / Railway |
| **Frontend** | React dashboard | Your browser / Vercel |

**Backend** = the engine. Receives webhooks, runs the AI, places trades, saves logs.

**Frontend** = the display. Reads from the backend every 10 seconds and shows you what happened in a nice table.

They talk to each other through one endpoint: `GET /trades` — the dashboard calls this URL and the backend returns the full trade history as JSON.

---

## The `.env` File — Your Control Panel

This file holds all your secrets and settings. It is never committed to GitHub (the `.gitignore` file blocks it).

```
WEBHOOK_SECRET      — a password TradingView includes in every alert so randos can't trigger your trades
ALPACA_API_KEY      — from your Alpaca paper account
ALPACA_SECRET_KEY   — from your Alpaca paper account (different from the API key)
ANTHROPIC_API_KEY   — from console.anthropic.com (lets Claude search for news)
SYMBOL              — the stock to trade (GEV)
ORDER_NOTIONAL      — dollar amount per trade (500 = $500)
DRY_RUN             — True = simulate only, False = real paper trades
SLACK_WEBHOOK_URL   — optional, for trade notifications
```

---

## What ngrok Does

Your server runs on `localhost:8000` — meaning only your own computer can reach it.

ngrok creates a tunnel: it gives your server a public URL on the internet (like `https://abc123.ngrok-free.dev`) so TradingView can send alerts to it from anywhere in the world.

Without ngrok (or a deployed server), TradingView has no way to reach you.

---

## Current Status

| Component | Status |
|-----------|--------|
| Webhook server | ✅ Working |
| Sentiment agent (Claude) | ✅ Working |
| Broker agent (Alpaca) | ⚠️ DRY_RUN=True — needs real keys |
| Reporting agent | ✅ Working |
| Notification agent | ⚠️ No Slack configured |
| React dashboard | ✅ Working locally |
| TradingView wired up | ❌ Not connected yet |
| Running 24/7 | ❌ Needs Railway deployment |
