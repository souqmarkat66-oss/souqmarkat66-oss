---
name: Live battle accounting
description: Durable accounting rules for PK battles, gift charging, multipliers, and recharge-code rotation.
---

PK battle multipliers are display-score effects only. Wallet debits, broadcaster earnings, and the platform split must always use the original catalog gift value.

**Why:** A client-controlled multiplier or gift price can otherwise inflate payouts or bypass wallet validation.

**How to apply:** Keep gift catalog validation and the atomic wallet transaction on the server; broadcast score state separately from financial transactions.

Recharge-code redemption must lock the code row, credit the wallet, record the transaction, and create/consume a replacement in one database transaction. Expired codes are consumed before issuing their replacement.

**Why:** Retrying a used or expired code must not mint repeated replacement codes or duplicate coins.

**How to apply:** Preserve row locking and transaction boundaries whenever the recharge-code flow changes.

Replacement recharge codes replenish administrator inventory only and must never be returned to the redeemer, including on expired-code responses.

**Why:** Returning another usable equal-value code lets one buyer redeem an unlimited chain even when every individual redemption is atomic.

**How to apply:** Keep internal rotation but omit the replacement from user-facing APIs, notifications, and UI. Only authorized inventory management may reveal it.

New gift receipts credit spendable value once, as EGP earnings; received coin counts are statistics, not another spendable coin balance.

**Why:** Crediting both spendable coins and equivalent EGP allows collaborating broadcasters to repeatedly gift the same value. EGP-to-coin purchases make this a profitable withdrawal loop.

**How to apply:** Preserve the original-value 60/40 split, increment received/earned coin statistics without minting spendable recipient coins, and leave historical balances untouched. Test purchase-to-gift flows together, not just each ledger write in isolation.
**Socket identity:** Socket.IO shares the express-session cookie (`io.engine.use(getSession())`); `send-gift` debits `socket.data.authUserId` and credits the DB stream owner — never trust userId/broadcasterUserId from event payloads, and self-gifting mints no 60% credit.

Per-slot scoring: battle state keeps `playerScores` keyed by socketId (team score = sum only); gift handler increments the validated recipient slot; `live_battles.player_scores` jsonb stores [{team,userId,name,score}] on finish (idempotent ALTER in runMigrations, server/index.ts). Client renders an independent gem badge per slot from the broadcast playerScores map; guest identity resolved from the roster across both teams (never assume team B).
