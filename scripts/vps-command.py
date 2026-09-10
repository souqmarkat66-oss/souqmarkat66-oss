"""Run an operator-supplied command through fingerprint-verified SSH.

Secrets remain in the process environment; never print command output containing
credentials. This helper does not publish or migrate by itself.
"""
import os
import subprocess
import sys
import tempfile

if os.environ.get("DEPLOY_ROOT", "").rstrip("/") != "/var/www/ads-as":
    raise SystemExit("Refusing unexpected deployment root")

with tempfile.TemporaryDirectory() as directory:
    host = os.environ["DEPLOY_HOST"]
    port = os.environ["DEPLOY_SSH_PORT"]
    scan = subprocess.run(
        ["ssh-keyscan", "-p", port, "-T", "10", "-t", "ed25519", host],
        capture_output=True, text=True, check=True,
    ).stdout
    fingerprint = subprocess.run(
        ["ssh-keygen", "-lf", "-"], input=scan,
        capture_output=True, text=True, check=True,
    ).stdout.split()
    if len(fingerprint) < 2 or fingerprint[1] != os.environ["VPS_SSH_HOST_FINGERPRINT"].strip():
        raise SystemExit("VPS host fingerprint mismatch")
    known_hosts = directory + "/known_hosts"
    with open(known_hosts, "w") as file:
        file.write(scan)
    askpass = directory + "/askpass"
    with open(askpass, "w") as file:
        file.write('#!/bin/sh\nprintf "%s\\n" "$VPS_SSH_PASSWORD"\n')
    os.chmod(askpass, 0o700)
    environment = os.environ.copy()
    environment.update(SSH_ASKPASS=askpass, SSH_ASKPASS_REQUIRE="force", DISPLAY=":0")
    command = [
        "setsid", "-w", "ssh", "-p", port, "-o", "ConnectTimeout=15",
        "-o", "StrictHostKeyChecking=yes", "-o", "UserKnownHostsFile=" + known_hosts,
        "-o", "PreferredAuthentications=password,keyboard-interactive",
        "-o", "PubkeyAuthentication=no", "-o", "NumberOfPasswordPrompts=1",
        os.environ["DEPLOY_USER"] + "@" + host,
        "cd /var/www/ads-as && bash -s",
    ]
    sys.exit(subprocess.run(command, env=environment).returncode)