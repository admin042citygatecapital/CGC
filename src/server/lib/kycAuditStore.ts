import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export interface KYCAuditEntry {
  id: string;
  kycSubmissionId: string;
  userId: string;
  reviewerEmail: string;
  reviewerId: string;
  action:
    | "approved"
    | "rejected"
    | "requested_info"
    | "extended"
    | "revoked"
    | "reset_expiry"
    | "edited_data"
    | "flagged_manual"
    | "assigned";
  previousStatus: string;
  newStatus: string;
  notes?: string;
  reviewerIp: string;
  timestamp: string;
}

const DATA_DIR = "/private/kyc";
const AUDIT_FILE = path.join(DATA_DIR, "audit.jsonl");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function appendKYCAudit(entry: Omit<KYCAuditEntry, "id" | "timestamp">): KYCAuditEntry {
  ensureDir();
  const record: KYCAuditEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(record) + "\n");
  return record;
}

export function getAllKYCAudit(): KYCAuditEntry[] {
  ensureDir();
  if (!fs.existsSync(AUDIT_FILE)) return [];
  const raw = fs.readFileSync(AUDIT_FILE, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function getKYCAuditLog(options?: {
  userId?: string;
  kycId?: string;
  limit?: number;
}): KYCAuditEntry[] {
  let entries = getAllKYCAudit();

  if (options?.userId) {
    entries = entries.filter((e) => e.userId === options.userId);
  }
  if (options?.kycId) {
    entries = entries.filter((e) => e.kycSubmissionId === options.kycId);
  }

  // Sort newest first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (options?.limit && options.limit > 0) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}
