"""
Reporting Agent — logs all trades to a local JSON file.
Later: this feeds your React dashboard.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from core.models import TradingViewAlert

logger = logging.getLogger("reporting_agent")

TRADE_LOG_PATH = Path("trades.json")


class ReportingAgent:
    def __init__(self):
        # Create the log file if it doesn't exist
        if not TRADE_LOG_PATH.exists():
            TRADE_LOG_PATH.write_text(json.dumps([]))
        logger.info("📊 ReportingAgent initialized")

    async def log_trade(
        self,
        alert: TradingViewAlert,
        sentiment: dict,
        order: dict,
    ) -> None:
        """Append a trade record to trades.json."""
        record = {
            "id": f"trade_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symbol": alert.symbol,
            "action": alert.action,
            "price": alert.price,
            "strategy": alert.strategy,
            "timeframe": alert.timeframe,
            "sentiment_score": sentiment.get("score"),
            "sentiment_label": sentiment.get("label"),
            "sentiment_summary": sentiment.get("summary"),
            "order_status": order.get("status"),
            "order_id": order.get("order_id"),
            "notional": order.get("notional"),
            "success": order.get("success"),
        }

        try:
            existing = json.loads(TRADE_LOG_PATH.read_text())
            existing.append(record)
            TRADE_LOG_PATH.write_text(json.dumps(existing, indent=2))
            logger.info(f"📝 Trade logged: {record['id']}")
        except Exception as e:
            logger.error(f"Failed to write trade log: {e}")
