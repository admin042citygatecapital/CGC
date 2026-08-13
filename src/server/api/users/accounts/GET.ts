import type { Request, Response } from "express";
import {
  listCustomerAccounts,
  listPlatformCurrencies,
} from "../../../lib/customerAccountStore.js";

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  try {
    const [accounts, currencies] = await Promise.all([
      listCustomerAccounts({ userId: user.id }),
      listPlatformCurrencies(),
    ]);
    return res.json(
      serialize({
        accounts,
        currencies,
        syntheticOnly: true,
        balancesAuthoritative: false,
      }),
    );
  } catch (error) {
    console.error("customer.accounts.read.error", error);
    return res.status(500).json({ error: "Unable to load customer accounts." });
  }
}
