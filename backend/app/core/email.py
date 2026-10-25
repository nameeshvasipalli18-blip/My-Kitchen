from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class PasswordResetEmailError(Exception):
    """Email configuration or delivery failed without exposing provider secrets."""


def _brevo_requested() -> bool:
    return any(os.getenv(key) for key in ("BREVO_API_KEY", "BREVO_TEMPLATE_ID", "BREVO_SENDER_EMAIL"))


def _brevo_template_id() -> int:
    try:
        template_id = int(os.getenv("BREVO_TEMPLATE_ID", ""))
    except ValueError:
        return 0
    return template_id if template_id > 0 else 0


def is_password_reset_email_configured() -> bool:
    if _brevo_requested():
        return bool(os.getenv("BREVO_API_KEY") and os.getenv("BREVO_SENDER_EMAIL") and _brevo_template_id())
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))


def _password_reset_link(token: str) -> str:
    frontend_url = os.getenv("FRONTEND_URL") or os.getenv("VERCEL_FRONTEND_URL") or "http://localhost:5173"
    reset_url = os.getenv("PASSWORD_RESET_URL") or f"{frontend_url.rstrip('/')}/reset-password"
    parts = urlsplit(reset_url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise PasswordResetEmailError("Invalid password reset URL")
    query = [(key, value) for key, value in parse_qsl(parts.query) if key != "token"]
    query.append(("token", token))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _send_brevo_email(email: str, reset_url: str) -> None:
    payload = {
        "sender": {
            "email": os.environ["BREVO_SENDER_EMAIL"],
            "name": os.getenv("BREVO_SENDER_NAME") or "Kitchen split",
        },
        "to": [{"email": email}],
        "templateId": _brevo_template_id(),
        "params": {"RESET_LINK": reset_url},
    }
    try:
        with httpx.Client(timeout=10) as client:
            response = client.post(
                BREVO_API_URL,
                headers={"api-key": os.environ["BREVO_API_KEY"], "accept": "application/json"},
                json=payload,
            )
    except httpx.RequestError as error:
        raise PasswordResetEmailError(f"Unable to connect to Brevo ({type(error).__name__})") from error
    if response.status_code != 201:
        # Log only known provider codes, never raw responses containing user data.
        try:
            body = response.json()
        except ValueError:
            body = None
        code = body.get("code") if isinstance(body, dict) else None
        safe_codes = (
            "invalid_parameter", "missing_parameter", "unauthorized",
            "permission_denied", "document_not_found", "account_under_validation",
            "not_enough_credits", "duplicate_parameter", "method_not_allowed",
            "out_of_range", "bad_request",
        )
        detail = f", code={code}" if code in safe_codes else ""
        raise PasswordResetEmailError(f"Brevo rejected email (HTTP {response.status_code}{detail})")


def _send_smtp_email(email: str, reset_url: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Reset your My Kitchen password"
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = email
    message.set_content(
        "Use the link below to reset your My Kitchen password. It expires in 30 minutes.\n\n"
        f"{reset_url}\n\n"
        "If you did not request a reset, you can ignore this email."
    )

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=10) as client:
        if os.getenv("SMTP_USE_TLS", "true").lower() != "false":
            client.starttls()
        if username and password:
            client.login(username, password)
        client.send_message(message)


def send_password_reset_email(email: str, token: str) -> bool:
    if not is_password_reset_email_configured():
        raise PasswordResetEmailError("Password reset email is not configured")
    reset_url = _password_reset_link(token)
    try:
        if _brevo_requested():
            _send_brevo_email(email, reset_url)
        else:
            _send_smtp_email(email, reset_url)
    except (OSError, smtplib.SMTPException, ValueError) as error:
        raise PasswordResetEmailError("Unable to send password reset email") from error
    return True
