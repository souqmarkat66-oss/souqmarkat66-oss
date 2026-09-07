---
name: Password recovery security
description: Security invariants for OTP-based account recovery.
---

Password recovery must use the same persisted challenge lifecycle for existing and nonexistent identifiers. Store only keyed hashes of identifiers, OTPs, and reset proofs; never authorize a password change from a public user ID.

**Why:** Generic response text alone does not prevent account enumeration when challenge reuse, delivery latency, or rate-limit behavior differs between real and fake accounts.

**How to apply:** Keep six-digit OTPs short-lived and single-use, cap attempts and resends, respond before external delivery, revoke custom and Passport sessions after reset, and regenerate the new session.