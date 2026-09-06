---
name: GitHub sync authentication
description: Distinguishes Replit connector API access from Git CLI credentials used for repository pushes.
---

Treat the GitHub connector and `git push` authentication as separate channels. A working connector does not prove that the Git CLI credential is valid, and connector API calls are not a reliable substitute for pushing a Git object graph.

**Why:** Connector reads and a tiny API write can succeed while the Git CLI token is rejected and bulk source-blob requests through the connector are blocked before reaching GitHub. Reconstructing commits through the API adds risk without repairing the actual credential.

**How to apply:** Verify the remote head before pushing. If normal HTTPS/SSH Git authentication fails, refresh Git authentication in Replit or replace the GitHub secret through Secrets, then retry a normal non-force push. Do not move the remote ref through connector APIs after partial blob uploads.