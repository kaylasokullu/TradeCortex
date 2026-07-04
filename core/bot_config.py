"""
Bot config with file-based overrides.
Lets the dashboard change the stock/settings without redeploying.
"""

import json
import logging
import os
from pathlib import Path

from core.config import settings

logger = logging.getLogger("bot_config")


def _config_path() -> Path:
    trade_log = Path(os.getenv("TRADE_LOG_PATH", "trades.json"))
    return trade_log.parent / "bot_config.json"


def _defaults() -> dict:
    """Defaults sourced from env settings (Railway vars), not hardcoded —
    so DRY_RUN etc. actually takes effect until a value is explicitly saved via /config."""
    return {
        "symbol": settings.SYMBOL,
        "order_notional": settings.ORDER_NOTIONAL,
        "dry_run": settings.DRY_RUN,
    }


def load_bot_config() -> dict:
    """Read config from file; fall back to env-based defaults if missing or corrupt."""
    path = _config_path()
    defaults = _defaults()
    try:
        if path.exists():
            stored = json.loads(path.read_text())
            return {**defaults, **stored}
    except Exception as e:
        logger.warning(f"Could not read bot_config.json: {e}")
    return defaults


def save_bot_config(config: dict) -> None:
    """Persist config to file."""
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2))
    logger.info(f"✅ Bot config saved → {config}")
