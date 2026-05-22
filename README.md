# TradeCortex
TradeCortex is an AI trading system that automates the full pipeline from TradingView signals all the way to live execution via Alpaca. It is coordinated by intelligent agents and monitored through a real-time React dashboard.


Strategy picked: 
1. Supertrend (ATR 10, multiplier 3) — **TRENDING markets**

The Supertrend, developed by Olivier Seban, is the cleanest mechanical trend-follower available. It plots a single line that flips above/below price based on ATR.

- **Buy rule:** Daily close > Supertrend line AND Supertrend line flips from above price to below price on the current bar (color flip from red to green). Optionally require ADX(14) > 25 for confirmation.
- **Sell rule:** Daily close < Supertrend line (line flips from below to above, green → red). Used as both exit-long and enter-short.
- **NVDA notes:** TrendSpider and FBS both recommend **ATR period 10–14, multiplier 3–4 for swing trading**; for NVDA specifically, use **multiplier 3.5–4** because the standard 3 gets whipsawed during AI-news days. The line itself doubles as a trailing stop.
- **Pine-Script implementation tip:** `ta.supertrend(factor, atrPeriod)` is built into Pine v5 — one line of code.

