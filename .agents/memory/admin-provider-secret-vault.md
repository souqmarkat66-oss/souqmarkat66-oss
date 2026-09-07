---
name: Admin provider secret vault
description: Rules for managing provider credentials from the admin dashboard.
---

Environment-managed credentials take precedence. Admin-managed external-provider credentials may be stored only as authenticated AES-GCM ciphertext under a separate environment master key; APIs return metadata, never plaintext.

**Why:** Database and AI/payment credentials must not appear in page source, logs, API responses, or plaintext settings. Database connection credentials are needed before the vault is reachable and cannot self-manage safely.

**How to apply:** Keep a strict provider allowlist, enforce admin plus same-origin checks for mutations, audit only provider/action metadata, and never place `DATABASE_URL` in the vault.