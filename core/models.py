"""
Pydantic models — defines what TradingView must send and what we respond with.
"""

from pydantic import BaseModel, field_validator
from typing import Literal, Optional


class TradingViewAlert(BaseModel):
    """
    Exact shape of the JSON payload from your Pine Script alert.

    Pine Script message template:
    {
        "secret":    "{{strategy.custom_var}}",   <- set as Pine input
        "action":    "{{strategy.order.action}}",  <- "buy" or "sell"
        "symbol":    "{{ticker}}",
        "price":     {{close}},
        "strategy":  "Supertrend",
        "timeframe": "{{interval}}",
        "timestamp": "{{time}}"
    }
    """

    secret: str
    action: Literal["buy", "sell"]
    symbol: str
    price: float
    strategy: Optional[str] = "RSI2_Pullback"
    timeframe: Optional[str] = "D"
    timestamp: Optional[str] = None

    @field_validator("symbol")
    @classmethod
    def symbol_must_be_gev(cls, v):
        """Safety guard — only process GEV signals during development."""
        if v.upper() != "GEV":
            raise ValueError(f"Unexpected symbol: {v}. Only GEV is configured.")
        return v.upper()

    @field_validator("price")
    @classmethod
    def price_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Price must be positive")
        return round(v, 2)


class WebhookResponse(BaseModel):
    """What we send back to TradingView (must respond within 3 seconds)."""
    status: str
    action: str
    symbol: str
    message: str
