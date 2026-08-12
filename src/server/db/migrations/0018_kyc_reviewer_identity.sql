-- Separate KYC review ownership from final registration approval. The prior
-- approved_by column is reserved for the final super-admin registration
-- decision; provider-backed KYC review has its own accountable reviewer.
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_reviewed_by text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_review_reason text;

