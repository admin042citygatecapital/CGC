import crypto from "node:crypto";
import { getConfig } from "../../../lib/configStore.js";
import type { Request, Response } from "express";
import { FinancialSandboxError } from "../../../lib/financialSandbox.js";
import { financialSandbox } from "../../../lib/financialSandboxStore.js";
import {
  MoneyMovementSimulationError,
  moneyMovementSimulation,
} from "../../../lib/moneyMovementSimulation.js";

const serialize = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  );

export default async function handler(req: Request, res: Response) {
  if (getConfig().featureToggles.sandboxFinancialControlsEnabled !== true) {
    return res.status(403).json({ error: 'Sandbox financial controls are disabled. A super admin can enable them in Configuration > Feature Toggles. This never enables real money movement.', code: 'SANDBOX_FINANCIAL_CONTROLS_DISABLED' });
  }
  const session = req.adminSession!;
  const actor = {
    id: session.adminId,
    email: session.email,
    ip: req.ip,
    correlationId: String(req.get("X-Request-ID") ?? crypto.randomUUID()),
  };
  const action = String(req.body?.action ?? "");
  const idempotencyKey = String(
    req.get("Idempotency-Key") ?? req.body?.idempotencyKey ?? "",
  );
  try {
    let result: unknown;
    if (action === "create_account")
      result = await financialSandbox.createAccount(
        {
          name: String(req.body?.name ?? ""),
          type: req.body?.type,
          asset: String(req.body?.asset ?? ""),
          idempotencyKey,
        },
        actor,
      );
    else if (action === "transfer" || action === "crypto_transfer")
      result = await financialSandbox.transfer(
        {
          sourceAccountId: String(req.body?.sourceAccountId ?? ""),
          destinationAccountId: String(req.body?.destinationAccountId ?? ""),
          amount: String(req.body?.amount ?? ""),
          reason: String(req.body?.reason ?? ""),
          idempotencyKey,
          crypto: action === "crypto_transfer",
        },
        actor,
      );
    else if (action === "mock_transaction")
      result = await financialSandbox.mock(
        {
          sourceAccountId: String(req.body?.sourceAccountId ?? ""),
          destinationAccountId: String(req.body?.destinationAccountId ?? ""),
          amount: String(req.body?.amount ?? ""),
          reason: String(req.body?.reason ?? ""),
          idempotencyKey,
        },
        actor,
      );
    else if (action === "adjust")
      result = await financialSandbox.adjust(
        {
          accountId: String(req.body?.accountId ?? ""),
          amount: String(req.body?.amount ?? ""),
          direction: req.body?.direction,
          reason: String(req.body?.reason ?? ""),
          reference: String(req.body?.reference ?? ""),
          confirmed: req.body?.confirmed === true,
          idempotencyKey,
        },
        actor,
      );
    else if (action === "reverse")
      result = await financialSandbox.reverse(
        String(req.body?.transactionId ?? ""),
        String(req.body?.reason ?? ""),
        idempotencyKey,
        actor,
      );
    else if (action === "cancel")
      result = await financialSandbox.cancel(
        String(req.body?.transactionId ?? ""),
        String(req.body?.reason ?? ""),
        idempotencyKey,
        actor,
      );
    else if (action === "create_rail_instruction")
      result = await moneyMovementSimulation.create(
        {
          rail: String(req.body?.rail ?? ""),
          direction: String(req.body?.direction ?? ""),
          asset: String(req.body?.asset ?? ""),
          amount: String(req.body?.amount ?? ""),
          sourceReference: String(req.body?.sourceReference ?? ""),
          destinationReference: String(req.body?.destinationReference ?? ""),
          memo: String(req.body?.memo ?? ""),
          scheduledFor: String(req.body?.scheduledFor ?? ""),
          recurrence: String(req.body?.recurrence ?? ""),
          idempotencyKey,
        },
        actor,
      );
    else if (action === "transition_rail_instruction")
      result = await moneyMovementSimulation.transition(
        {
          instructionId: String(req.body?.instructionId ?? ""),
          toStatus: String(req.body?.toStatus ?? ""),
          reason: String(req.body?.reason ?? ""),
          idempotencyKey,
        },
        actor,
      );
    else
      return res
        .status(400)
        .json({
          error: "Unsupported financial sandbox action.",
          code: "INVALID_ACTION",
        });
    return res
      .status(action === "create_account" ? 201 : 200)
      .json(serialize(result));
  } catch (error) {
    if (
      error instanceof FinancialSandboxError ||
      error instanceof MoneyMovementSimulationError
    )
      return res.status(400).json({ error: error.message, code: error.code });
    console.error("financial.sandbox.error", error);
    return res
      .status(500)
      .json({ error: "Financial simulation failed.", code: "INTERNAL_ERROR" });
  }
}
