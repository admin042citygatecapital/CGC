/**
 * GET /api/admin/kyc/:userId
 * Real per-user KYC review detail: the customer's self-reported KYC fields
 * (there's no OCR/document-extraction pipeline in this codebase, so
 * "extractedData" reflects what the customer actually submitted, not
 * fabricated OCR output), the real risk score (kycStore.computeKycRiskScore),
 * and the real admin notes trail (kycStore.getKycNotesForUser).
 */
import type { Request, Response } from 'express';
import { findUserById } from '../../../../lib/userStore.js';
import { computeKycRiskScore, getKycNotesForUser } from '../../../../lib/kycStore.js';

export default async function handler(req: Request, res: Response) {
  const { userId } = req.params as { userId: string };
  const user = await findUserById(userId);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

  const notes = await getKycNotesForUser(userId);
  const latestNote = notes.length > 0 ? notes[notes.length - 1].note : '';

  const documents: Record<string, string> = {};
  if (user.idDocumentUrl) { documents['ID Front'] = user.idDocumentUrl; }
  if (user.selfieUrl) { documents['Selfie'] = user.selfieUrl; }

  const extractedData: Record<string, string> = {};
  if (user.idType) extractedData['ID Type'] = user.idType;
  if (user.idNumber) extractedData['ID Number'] = user.idNumber;
  if (user.dateOfBirth) extractedData['Date of Birth'] = user.dateOfBirth;
  if (user.address) extractedData['Address'] = user.address;
  if (user.city) extractedData['City'] = user.city;
  if (user.postalCode) extractedData['Postal Code'] = user.postalCode;
  if (user.country) extractedData['Country'] = user.country;

  return res.json({
    userId: user.id,
    fullName: user.name,
    email: user.email,
    status: user.kycStatus,
    riskScore: computeKycRiskScore(user),
    documentType: user.idType ?? 'Unknown',
    countryName: user.country ?? 'Unknown',
    submittedAt: user.kycSubmittedAt ?? '',
    documents,
    extractedData,
    adminNotes: latestNote,
  });
}
