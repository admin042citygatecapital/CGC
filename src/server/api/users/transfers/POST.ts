import crypto from "node:crypto";
import type { Request, Response } from "express";
import {
  CustomerSimulationLedgerError,
  postCustomerInternalTransfer,
} from "../../../lib/customerSimulationLedger.js";

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

/** Customer-owned, simulation-only internal transfer. No provider, bank,
 * custody, KYC or live-financial route is called by this endpoint. */
export default async function handler(req: Request, res: Response) {
  const user = req.customerUser;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  try {
    const idempotencyKey = String(req.get("Idempotency-Key") ?? "");
    const transaction = await postCustomerInternalTransfer(
      {
        ownerUserId: user.id,
        sourceAccountId: String(req.body?.sourceAccountId ?? ""),
        destinationAccountId: String(req.body?.destinationAccountId ?? ""),
        amount: String(req.body?.amount ?? ""),
        description: String(
          req.body?.description ?? "Internal account transfer",
        ),
        idempotencyKey,
      },
      {
        id: user.id,
        email: user.email,
        ip: req.ip,
        correlationId: String(req.get("X-Request-ID") ?? crypto.randomUUID()),
      },
    );
    return res.status(201).json(
      serialize({
        ok: true,
        transaction,
        reference: transaction.reference,
        executionSource: "SIMULATION",
        syntheticOnly: true,
      }),
    );
  } catch (error) {
    if (error instanceof CustomerSimulationLedgerError) {
      const status =
        error.code === "ACCOUNT_NOT_FOUND"
          ? 404
          : error.code === "IDEMPOTENCY_CONFLICT"
            ? 409
            : 400;
      return res
        .status(status)
        .json({ error: error.message, code: error.code });
    }
    console.error("customer.simulation.transfer.error", error);
    return res
      .status(500)
      .json({ error: "Unable to post the internal simulation transfer." });
  }
}
