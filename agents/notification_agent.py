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
        self.gmail_address = (settings.GMAIL_ADDRESS or "").strip()
        # Strip spaces — Gmail shows app passwords as "xxxx xxxx xxxx xxxx"
        # but SMTP requires them without spaces: "xxxxxxxxxxxxxxxx"
        self.gmail_password = (settings.GMAIL_APP_PASSWORD or "").replace(" ", "").strip()

        if self.gmail_address:
            logger.info(f"🔔 NotificationAgent ready — will email {self.gmail_address}")
        else:
            logger.warning("🔔 NotificationAgent: no GMAIL_ADDRESS set, notifications disabled")

    async def send(self, message: str) -> None:
        """Send a trade alert email. Falls back to logging if Gmail not configured."""
        if not self.gmail_address or not self.gmail_password:
            logger.info(f"[NOTIFY — email not configured] {message}")
            return

        logger.info(f"📧 Attempting email to {self.gmail_address}…")

        # Try SSL on port 465 first, then STARTTLS on port 587 as fallback
        sent = self._try_ssl(message) or self._try_starttls(message)

        if not sent:
            logger.error("❌ Email failed on both port 465 (SSL) and port 587 (STARTTLS)")

    def _build_message(self, body: str) -> MIMEMultipart:
        msg = MIMEMultipart()
        msg["From"] = self.gmail_address
        msg["To"] = self.gmail_address
        msg["Subject"] = "TradeCortex Alert — Trade Signal"
        msg.attach(MIMEText(body, "plain"))
        return msg

    def _try_ssl(self, body: str) -> bool:
        """Attempt send via SMTP_SSL port 465."""
        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
                server.login(self.gmail_address, self.gmail_password)
                server.sendmail(self.gmail_address, self.gmail_address, self._build_message(body).as_string())
            logger.info(f"✅ Email sent (port 465): {body[:60]}…")
            return True
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ Gmail authentication failed (port 465): {e}. Check your App Password in Railway env vars.")
            return False
        except Exception as e:
            logger.warning(f"⚠ Port 465 failed ({type(e).__name__}: {e}), trying port 587…")
            return False

    def _try_starttls(self, body: str) -> bool:
        """Attempt send via STARTTLS port 587."""
        try:
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(self.gmail_address, self.gmail_password)
                server.sendmail(self.gmail_address, self.gmail_address, self._build_message(body).as_string())
            logger.info(f"✅ Email sent (port 587): {body[:60]}…")
            return True
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ Gmail authentication failed (port 587): {e}. Check your App Password in Railway env vars.")
            return False
        except Exception as e:
            logger.error(f"❌ Port 587 failed ({type(e).__name__}: {e})")
            return False
