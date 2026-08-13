import type { Request, Response } from "express";
import { FINANCIAL_CAPABILITY_MAP } from "../../../lib/financialCapabilityMap.js";
import { FinancialSandboxError } from "../../../lib/financialSandbox.js";
import { financialSandbox } from "../../../lib/financialSandboxStore.js";
import { moneyMovementSimulation } from "../../../lib/moneyMovementSimulation.js";

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

export default async function handler(req: Request, res: Response) {
  try {
    const transactionId = String(req.query.transactionId ?? "").trim();
    if (transactionId) {
      const transaction = await financialSandbox.getTransaction(transactionId);
      return res.json(
        serialize({
          data: transaction,
          syntheticOnly: true,
          executionSource: "SIMULATION",
        }),
      );
    }
    const [result, accounts, overview, railInstructions] = await Promise.all([
      financialSandbox.listTransactions({
        search: String(req.query.search ?? ""),
        status: String(req.query.status ?? ""),
        asset: String(req.query.asset ?? ""),
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 20),
      }),
      financialSandbox.listAccounts(),
      financialSandbox.getOverview(),
      moneyMovementSimulation.list({ limit: 100 }),
    ]);
    return res.json(
      serialize({
        ...result,
        accounts,
        overview,
        railInstructions,
        capabilities: FINANCIAL_CAPABILITY_MAP,
        syntheticOnly: true,
        executionSource: "SIMULATION",
        liveProviderAdaptersImplemented: false,
      }),
    );
  } catch (error) {
    if (error instanceof FinancialSandboxError)
      return res.status(400).json({ error: error.message, code: error.code });
    console.error("financial.sandbox.read.error", error);
    return res.status(500).json({
      error: "Financial simulation could not be read.",
      code: "INTERNAL_ERROR",
    });
  }
}
