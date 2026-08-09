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