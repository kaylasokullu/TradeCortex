"""
Notification Agent — sends trade alerts via Resend (HTTP API, Railway-compatible).
"""

import logging
import httpx

from core.config import settings

logger = logging.getLogger("notification_agent")


class NotificationAgent:
    def __init__(self):
        self.api_key = (settings.RESEND_API_KEY or "").strip()
        self.to_email = (settings.GMAIL_ADDRESS or "").strip()

        if self.api_key and self.to_email:
            logger.info(f"NotificationAgent ready — will email {self.to_email} via Resend")
        else:
            logger.warning("NotificationAgent: RESEND_API_KEY or GMAIL_ADDRESS not set, notifications disabled")

    async def send(self, message: str) -> None:
        if not self.api_key or not self.to_email:
            logger.info(f"[NOTIFY — email not configured] {message}")
            return

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": "TradeCortex <onboarding@resend.dev>",
                        "to": [self.to_email],
                        "subject": "TradeCortex Alert — Trade Signal",
                        "text": message,
                    },
                )
                if response.status_code == 200:
                    logger.info(f"Email sent via Resend: {message[:60]}...")
                else:
                    logger.error(f"Resend error {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Resend request failed: {e}")
