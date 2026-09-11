"""Verify replacement SMTP credentials over pinned SSH without sending mail.

Credentials are read only by the runtime, transferred over SSH stdin, never
printed. Defaults to read-only. --apply-password verifies first, then updates
only EMAIL_PASS and reloads the existing app; it never publishes code or schema.
"""
import base64
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--existing-user", action="store_true",
                    help="Test the new password against the existing VPS mailbox without changing it")
parser.add_argument("--apply-password", action="store_true",
                    help="After verification, update only the existing mailbox password")
args = parser.parse_args()
if args.apply_password and not args.existing_user:
    sys.exit("Password repair requires --existing-user")
user = os.environ.get("VPS_MAIL_USER", "").strip()
password = os.environ.get("VPS_MAIL_PASSWORD", "")
if (not user and not args.existing_user) or not password:
    sys.exit("Replacement mail credentials are missing")

payload = base64.b64encode(json.dumps({
    "user": user, "password": password, "existingUser": args.existing_user,
    "apply": args.apply_password, "app": os.environ.get("DEPLOY_PM2_APP", ""),
    "healthUrl": os.environ.get("DEPLOY_HEALTH_URL", ""),
}).encode()).decode()
remote = r"""
node --env-file=.env <<'SMTP_DIAGNOSTIC_NODE'
(async () => {
  const candidate = JSON.parse(Buffer.from("PAYLOAD", "base64").toString("utf8"));
  if (candidate.existingUser) candidate.user = (process.env.EMAIL_USER || "").trim();
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
    if (!candidate.apply) {
      console.log('MAIL_DIAGNOSTIC={"status":"authenticated","sent":false,"changed":false}');
      return;
    }
    const fs = require("fs");
    const { execFileSync } = require("child_process");
    const root = "/var/www/ads-as";
    if (process.cwd() !== root || !candidate.app) throw Error("Invalid target");
    const apps = JSON.parse(execFileSync("pm2", ["jlist"], {encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
    const app = apps.find(item => item.name === candidate.app);
    if (!app || app.pm2_env?.pm_cwd !== root ||
        app.pm2_env?.pm_exec_path !== root + "/dist/index.cjs" ||
        app.pm2_env?.status !== "online") throw Error("Unexpected runtime");
    const currentEnv = { ...process.env };
    for (const [key,value] of Object.entries(app.pm2_env)) {
      if (/^[A-Z_][A-Z0-9_]*$/.test(key) && typeof value === "string") currentEnv[key] = value;
    }
    Object.assign(currentEnv, app.pm2_env.env || {});
    const port = Number(currentEnv.PORT || 5000);
    if (port === 8080 || !Number.isInteger(port) || port < 1 || port > 65535) throw Error("Unexpected app port");
    const publicHealth = new URL(candidate.healthUrl);
    if (!["http:","https:"].includes(publicHealth.protocol)) throw Error("Invalid health URL");
    if (publicHealth.pathname === "/") publicHealth.pathname = "/api/health";
    if (publicHealth.pathname !== "/api/health") throw Error("Invalid health path");
    const urls = [`http://127.0.0.1:${port}/api/health`, publicHealth.toString()];
    const healthy = async () => {
      for (const url of urls) {
        const response = await fetch(url, {signal:AbortSignal.timeout(7000)});
        if (!response.ok) return false;
        const body = await response.json();
        if (body.status !== "ok") return false;
      }
      return true;
    };
    if (!(await healthy())) throw Error("Existing app unhealthy");
    const envPath = root + "/.env";
    const original = fs.readFileSync(envPath, "utf8");
    const stat = fs.statSync(envPath);
    const matches = [...original.matchAll(/^[ \t]*EMAIL_PASS[ \t]*=.*$/gm)];
    if (matches.length !== 1 || /[\r\n]/.test(candidate.password) ||
        (candidate.password.includes("'") && (candidate.password.includes('"') || candidate.password.includes("\\")))) {
      throw Error("Unsupported env serialization");
    }
    const quote = candidate.password.includes("'") ? '"' : "'";
    const replacement = original.replace(/^[ \t]*EMAIL_PASS[ \t]*=.*$/m,
      () => "EMAIL_PASS=" + quote + candidate.password + quote);
    const atomicWrite = content => {
      const temp = envPath + ".mail-repair-" + require("crypto").randomUUID();
      try {
        fs.writeFileSync(temp, content, {mode:0o600,flag:"wx"});
        fs.chownSync(temp, stat.uid, stat.gid);
        fs.renameSync(temp, envPath);
      } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    };
    const reload = pass => execFileSync("pm2", ["reload", String(app.pm_id), "--update-env"], {
      env:{...currentEnv,EMAIL_PASS:pass}, stdio:["ignore","pipe","pipe"], timeout:60000,
    });
    let changed = false;
    try {
      if (fs.readFileSync(envPath,"utf8") !== original) throw Error("Environment changed concurrently");
      atomicWrite(replacement);
      changed = true;
      reload(candidate.password);
      let ok = false;
      for (let attempt=0; attempt<10; attempt++) {
        try { if (await healthy()) {ok=true;break;} } catch {}
        await new Promise(resolve=>setTimeout(resolve,1500));
      }
      if (!ok) throw Error("Post-reload health failed");
      console.log('MAIL_DIAGNOSTIC={"status":"applied","smtpAuthenticated":true,"health":true,"sent":false,"changed":true,"codePublished":false}');
    } catch {
      if (changed) {
        let restored=false;
        try { atomicWrite(original); reload(currentEnv.EMAIL_PASS); restored=true; } catch {}
        console.log("MAIL_DIAGNOSTIC=" + JSON.stringify({status:"apply_failed",restored,sent:false}));
      } else console.log('MAIL_DIAGNOSTIC={"status":"preflight_failed","changed":false,"sent":false}');
    }
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
    if parsed.get("status") not in ("authenticated", "applied"):
        sys.exit(1)