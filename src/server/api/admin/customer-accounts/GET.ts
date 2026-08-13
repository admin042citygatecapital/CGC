import type { Request, Response } from "express";
import {
  listCustomerAccounts,
  listPlatformCurrencies,
} from "../../../lib/customerAccountStore.js";
import { safeParseId } from "../../../lib/inputValidator.js";
import { listCustomerSimulationTransactions } from "../../../lib/customerSimulationLedger.js";

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

export default async function handler(req: Request, res: Response) {
  try {
    const rawUserId = String(req.query.userId ?? "").trim();
    const userId = rawUserId
      ? (safeParseId(rawUserId) ?? undefined)
      : undefined;
    if (rawUserId && !userId)
      return res
        .status(400)
        .json({ error: "Invalid customer ID.", code: "INVALID_CUSTOMER_ID" });
    const status = String(req.query.status ?? "").trim();
    const search = String(req.query.search ?? "")
      .trim()
      .slice(0, 100);
    const [accounts, currencies, recentTransactions] = await Promise.all([
      listCustomerAccounts({ userId, status: status || undefined, search }),
      listPlatformCurrencies(),
      listCustomerSimulationTransactions({ ownerUserId: userId, limit: 100 }),
    ]);
    return res.json(
      serialize({
        accounts,
        currencies,
        recentTransactions,
        syntheticOnly: true,
        balanceMutationsAllowed: false,
      }),
    );
  } catch (error) {
    console.error("admin.customer.accounts.read.error", error);
    return res
      .status(500)
      .json({ error: "Unable to load customer account registry." });
  }
}
