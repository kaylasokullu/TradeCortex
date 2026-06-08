"""
Notification Agent — sends trade alerts via email (Gmail).
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from core.config import settings

logger = logging.getLogger("notification_agent")


class NotificationAgent:
    def __init__(self):
        self.gmail_address = settings.GMAIL_ADDRESS
        self.gmail_password = settings.GMAIL_APP_PASSWORD
        logger.info("🔔 NotificationAgent initialized")

    async def send(self, message: str) -> None:
        """Send a trade alert email. Falls back to logging if Gmail not configured."""
        if not self.gmail_address or not self.gmail_password:
            logger.info(f"[NOTIFY — no email configured] {message}")
            return

        try:
            msg = MIMEMultipart()
            msg["From"] = self.gmail_address
            msg["To"] = self.gmail_address
            msg["Subject"] = "TradeCortex Alert — GEV Trade"

            msg.attach(MIMEText(message, "plain"))

            with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                server.login(self.gmail_address, self.gmail_password)
                server.sendmail(self.gmail_address, self.gmail_address, msg.as_string())

            logger.info(f"✅ Email sent: {message[:60]}...")

        except Exception as e:
            logger.error(f"Email notification failed: {e}")
            # Never crash the main flow due to a notification error
