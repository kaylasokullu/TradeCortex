"""
Configuration — all secrets come from environment variables / .env file.
Never hardcode keys.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Webhook ───────────────────────────────────────────────────────────────
    WEBHOOK_SECRET: str = "change-me-in-production"

    # ── Alpaca (Paper Trading) ────────────────────────────────────────────────
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_BASE_URL: str = "https://paper-api.alpaca.markets"  # swap for live

    # ── AI Models ─────────────────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""   # Claude (Brain/Orchestrator)
    OPENAI_API_KEY: str = ""      # Optional fallback
    GEMINI_API_KEY: str = ""      # Optional fallback

    # ── Trading Config ────────────────────────────────────────────────────────
    SYMBOL: str = "GEV"
    ORDER_NOTIONAL: float = 500.0   # $ amount per trade (fractional shares)
    DRY_RUN: bool = True            # True = log only, no real orders

    # ── Notifications ─────────────────────────────────────────────────────────
    GMAIL_ADDRESS: str = ""       # Email address to receive trade alerts
    RESEND_API_KEY: str = ""      # From resend.com — used to send emails via HTTP

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
