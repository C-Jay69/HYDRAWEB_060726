"""Transactional email via SMTP. Falls back to logging in dev when unconfigured."""

import logging
import smtplib
from email.message import EmailMessage

from ..config import settings

logger = logging.getLogger("hydraweb.email")


def send_mail(to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.info("[email][dev] To=%s Subject=%s\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)
