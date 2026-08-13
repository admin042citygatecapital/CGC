import type { Request, Response } from "express";
import { listCustomerSimulationTransactions } from "../../../lib/customerSimulationLedger.js";

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
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
    const transfers = await listCustomerSimulationTransactions({
      ownerUserId: user.id,
      accountId: String(req.query.accountId ?? "") || undefined,
      limit,
    });
    return res.json(
      serialize({
        transfers,
        total: transfers.length,
        executionSource: "SIMULATION",
        syntheticOnly: true,
      }),
    );
  } catch (error) {
    console.error("customer.simulation.transfers.read.error", error);
    return res
      .status(500)
      .json({ error: "Unable to load simulation transfers." });
  }
}
