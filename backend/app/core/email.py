from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def is_password_reset_email_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def send_password_reset_email(email: str, token: str) -> bool:
    if not is_password_reset_email_configured():
        return False
    host = os.environ["SMTP_HOST"]
    sender = os.environ["SMTP_FROM"]

    reset_url = os.getenv("PASSWORD_RESET_URL", "http://localhost:5173/reset-password")
    reset_url = f"{reset_url}?{urlencode({'token': token})}"
    message = EmailMessage()
    message["Subject"] = "Reset your My Kitchen password"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        "Use the link below to reset your My Kitchen password. It expires in 30 minutes.\n\n"
        f"{reset_url}\n\n"
        "If you did not request a reset, you can ignore this email."
    )

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    with smtplib.SMTP(host, port, timeout=10) as client:
        if os.getenv("SMTP_USE_TLS", "true").lower() != "false":
            client.starttls()
        if username and password:
            client.login(username, password)
        client.send_message(message)
    return True