"""Verify replacement SMTP credentials over pinned SSH without sending mail.

Credentials are read only by the runtime, transferred over SSH stdin, never
printed, and never persisted by this diagnostic. It does not change the VPS.
"""
import base64
import json
import os
from pathlib import Path
import subprocess
import sys

user = os.environ.get("VPS_MAIL_USER", "").strip()
password = os.environ.get("VPS_MAIL_PASSWORD", "")
if not user or not password:
    sys.exit("Replacement mail credentials are missing")

payload = base64.b64encode(json.dumps({"user": user, "password": password}).encode()).decode()
remote = r"""
node --env-file=.env <<'SMTP_DIAGNOSTIC_NODE'
(async () => {
  const candidate = JSON.parse(Buffer.from("PAYLOAD", "base64").toString("utf8"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.user)) {
    console.log('MAIL_DIAGNOSTIC={"status":"invalid_mailbox_username"}');
    return;
  }
  const port = Number(process.env.EMAIL_PORT || 465);
  const smtpHost = process.env.EMAIL_HOST;
  if (!smtpHost || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.log('MAIL_DIAGNOSTIC={"status":"invalid_existing_smtp_config"}');
    return;
  }
  const transport = require("nodemailer").createTransport({
    host: smtpHost, port, secure: port === 465, requireTLS: port !== 465,
    auth: { user: candidate.user, pass: candidate.password }, connectionTimeout: 10000, greetingTimeout: 10000,
    socketTimeout: 15000, tls: { minVersion: "TLSv1.2", servername: smtpHost },
  });
  try {
    await transport.verify();
    console.log('MAIL_DIAGNOSTIC={"status":"authenticated","sent":false,"changed":false}');
  } catch (error) {
    console.log("MAIL_DIAGNOSTIC=" + JSON.stringify({
      status: "rejected", code: String(error.code || "unknown").replace(/[^A-Z0-9_]/g, ""),
      responseCode: Number(error.responseCode) || null, sent: false, changed: false,
    }));
  } finally { transport.close(); }
})().catch(() => console.log('MAIL_DIAGNOSTIC={"status":"diagnostic_failed"}'));
SMTP_DIAGNOSTIC_NODE
""".replace("PAYLOAD", payload)
result = subprocess.run(
    [sys.executable, str(Path(__file__).with_name("vps-command.py"))],
    input=remote, text=True, capture_output=True,
)
# Never echo remote stderr: Node diagnostics may reproduce evaluated source.
reports = [line for line in result.stdout.splitlines() if line.startswith("MAIL_DIAGNOSTIC=")]
if not reports:
    sys.exit("Mail verification could not complete; no credentials displayed or settings changed")
for report in reports:
    parsed = json.loads(report.partition("=")[2])
    print(json.dumps(parsed))
    if parsed.get("status") != "authenticated":
        sys.exit(1)