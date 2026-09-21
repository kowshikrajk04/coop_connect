import os
import re
import hmac
import hashlib
import secrets
import logging
import smtplib
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
    Dispatches OTP via Gmail SMTP (TLS on port 587).
    Subject: CoopConnect Email Verification
    Body matches exact specification:
    Your CoopConnect verification OTP is: {OTP}

    This OTP is valid for 5 minutes.
    Do not share this OTP with anyone.
    
    Does NOT log sensitive OTP or credentials.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()

    if not smtp_username or not smtp_password:
        logger.warning("SMTP_USERNAME or SMTP_PASSWORD is not configured in backend/.env.")
        return {
            "success": False,
            "reason": "credentials_missing",
            "message": "Gmail SMTP is not configured. Please set SMTP_USERNAME and SMTP_PASSWORD in backend/.env.",
        }

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "CoopConnect Email Verification"
    msg["From"] = f"CoopConnect <{smtp_username}>"
    msg["To"] = recipient_email

    body_text = f"""Your CoopConnect verification OTP is: {otp}

This OTP is valid for 5 minutes.
Do not share this OTP with anyone."""

    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    # Mask recipient email for logging
    parts = recipient_email.split("@")
    masked_target = f"{parts[0][:3]}***@{parts[1]}" if len(parts) == 2 and len(parts[0]) >= 3 else "***"

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_username, [recipient_email], msg.as_string())

        logger.info(f"Email OTP sent successfully to {masked_target} via Gmail SMTP.")
        return {
            "success": True,
            "message": "Verification code sent to your email."
        }
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"Gmail SMTP authentication failed for {smtp_username}: {e.smtp_error}")
        return {
            "success": False,
            "reason": "auth_error",
            "message": "Gmail SMTP authentication failed. Please verify your Gmail address and 16-character Google App Password."
        }
    except smtplib.SMTPConnectError as e:
        logger.error(f"Gmail SMTP connection failed: {str(e)}")
        return {
            "success": False,
            "reason": "connection_error",
            "message": "Could not connect to Gmail SMTP server. Please check your network connection."
        }
    except Exception as e:
        logger.error(f"Failed to dispatch Email OTP to {masked_target}: {str(e)}")
        return {
            "success": False,
            "reason": "smtp_error",
            "message": f"Failed to send email OTP: {str(e)}"
        }
