export interface RiskAssessment {
  score: number;
  level: "low" | "medium" | "high";
  factors: string[];
}

// FATF grey/black list + common fraud origins
const HIGH_RISK_COUNTRIES = [
  "IR", "KP", "MM", "SY", "RU", "BY", "CU", "VE", "AF", "YE", "LY", "SS", "ZW", "SD", "SO",
];
const MEDIUM_RISK_COUNTRIES = [
  "NG", "PK", "UA", "ET", "KE", "GH", "BD", "IN", "BR", "MX", "CO", "PH", "VN", "ID", "TZ",
];

export function calculateRiskScore(submission: {
  country?: string;
  documentType?: string;
  dateOfBirth?: string;
  previousRejections?: number;
  ipAddress?: string;
  isVpn?: boolean;
  duplicateAccountCount?: number;
}): RiskAssessment {
  let score = 0;
  const factors: string[] = [];

  // Country risk (0-35 points)
  const country = submission.country?.toUpperCase() || "";
  if (HIGH_RISK_COUNTRIES.includes(country)) {
    score += 35;
    factors.push("High-risk country of issue");
  } else if (MEDIUM_RISK_COUNTRIES.includes(country)) {
    score += 15;
    factors.push("Medium-risk country of issue");
  }

  // Document type (0-10 points)
  if (submission.documentType === "drivers_license") {
    score += 10;
    factors.push("Driver's license (medium risk)");
  } else if (submission.documentType === "national_id") {
    score += 8;
    factors.push("National ID (medium risk)");
  }

  // Age risk (0-15 points)
  if (submission.dateOfBirth) {
    const age = Math.floor(
      (Date.now() - new Date(submission.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365)
    );
    if (age < 20) {
      score += 15;
      factors.push("Applicant under 20");
    } else if (age > 80) {
      score += 10;
      factors.push("Applicant over 80");
    }
  }

  // VPN/proxy (0-20 points)
  if (submission.isVpn) {
    score += 20;
    factors.push("VPN/proxy detected");
  }

  // Previous rejections (0-25 points)
  const rejections = submission.previousRejections || 0;
  if (rejections >= 3) {
    score += 25;
    factors.push(`${rejections} previous rejections`);
  } else if (rejections >= 1) {
    score += 10 * rejections;
    factors.push(`${rejections} previous rejection(s)`);
  }

  // Multiple accounts (0-15 points)
  const dupes = submission.duplicateAccountCount || 0;
  if (dupes > 0) {
    score += Math.min(15, dupes * 5);
    factors.push(`${dupes} possible duplicate account(s)`);
  }

  score = Math.min(100, score);
  const level: RiskAssessment["level"] = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  return { score, level, factors };
}
