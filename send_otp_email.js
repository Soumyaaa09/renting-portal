require("dotenv").config({ quiet: true });

const nodemailer = require("nodemailer");

function getEnv(name, normalizeSpaces = false) {
  const value = process.env[name] || "";
  return normalizeSpaces ? value.replace(/\s+/g, "") : value.trim();
}

function buildOtpHtml(otp) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;
                background:#f7f5f2;color:#1a1612;border-radius:16px;padding:40px;
                border:1px solid rgba(30,20,10,0.1);">
      <div style="font-size:1.6rem;font-weight:800;color:#c8522a;margin-bottom:8px;">
        DriveNow
      </div>
      <p style="color:#6b6058;margin-bottom:28px;">Your one-time login code is:</p>
      <div style="font-size:3rem;font-weight:900;letter-spacing:14px;
                  color:#c8522a;text-align:center;padding:20px;
                  background:rgba(200,82,42,0.06);border-radius:12px;
                  border:1px solid rgba(200,82,42,0.15);margin-bottom:24px;">
        ${otp}
      </div>
      <p style="color:#6b6058;font-size:0.85rem;">
        This code expires in <strong style="color:#1a1612;">10 minutes</strong>.
        Do not share it with anyone.
      </p>
    </div>
  `;
}

async function main() {
  const toEmail = process.argv[2];
  const otp = process.argv[3];
  const mailUser = getEnv("MAIL_USERNAME");
  const mailPass = getEnv("MAIL_APP_PASSWORD", true);
  const mailFrom = getEnv("MAIL_FROM") || mailUser;

  if (!toEmail || !otp) {
    throw new Error("Usage: node send_otp_email.js <to_email> <otp>");
  }

  if (!mailUser || !mailPass) {
    throw new Error("MAIL_USERNAME or MAIL_APP_PASSWORD is not configured.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: mailUser,
      pass: mailPass,
    },
  });

  await transporter.sendMail({
    from: mailFrom,
    to: toEmail,
    subject: "Your DriveNow Login OTP",
    html: buildOtpHtml(otp),
  });

  process.stdout.write("OTP email sent");
}

main().catch((error) => {
  process.stderr.write(error.message || String(error));
  process.exit(1);
});
