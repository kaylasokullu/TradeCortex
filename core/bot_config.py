"""
Bot config with file-based overrides.
Lets the dashboard change the stock/settings without redeploying.
"""

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger("bot_config")


def _config_path() -> Path:
    trade_log = Path(os.getenv("TRADE_LOG_PATH", "trades.json"))
    return trade_log.parent / "bot_config.json"


DEFAULT_CONFIG = {
    "symbol": "GEV",
    "order_notional": 500.0,
    "dry_run": True,
}


def load_bot_config() -> dict:
    """Read config from file; fall back to defaults if missing or corrupt."""
    path = _config_path()
    try:
        if path.exists():
            stored = json.loads(path.read_text())
            return {**DEFAULT_CONFIG, **stored}
    except Exception as e:
        logger.warning(f"Could not read bot_config.json: {e}")
    return DEFAULT_CONFIG.copy()


def save_bot_config(config: dict) -> None:
    """Persist config to file."""
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2))
    logger.info(f"✅ Bot config saved → {config}")
