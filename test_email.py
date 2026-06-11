#!/usr/bin/env python3
import os
import subprocess
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

NODE_MAIL_SCRIPT = os.path.join(os.path.dirname(__file__), "send_otp_email.js")

def mail_config_ready():
    smtp_user = os.environ.get("MAIL_USERNAME", "").strip()
    smtp_pass = os.environ.get("MAIL_APP_PASSWORD", "").replace(" ", "").strip()
    config_ok = bool(smtp_user and smtp_pass and os.path.exists(NODE_MAIL_SCRIPT))
    print(f"MAIL_USERNAME: {smtp_user}")
    print(f"MAIL_APP_PASSWORD: {'*' * len(smtp_pass) if smtp_pass else 'NOT SET'}")
    print(f"NODE_MAIL_SCRIPT exists: {os.path.exists(NODE_MAIL_SCRIPT)}")
    print(f"Config ready: {config_ok}")
    return config_ok

def send_otp_email_with_nodemailer(to_email, otp):
    if not mail_config_ready():
        print("Email error: Nodemailer config or helper script is missing.")
        return False

    try:
        result = subprocess.run(
            ["node", NODE_MAIL_SCRIPT, to_email, otp],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            cwd=os.path.dirname(__file__),
        )
        print(f"Return code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        if result.returncode != 0:
            error_output = result.stderr.strip() or result.stdout.strip() or "unknown error"
            print(f"Email error: {error_output}")
            return False
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

if __name__ == "__main__":
    print("Testing email configuration...")
    print("-" * 50)
    
    test_email = "test@example.com"
    test_otp = "123456"
    
    print(f"\nSending test email to: {test_email}")
    print(f"OTP: {test_otp}")
    print("-" * 50)
    
    success = send_otp_email_with_nodemailer(test_email, test_otp)
    
    print("-" * 50)
    print(f"Result: {'SUCCESS' if success else 'FAILED'}")
