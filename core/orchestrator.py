"""
Orchestrator — the Brain of the system.
Receives a validated alert and coordinates all agents:
  1. Sentiment Agent  → should we trust this signal?
  2. Broker Agent     → execute on Alpaca
  3. Reporting Agent  → log the trade
  4. Notification Agent → ping Slack
"""

import asyncio
import logging
from typing import Any

from core.models import TradingViewAlert
from core.config import settings
from agents.sentiment_agent import SentimentAgent
from agents.broker_agent import BrokerAgent
from agents.reporting_agent import ReportingAgent
from agents.notification_agent import NotificationAgent

logger = logging.getLogger("orchestrator")


class Orchestrator:
    def __init__(self):
        self.sentiment = SentimentAgent()
        self.broker = BrokerAgent()
        self.reporting = ReportingAgent()
        self.notification = NotificationAgent()
        logger.info("🧠 Orchestrator initialized with all agents ")

    async def process(self, alert: TradingViewAlert) -> dict[str, Any]:
        """
        Full pipeline for a single TradingView alert.

        Flow:
            Alert → Sentiment check → (if confident) → Broker order
                                                      → Reporting log
                                                      → Notification
        """
        logger.info(f"🔄 Processing {alert.action.upper()} signal for {alert.symbol}")

        # ── Step 1: Sentiment Analysis ────────────────────────────────────────
        sentiment_result = await self.sentiment.analyze(alert.symbol)
        logger.info(f"📰 Sentiment: {sentiment_result['score']} ({sentiment_result['label']})")

        # Gate: if sentiment strongly contradicts the signal, skip the trade
        should_trade = self._should_execute(alert, sentiment_result)

        if not should_trade:
            msg = (
                f"⏭️ Skipping {alert.action} — sentiment score {sentiment_result['score']:.2f} "
                f"contradicts signal (label: {sentiment_result['label']})"
            )
            logger.warning(msg)
            await self.notification.send(
                f"[SKIP] {alert.symbol} {alert.action.upper()} blocked by sentiment: "
                f"{sentiment_result['label']}"
            )
            return {"message": msg, "executed": False}

        # ── Step 2: Execute Order via Broker Agent ────────────────────────────
        from core.bot_config import load_bot_config
        bot_cfg = load_bot_config()
        order_result = await self.broker.execute(
            symbol=alert.symbol,
            action=alert.action,
            notional=bot_cfg.get("order_notional", settings.ORDER_NOTIONAL),
            dry_run=bot_cfg.get("dry_run", settings.DRY_RUN),
        )

        # ── Step 3: Log to Reporting Agent ────────────────────────────────────
        await self.reporting.log_trade(
            alert=alert,
            sentiment=sentiment_result,
            order=order_result,
        )

        # ── Step 4: Send Notification ─────────────────────────────────────────
        status_emoji = "✅" if order_result.get("success") else "❌"
        await self.notification.send(
            f"{status_emoji} {alert.symbol} {alert.action.upper()} "
            f"${settings.ORDER_NOTIONAL} | "
            f"Sentiment: {sentiment_result['label']} | "
            f"Price: ${alert.price} | "
            f"{'DRY RUN' if settings.DRY_RUN else 'LIVE'}"
        )

        return {
            "message": f"Order {order_result.get('status', 'processed')}",
            "executed": True,
            "order": order_result,
            "sentiment": sentiment_result,
        }

    def _should_execute(
        self, alert: TradingViewAlert, sentiment: dict[str, Any]
    ) -> bool:
        """
        Simple gating logic — Claude/LLM could make this smarter later.

        Rules:
        - BUY signal + very negative sentiment (-0.6 or lower) → skip
        - SELL signal + very positive sentiment (0.6 or higher) → skip
        - Everything else → proceed
        """
        score = sentiment.get("score", 0.0)

        if alert.action == "buy" and score < -0.6:
            return False
        if alert.action == "sell" and score > 0.6:
            return False

        return True
