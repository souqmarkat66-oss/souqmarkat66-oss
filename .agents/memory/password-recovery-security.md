---
name: Password recovery security
description: Security invariants for OTP-based account recovery.
---

Password recovery is email-only. New custom-auth accounts must store a normalized valid email, and existing/nonexistent emails must use the same persisted challenge lifecycle. Store only keyed hashes of identifiers, OTPs, and reset proofs; never authorize a password change from a public user ID.

**Why:** Email is the required recovery channel; phone/SMS recovery is intentionally excluded. Generic response text alone also does not prevent account enumeration when challenge reuse, delivery latency, or rate-limit behavior differs between real and fake accounts.

**How to apply:** Require email at registration; use the configured Hostinger `EMAIL_*` SMTP transport on the external VPS and direct `RESEND_API_KEY` only as a fallback when SMTP is absent—never a Replit Connector on the VPS. Keep OTPs short-lived and single-use; cap attempts and resends; respond before delivery; and revoke HTTP, Passport, and socket sessions before regenerating the session.