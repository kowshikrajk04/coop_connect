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
import requests

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
    Sends CoopConnect OTP using Resend HTTPS API.
    Does not log OTPs or API keys.
    """

    api_key = os.getenv("RESEND_API_KEY", "").strip()

    # Resend's test sender. For production, use your verified domain.
    from_email = os.getenv(
        "RESEND_FROM_EMAIL",
        "CoopConnect <onboarding@resend.dev>"
    ).strip()

    if not api_key:
        logger.error("RESEND_API_KEY is not configured.")
        return {
            "success": False,
            "reason": "credentials_missing",
            "message": "Resend API key is not configured."
        }

    body_text = f"""Your CoopConnect verification OTP is: {otp}

This OTP is valid for 5 minutes.
Do not share this OTP with anyone."""

    payload = {
        "from": from_email,
        "to": [recipient_email],
        "subject": "CoopConnect Email Verification",
        "text": body_text
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    # Mask recipient email for logging
    parts = recipient_email.split("@")
    masked_target = (
        f"{parts[0][:3]}***@{parts[1]}"
        if len(parts) == 2 and len(parts[0]) >= 3
        else "***"
    )

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            json=payload,
            headers=headers,
            timeout=20
        )

        if response.status_code in (200, 201):
            logger.info(
                f"Email OTP accepted by Resend for {masked_target}."
            )
            return {
                "success": True,
                "message": "Verification code sent to your email."
            }

        # Avoid logging credentials or OTP content.
        logger.error(
            "Resend email API failed. HTTP status: %s",
            response.status_code
        )

        if response.status_code == 401:
            return {
                "success": False,
                "reason": "auth_error",
                "message": "Resend API key is invalid or unauthorized."
            }

        if response.status_code == 403:
            return {
                "success": False,
                "reason": "sender_or_permission_error",
                "message": (
                    "Resend rejected the sender or API permission. "
                    "Check your sender domain and API key permissions."
                )
            }

        return {
            "success": False,
            "reason": "resend_error",
            "message": "Resend could not accept the email request."
        }

    except requests.Timeout:
        logger.error("Resend API request timed out.")
        return {
            "success": False,
            "reason": "timeout",
            "message": "Email service timed out. Please try again."
        }

    except requests.RequestException as e:
        logger.error(
            "Resend API network request failed: %s",
            type(e).__name__
        )
        return {
            "success": False,
            "reason": "network_error",
            "message": "Could not connect to the email service."
        }

    except Exception as e:
        logger.error(
            "Unexpected email dispatch error: %s",
            type(e).__name__
        )
        return {
            "success": False,
            "reason": "email_error",
            "message": "Failed to send email OTP."
        }