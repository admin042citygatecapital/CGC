import crypto from "node:crypto";
import type { Request, Response } from "express";
import {
  createCustomerAccount,
  CustomerAccountError,
  updateCustomerAccountControls,
} from "../../../lib/customerAccountStore.js";
import {
  CustomerSimulationLedgerError,
  postCustomerControlledAdjustment,
  reverseCustomerSimulationTransaction,
} from "../../../lib/customerSimulationLedger.js";

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );
}

export default async function handler(req: Request, res: Response) {
  const session = req.adminSession!;
  const actor = {
    id: session.adminId,
    email: session.email,
    ip: req.ip,
    correlationId: String(req.get("X-Request-ID") ?? crypto.randomUUID()),
  };
  try {
    const action = String(req.body?.action ?? "create");
    if (action === "create") {
      const account = await createCustomerAccount(
        {
          userId: String(req.body?.userId ?? ""),
          label: String(req.body?.label ?? ""),
          accountType: String(req.body?.accountType ?? ""),
          primaryCurrency: String(req.body?.primaryCurrency ?? ""),
          status: String(req.body?.status ?? "pending"),
          idempotencyKey: String(req.get("Idempotency-Key") ?? ""),
        },
        actor,
      );
      return res.status(201).json(serialize({ account, syntheticOnly: true }));
    }
    if (action === "update_controls") {
      const account = await updateCustomerAccountControls(
        {
          accountId: String(req.body?.accountId ?? ""),
          status: String(req.body?.status ?? ""),
          restrictions: req.body?.restrictions,
          reason: String(req.body?.reason ?? ""),
        },
        actor,
      );
      return res.json(serialize({ account, syntheticOnly: true }));
    }
    if (action === "adjust") {
      const transaction = await postCustomerControlledAdjustment(
        {
          accountId: String(req.body?.accountId ?? ""),
          direction: req.body?.direction === "debit" ? "debit" : "credit",
          amount: String(req.body?.amount ?? ""),
          reference: String(req.body?.reference ?? ""),
          reason: String(req.body?.reason ?? ""),
          opening: req.body?.opening === true,
          idempotencyKey: String(req.get("Idempotency-Key") ?? ""),
        },
        actor,
      );
      return res.status(201).json(
        serialize({
          transaction,
          executionSource: "SIMULATION",
          syntheticOnly: true,
        }),
      );
    }
    if (action === "reverse") {
      const transaction = await reverseCustomerSimulationTransaction(
        {
          transactionId: String(req.body?.transactionId ?? ""),
          reason: String(req.body?.reason ?? ""),
          idempotencyKey: String(req.get("Idempotency-Key") ?? ""),
        },
        actor,
      );
      return res.status(201).json(
        serialize({ transaction, executionSource: "SIMULATION", syntheticOnly: true }),
      );
    }
    return res
      .status(400)
      .json({ error: "Unsupported account action.", code: "INVALID_ACTION" });
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
    if (error instanceof CustomerAccountError) {
      const status = ["CUSTOMER_NOT_FOUND", "ACCOUNT_NOT_FOUND"].includes(
        error.code,
      )
        ? 404
        : error.code === "ACCOUNT_EXISTS" ||
            error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : 400;
      return res
        .status(status)
        .json({ error: error.message, code: error.code });
    }
    console.error("admin.customer.accounts.write.error", error);
    return res
      .status(500)
      .json({ error: "Unable to update customer account registry." });
  }
}
