import type { Request, Response } from "express";
import { getEffectiveCustomerFeatures } from "../../../lib/platformFeatureControls.js";

export default function handler(req: Request, res: Response) {
  if (!req.customerUser)
    return res.status(401).json({ error: "Authentication required" });
  const effective = getEffectiveCustomerFeatures(req.customerUser);
  res.setHeader("Cache-Control", "private, no-store");
  return res.json(effective);
}
