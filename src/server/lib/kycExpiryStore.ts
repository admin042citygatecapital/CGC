import fs from "fs";
import path from "path";

export interface KYCExpiryRecord {
  userId: string;
  kycSubmissionId: string;
  approvedAt: string;
  expiryDate: string;
  renewalDueDate: string;
  validityMonths: number;
  status: "active" | "expiring_soon" | "expired" | "renewed";
  reminders: {
    sent30: boolean;
    sent14: boolean;
    sent7: boolean;
    sent1: boolean;
  };
}

const DATA_DIR = "/private/kyc";
const EXPIRY_FILE = path.join(DATA_DIR, "expiry.jsonl");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(): KYCExpiryRecord[] {
  ensureDir();
  if (!fs.existsSync(EXPIRY_FILE)) return [];
  const raw = fs.readFileSync(EXPIRY_FILE, "utf-8").trim();
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function writeAll(records: KYCExpiryRecord[]) {
  ensureDir();
  fs.writeFileSync(EXPIRY_FILE, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

export function upsertKYCExpiry(record: KYCExpiryRecord): KYCExpiryRecord {
  const records = readAll();
  const idx = records.findIndex((r) => r.userId === record.userId);
  if (idx === -1) {
    records.push(record);
  } else {
    records[idx] = record;
  }
  writeAll(records);
  return record;
}

export function getExpiryByUserId(userId: string): KYCExpiryRecord | undefined {
  return readAll().find((r) => r.userId === userId);
}

export function getAllExpiry(): KYCExpiryRecord[] {
  return readAll();
}

export function getExpiringWithin(days: number): KYCExpiryRecord[] {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return readAll().filter(
    (r) =>
      r.status !== "expired" &&
      r.status !== "renewed" &&
      new Date(r.expiryDate) >= now &&
      new Date(r.expiryDate) <= future
  );
}

export function updateExpiryReminder(
  userId: string,
  field: "sent30" | "sent14" | "sent7" | "sent1"
): KYCExpiryRecord | undefined {
  const records = readAll();
  const idx = records.findIndex((r) => r.userId === userId);
  if (idx === -1) return undefined;
  records[idx].reminders[field] = true;
  writeAll(records);
  return records[idx];
}
