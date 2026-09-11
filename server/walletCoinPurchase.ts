import { parseCoinAmount, parseLedgerAmount } from "./wallet-ledger";

export interface WalletCoinPurchaseClient {
  query(text: string, values?: unknown[]): Promise<any>;
}

export type WalletCoinPurchaseResult =
  | {
      status: "purchased" | "already_processed";
      purchaseId: number;
      packageId: number;
      packageName: string;
      coins: number;
      amountEGP: number;
      coinBalance: number;
      walletBalanceEGP: number;
    }
  | {
      status: "insufficient_balance";
      requiredEGP: number;
      walletBalanceEGP: number;
    }
  | {
      status: "package_not_found";
    }
  | {
      status: "idempotency_conflict";
      purchaseId: number;
      requestedPackageId: number;
      processedPackageId: number;
    };

/**
 * Buy a coin package from the user's EGP wallet.
 *
 * This is intentionally a small pg-level unit rather than a route-local
 * sequence of queries.  The wallet advisory lock is the same lock used by
 * every EGP-wallet debit, so a coin purchase cannot race a service charge.
 * The idempotency row is written in the same transaction as both ledgers.
 */
export async function purchaseCoinsWithWallet(
  client: WalletCoinPurchaseClient,
  input: { userId: string; packageId: number; idempotencyKey: string },
): Promise<WalletCoinPurchaseResult> {
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`wallet:${input.userId}`],
    );

    const existing = await client.query(
      `SELECT id, package_id, coins, amount_egp, coin_balance, wallet_balance_egp
       FROM wallet_coin_purchases
       WHERE user_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [input.userId, input.idempotencyKey],
    );
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const processedPackageId = Number(row.package_id);
      if (!Number.isInteger(processedPackageId) || processedPackageId !== input.packageId) {
        await client.query("ROLLBACK");
        return {
          status: "idempotency_conflict",
          purchaseId: Number(row.id),
          requestedPackageId: input.packageId,
          processedPackageId,
        };
      }
      await client.query("COMMIT");
      return {
        status: "already_processed",
        purchaseId: Number(row.id),
        packageId: Number(row.package_id),
        packageName: "باقة العملات",
        coins: parseCoinAmount(row.coins, "purchased coin amount"),
        amountEGP: parseLedgerAmount(row.amount_egp, "coin purchase amount"),
        coinBalance: parseCoinAmount(row.coin_balance, "coin wallet balance"),
        walletBalanceEGP: parseLedgerAmount(row.wallet_balance_egp, "wallet balance"),
      };
    }

    const packageResult = await client.query(
      `SELECT id, name, coins, price_egp, bonus_coins
       FROM coin_packages
       WHERE id = $1 AND is_active = true
       FOR SHARE`,
      [input.packageId],
    );
    if (packageResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return { status: "package_not_found" };
    }
    const packageRow = packageResult.rows[0];
    const packageCoins = parseCoinAmount(packageRow.coins, "package coin amount");
    const bonusCoins = packageRow.bonus_coins == null
      ? 0
      : parseLedgerAmount(packageRow.bonus_coins, "package bonus coins");
    if (!Number.isInteger(bonusCoins) || bonusCoins < 0) {
      throw new Error("Invalid package bonus coins");
    }
    const coins = packageCoins + bonusCoins;
    const amountEGP = parseLedgerAmount(packageRow.price_egp, "coin package price");
    if (amountEGP <= 0) throw new Error("Coin package price must be positive");

    const balanceResult = await client.query(
      `SELECT COALESCE(SUM(CASE
         WHEN type IN ('earning', 'wallet_recharge') THEN amount_egp
         WHEN type IN ('spending', 'withdrawal', 'ai_charge') THEN -amount_egp
         ELSE 0
       END), 0)::numeric AS balance
       FROM revenue_transactions
       WHERE user_id = $1`,
      [input.userId],
    );
    const walletBalanceEGP = parseLedgerAmount(
      balanceResult.rows[0]?.balance ?? 0,
      "wallet balance",
    );
    if (walletBalanceEGP < amountEGP) {
      await client.query("ROLLBACK");
      return { status: "insufficient_balance", requiredEGP: amountEGP, walletBalanceEGP };
    }

    const revenue = await client.query(
      `INSERT INTO revenue_transactions (user_id, type, amount_egp, description)
       VALUES ($1, 'spending', $2, $3)
       RETURNING id`,
      [input.userId, amountEGP, `شراء ${coins} عملة من رصيد المحفظة`],
    );
    if (revenue.rowCount !== 1 || revenue.rows.length !== 1) {
      throw new Error("Coin purchase wallet debit was not recorded");
    }

    const wallet = await client.query(
      `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
       VALUES ($1, $2::int, $3::int, 0)
       ON CONFLICT (user_id) DO UPDATE
       SET balance = coin_wallets.balance + EXCLUDED.balance,
           total_spent = coin_wallets.total_spent + EXCLUDED.total_spent,
           updated_at = NOW()
       RETURNING balance`,
      [input.userId, coins, coins],
    );
    if (wallet.rowCount !== 1 || wallet.rows.length !== 1) {
      throw new Error("Coin wallet credit was not recorded");
    }
    const coinBalance = parseCoinAmount(wallet.rows[0].balance, "coin wallet balance");

    const coinTransaction = await client.query(
      `INSERT INTO coin_transactions (user_id, type, coins, description)
       VALUES ($1, 'purchase', $2, $3)
       RETURNING id`,
      [input.userId, coins, `شراء ${coins} عملة من رصيد المحفظة`],
    );
    if (coinTransaction.rowCount !== 1 || coinTransaction.rows.length !== 1) {
      throw new Error("Coin purchase transaction was not recorded");
    }

    const purchase = await client.query(
      `INSERT INTO wallet_coin_purchases
         (user_id, package_id, coins, amount_egp, idempotency_key,
          revenue_transaction_id, coin_transaction_id, coin_balance, wallet_balance_egp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.userId,
        input.packageId,
        coins,
        amountEGP,
        input.idempotencyKey,
        revenue.rows[0].id,
        coinTransaction.rows[0].id,
        coinBalance,
        walletBalanceEGP - amountEGP,
      ],
    );
    if (purchase.rowCount !== 1 || purchase.rows.length !== 1) {
      throw new Error("Coin purchase idempotency record was not recorded");
    }

    await client.query("COMMIT");
    return {
      status: "purchased",
      purchaseId: Number(purchase.rows[0].id),
      packageId: Number(packageRow.id),
      packageName: String(packageRow.name),
      coins,
      amountEGP,
      coinBalance,
      walletBalanceEGP: walletBalanceEGP - amountEGP,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}