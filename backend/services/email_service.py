import os
import re
import hmac
import hashlib
import secrets
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv
from typing import Tuple

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger("coopconnect.email")

SALT = os.getenv("OTP_SECRET_SALT", "coopconnect_otp_secure_salt_2026")
EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


def normalize_email(email: str) -> Tuple[bool, str]:
    """
    Validates and normalizes an email address.
    Returns (is_valid, normalized_email_lowercase).
    """
    if not email:
        return False, ""
    cleaned = email.strip().lower()
    if re.match(EMAIL_REGEX, cleaned):
        return True, cleaned
    return False, ""


def generate_secure_otp(length: int = 6) -> str:
    """Generates a cryptographically secure 6-digit numeric OTP."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(otp: str, target: str) -> str:
    """
    Generates a secure salted SHA-256 hash of the OTP bound to the recipient target.
    Target should be the normalized email.
    """
    payload = f"{SALT}:{target.strip().lower()}:{otp.strip()}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def verify_otp_hash(submitted_otp: str, target: str, stored_hash: str) -> bool:
    """Timing-attack-resistant comparison of submitted OTP with stored hash."""
    candidate_hash = hash_otp(submitted_otp, target)
    return hmac.compare_digest(candidate_hash, stored_hash)


def send_email_otp(recipient_email: str, otp: str) -> dict:
    """
    Sends CoopConnect verification OTP using Gmail SMTP (or configured SMTP host).
    Supports STARTTLS (port 587) and SSL (port 465).
    Logs errors securely without exposing credentials or OTP content.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip() or "smtp.gmail.com"
    port_str = os.getenv("SMTP_PORT", "587").strip() or "587"
    try:
        smtp_port = int(port_str)
    except ValueError:
        smtp_port = 587

    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()

    # Strip spaces in app password if provided in 4x4 format (e.g. 'xxxx xxxx xxxx xxxx')
    clean_password = smtp_password.replace(" ", "")

    try:
        otp_expiry_seconds = int(os.getenv("OTP_EXPIRY", "300"))
    except ValueError:
        otp_expiry_seconds = 300
    expiry_minutes = max(1, otp_expiry_seconds // 60)

    # Safely mask email addresses for logging
    parts = recipient_email.split("@")
    masked_target = (
        f"{parts[0][:3]}***@{parts[1]}"
        if len(parts) == 2 and len(parts[0]) >= 3
        else "***"
    )

    user_parts = smtp_username.split("@")
    masked_user = (
        f"{user_parts[0][:3]}***@{user_parts[1]}"
        if len(user_parts) == 2 and len(user_parts[0]) >= 3
        else "***"
    )

    if not smtp_username or not clean_password:
        logger.warning(
            "SMTP credentials not configured (SMTP_USERNAME or SMTP_PASSWORD missing)."
        )
        return {
            "success": False,
            "reason": "credentials_missing",
            "message": "SMTP credentials are not configured. Please set SMTP_USERNAME and SMTP_PASSWORD."
        }

    # Construct Multipart MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "CoopConnect Email Verification"
    msg["From"] = f"CoopConnect <{smtp_username}>"
    msg["To"] = recipient_email

    text_body = (
        f"Your CoopConnect verification OTP is: {otp}\n\n"
        f"This OTP is valid for {expiry_minutes} minutes.\n"
        "Do not share this OTP with anyone.\n"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; padding: 20px; }}
    .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }}
    .header {{ text-align: center; margin-bottom: 24px; }}
    .title {{ font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }}
    .subtitle {{ font-size: 14px; color: #64748b; }}
    .otp-box {{ text-align: center; margin: 28px 0; background: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px dashed #cbd5e1; }}
    .otp-code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: 'Courier New', monospace; }}
    .info {{ font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 12px; }}
    .footer {{ text-align: center; margin-top: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">CoopConnect</div>
      <div class="subtitle">Platform for Fair Work Cooperatives</div>
    </div>
    <p class="info">Hello,</p>
    <p class="info">Your CoopConnect verification code is:</p>
    <div class="otp-box">
      <div class="otp-code">{otp}</div>
    </div>
    <p class="info">This code is valid for <strong>{expiry_minutes} minutes</strong>. For security reasons, never share this OTP with anyone.</p>
    <p class="info">If you did not request this verification code, please ignore this email.</p>
    <div class="footer">
      &copy; 2026 CoopConnect. All rights reserved.
    </div>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if smtp_port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=15) as server:
                server.login(smtp_username, clean_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()
                server.login(smtp_username, clean_password)
                server.send_message(msg)

        logger.info(
            "Verification OTP email successfully dispatched to %s via SMTP (%s:%s).",
            masked_target,
            smtp_host,
            smtp_port
        )
        return {
            "success": True,
            "message": "Verification code sent to your email."
        }

    except smtplib.SMTPAuthenticationError as e:
        logger.error(
            "SMTP authentication failed for user %s on %s:%s. Response code: %s",
            masked_user,
            smtp_host,
            smtp_port,
            getattr(e, 'smtp_code', 'auth_failed')
        )
        return {
            "success": False,
            "reason": "auth_error",
            "message": "SMTP authentication failed. Verify your Google App Password and SMTP_USERNAME."
        }

    except smtplib.SMTPConnectError:
        logger.error("Could not connect to SMTP server %s:%s", smtp_host, smtp_port)
        return {
            "success": False,
            "reason": "connection_error",
            "message": "Could not connect to the SMTP server. Check SMTP_HOST and SMTP_PORT."
        }

    except smtplib.SMTPServerDisconnected:
        logger.error("SMTP server disconnected prematurely (%s:%s)", smtp_host, smtp_port)
        return {
            "success": False,
            "reason": "server_disconnected",
            "message": "Mail server disconnected unexpectedly. Please try again."
        }

    except (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused) as e:
        logger.error("SMTP sender or recipient address rejected: %s", type(e).__name__)
        return {
            "success": False,
            "reason": "address_rejected",
            "message": "Mail server rejected the recipient or sender address."
        }

    except (TimeoutError, smtplib.SMTPResponseException) as e:
        logger.error("SMTP timeout or response exception: %s", type(e).__name__)
        return {
            "success": False,
            "reason": "timeout",
            "message": "Connection to mail server timed out or failed to respond. Please try again."
        }

    except smtplib.SMTPException as e:
        logger.error("SMTP error during OTP dispatch: %s", type(e).__name__)
        return {
            "success": False,
            "reason": "smtp_error",
            "message": "Failed to send verification email due to a mail server error."
        }

    except Exception as e:
        logger.error("Unexpected error during OTP email dispatch: %s", type(e).__name__)
        return {
            "success": False,
            "reason": "system_error",
            "message": "Failed to send verification email."
        }