import type { Request, Response } from "express";
import { getEffectiveInternalRoleFeatures } from "../../../lib/platformFeatureControls.js";

export default function handler(req: Request, res: Response): void {
  const role = req.adminSession?.role?.trim().toUpperCase();
  if (!role) {
    res.status(401).json({ error: "Administrator authentication required." });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ role, features: getEffectiveInternalRoleFeatures(role) });
}
