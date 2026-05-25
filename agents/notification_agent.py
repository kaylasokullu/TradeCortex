"""
Notification Agent — sends trade alerts to Slack.
Add more channels (email, SMS) here later.
"""

import logging
import httpx

from core.config import settings

logger = logging.getLogger("notification_agent")


class NotificationAgent:
    def __init__(self):
        self.slack_url = settings.SLACK_WEBHOOK_URL
        logger.info("🔔 NotificationAgent initialized")

    async def send(self, message: str) -> None:
        """Send a message to Slack (or just log if no webhook configured)."""
        if not self.slack_url:
            logger.info(f"[NOTIFY — no Slack configured] {message}")
            return

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.slack_url,
                    json={"text": message},
                    timeout=5.0,
                )
                if response.status_code == 200:
                    logger.info(f"✅ Slack notified: {message[:60]}...")
                else:
                    logger.warning(f"Slack returned {response.status_code}")
        except Exception as e:
            logger.error(f"Notification failed: {e}")
            # Never crash the main flow due to a notification error
