"""
GEV AI Trading Bot — Webhook Server
Entry point: receives TradingView alerts and routes to orchestrator.
"""

import hmac
import hashlib
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from core.config import settings
from core.models import TradingViewAlert, WebhookResponse
from core.orchestrator import Orchestrator

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("webhook")

# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 GEV Trading Bot starting up...")
    app.state.orchestrator = Orchestrator()
    yield
    logger.info("🛑 Shutting down...")

app = FastAPI(
    title="GEV Trading Bot",
    description="TradingView webhook → AI Orchestrator → Alpaca",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ── Security ──────────────────────────────────────────────────────────────────
# TradingView's known IP addresses (whitelist these in production)
TRADINGVIEW_IPS = {
    "52.89.214.238",
    "34.212.75.30",
    "54.218.53.128",
    "52.32.178.7",
}

async def verify_webhook(request: Request) -> dict:
    """
    Validates:
    1. Request comes from a TradingView IP (optional, good for prod)
    2. Payload contains the correct secret key
    """
    # Optional: uncomment to enforce IP whitelist in production
    # client_ip = request.client.host
    # if client_ip not in TRADINGVIEW_IPS:
    #     logger.warning(f"Rejected request from unknown IP: {client_ip}")
    #     raise HTTPException(status_code=403, detail="IP not whitelisted")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Validate secret
    secret = body.get("secret", "")
    if not hmac.compare_digest(secret, settings.WEBHOOK_SECRET):
        logger.warning("❌ Invalid webhook secret received")
        raise HTTPException(status_code=401, detail="Invalid secret")

    return body

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Simple health check — use this to verify your server is reachable."""
    return {"status": "ok", "symbol": "GEV", "version": "1.0.0"}


@app.get("/trades")
async def get_trades():
    """Returns all logged trades — used by the React dashboard."""
    trades_path = Path("trades.json")
    if not trades_path.exists():
        return []
    return json.loads(trades_path.read_text())


@app.post("/webhook", response_model=WebhookResponse)
async def receive_alert(
    body: dict = Depends(verify_webhook),
    request: Request = None,
):
    """
    Main webhook endpoint.
    TradingView POSTs here when a buy/sell alert fires.

    Expected payload from Pine Script:
    {
        "secret":    "your-secret-key",
        "action":    "buy" | "sell",
        "symbol":    "MSFT",
        "price":     {{close}},
        "strategy":  "Supertrend",
        "timeframe": "{{interval}}",
        "timestamp": "{{time}}"
    }
    """
    try:
        alert = TradingViewAlert(**body)
    except Exception as e:
        logger.error(f"Failed to parse alert payload: {e}")
        raise HTTPException(status_code=422, detail=f"Invalid payload: {e}")

    logger.info(f"📨 Alert received → {alert.action.upper()} {alert.symbol} @ ${alert.price}")

    # Hand off to the orchestrator (non-blocking)
    orchestrator: Orchestrator = request.app.state.orchestrator
    result = await orchestrator.process(alert)

    return WebhookResponse(
        status="received",
        action=alert.action,
        symbol=alert.symbol,
        message=result.get("message", "Processing..."),
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,   # set False in production
        log_level="info",
    )
