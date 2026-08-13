-- Prevent internal drafts from satisfying controls that require an external
-- authoritative issuer. Metadata only; source documents remain out of scope.

ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS evidence_class TEXT NOT NULL DEFAULT 'internal_design';
ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS external_issuer TEXT;
ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS authority_type TEXT;
ALTER TABLE sponsor_evidence ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE sponsor_evidence_revisions ADD COLUMN IF NOT EXISTS evidence_class TEXT NOT NULL DEFAULT 'internal_design';
ALTER TABLE sponsor_evidence_revisions ADD COLUMN IF NOT EXISTS external_issuer TEXT;
ALTER TABLE sponsor_evidence_revisions ADD COLUMN IF NOT EXISTS authority_type TEXT;
ALTER TABLE sponsor_evidence_revisions ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Existing internal records cannot retain a submitted or approved lifecycle
-- state for these external gates. Record the fail-closed transition before
-- clearing their revision bindings; immutable revisions remain untouched.
INSERT INTO sponsor_evidence_events
  (id, package_id, evidence_id, action, actor_id, actor_role, from_status, to_status, details)
SELECT
  'see_' || md5(e.id || ':external-authority-reclassification'),
  e.package_id,
  e.id,
  'external_authority_reclassification_required',
  'migration_0026',
  'SUPER_ADMIN'::admin_role,
  e.status::text,
  'draft',
  jsonb_build_object(
    'previousStatus', e.status,
    'previousRevision', e.revision,
    'reason', 'External authority metadata is required before resubmission.'
  )
FROM sponsor_evidence e
WHERE e.control_key IN (
  'legal_entity_verified', 'beneficial_owners_verified', 'regulatory_perimeter_opinion',
  'sponsor_term_sheet', 'programme_contract'
)
AND e.status IN ('submitted', 'approved')
AND e.evidence_class <> 'external_authority'
ON CONFLICT (id) DO NOTHING;

UPDATE sponsor_evidence
SET status = 'draft',
    submitted_revision = NULL,
    reviewed_revision = NULL,
    submitted_by = NULL,
    submitted_at = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    review_note = NULL,
    updated_at = NOW()
WHERE control_key IN (
  'legal_entity_verified', 'beneficial_owners_verified', 'regulatory_perimeter_opinion',
  'sponsor_term_sheet', 'programme_contract'
)
AND status IN ('submitted', 'approved')
AND evidence_class <> 'external_authority';

ALTER TABLE sponsor_evidence DROP CONSTRAINT IF EXISTS sponsor_evidence_class_check;
ALTER TABLE sponsor_evidence ADD CONSTRAINT sponsor_evidence_class_check
  CHECK (evidence_class IN ('internal_design', 'external_authority', 'operating_evidence'));

ALTER TABLE sponsor_evidence DROP CONSTRAINT IF EXISTS sponsor_evidence_external_metadata_check;
ALTER TABLE sponsor_evidence ADD CONSTRAINT sponsor_evidence_external_metadata_check CHECK (
  evidence_class <> 'external_authority' OR (
    external_issuer IS NOT NULL AND length(trim(external_issuer)) BETWEEN 3 AND 200 AND
    authority_type IS NOT NULL AND received_at IS NOT NULL
  )
);

ALTER TABLE sponsor_evidence DROP CONSTRAINT IF EXISTS sponsor_evidence_external_gate_check;
ALTER TABLE sponsor_evidence ADD CONSTRAINT sponsor_evidence_external_gate_check CHECK (
  control_key NOT IN ('legal_entity_verified', 'beneficial_owners_verified', 'regulatory_perimeter_opinion', 'sponsor_term_sheet', 'programme_contract') OR
  status IN ('draft', 'rejected', 'expired') OR (
    evidence_class = 'external_authority' AND
    authority_type = CASE control_key
      WHEN 'legal_entity_verified' THEN 'corporate_registry_and_authority'
      WHEN 'beneficial_owners_verified' THEN 'certified_ownership_and_provider_verification'
      WHEN 'regulatory_perimeter_opinion' THEN 'qualified_uk_legal_counsel'
      WHEN 'sponsor_term_sheet' THEN 'authorised_sponsor_institution'
      WHEN 'programme_contract' THEN 'executed_counterparty_agreement'
    END
  )
);

ALTER TABLE sponsor_evidence_revisions DROP CONSTRAINT IF EXISTS sponsor_evidence_revision_class_check;
ALTER TABLE sponsor_evidence_revisions ADD CONSTRAINT sponsor_evidence_revision_class_check
  CHECK (evidence_class IN ('internal_design', 'external_authority', 'operating_evidence'));

ALTER TABLE sponsor_evidence_revisions DROP CONSTRAINT IF EXISTS sponsor_evidence_revision_external_metadata_check;
ALTER TABLE sponsor_evidence_revisions ADD CONSTRAINT sponsor_evidence_revision_external_metadata_check CHECK (
  evidence_class <> 'external_authority' OR (
    external_issuer IS NOT NULL AND length(trim(external_issuer)) BETWEEN 3 AND 200 AND
    authority_type IS NOT NULL AND received_at IS NOT NULL
  )
);
