"""
Broker Agent — places orders on Alpaca paper (or live) account.
Uses notional (dollar amount) ordering for fractional MSFT shares.
"""

import logging
from typing import Any

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

from core.config import settings

logger = logging.getLogger("broker_agent")


class BrokerAgent:
    def __init__(self):
        self._client: TradingClient | None = None
        logger.info("🏦 BrokerAgent initialized (Alpaca Paper)")

    @property
    def client(self) -> TradingClient:
        if self._client is None:
            self._client = TradingClient(
                api_key=settings.ALPACA_API_KEY,
                secret_key=settings.ALPACA_SECRET_KEY,
                paper=True,
            )
        return self._client

    async def execute(
        self,
        symbol: str,
        action: str,
        notional: float,
        dry_run: bool = True,
    ) -> dict[str, Any]:
        """
        Place a market order on Alpaca.

        Args:
            symbol:   Stock ticker (MSFT)
            action:   "buy" or "sell"
            notional: Dollar amount to trade (fractional shares)
            dry_run:  If True, just log — don't actually place the order
        """
        side = OrderSide.BUY if action == "buy" else OrderSide.SELL

        if dry_run:
            logger.info(
                f"[DRY RUN] Would place {side.value.upper()} ${notional} of {symbol}"
            )
            return {
                "success": True,
                "status": "dry_run",
                "side": side.value,
                "symbol": symbol,
                "notional": notional,
                "order_id": "dry-run-no-order",
            }

        try:
            # Check if we hold a position before selling
            if action == "sell":
                position_check = await self._has_position(symbol)
                if not position_check:
                    logger.warning(f"No {symbol} position to sell — skipping")
                    return {
                        "success": False,
                        "status": "skipped",
                        "reason": "No open position to sell",
                    }

            order_data = MarketOrderRequest(
                symbol=symbol,
                notional=notional,       # Buy/sell $X worth (fractional)
                side=side,
                time_in_force=TimeInForce.DAY,
            )

            order = self.client.submit_order(order_data)
            logger.info(f"✅ Order submitted: {order.id} | {side.value} ${notional} {symbol}")

            return {
                "success": True,
                "status": order.status,
                "order_id": str(order.id),
                "symbol": symbol,
                "side": side.value,
                "notional": notional,
            }

        except Exception as e:
            logger.error(f"❌ Order failed: {e}")
            return {
                "success": False,
                "status": "error",
                "error": str(e),
                "symbol": symbol,
            }

    async def _has_position(self, symbol: str) -> bool:
        """Check if we currently hold a position in this symbol."""
        try:
            positions = self.client.get_all_positions()
            return any(p.symbol == symbol for p in positions)
        except Exception:
            return False

    async def get_account_info(self) -> dict:
        """Return current paper account balance and status."""
        try:
            account = self.client.get_account()
            return {
                "buying_power": float(account.buying_power),
                "portfolio_value": float(account.portfolio_value),
                "cash": float(account.cash),
                "status": account.status,
            }
        except Exception as e:
            logger.error(f"Could not fetch account info: {e}")
            return {}
