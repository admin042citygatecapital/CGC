-- Ongoing sanctions, PEP and adverse-media rescreening state. Provider event
-- records remain append-only; these columns expose only operational status and
-- timestamps, never raw screening documents or credentials.
ALTER TABLE onboarding_cases
  ADD COLUMN IF NOT EXISTS screening_status TEXT NOT NULL DEFAULT 'not_run',
  ADD COLUMN IF NOT EXISTS last_screened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_screening_at TIMESTAMPTZ;

ALTER TABLE onboarding_provider_events
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS screened_at TIMESTAMPTZ;

ALTER TABLE onboarding_cases DROP CONSTRAINT IF EXISTS onboarding_cases_screening_status_check;
ALTER TABLE onboarding_cases ADD CONSTRAINT onboarding_cases_screening_status_check
  CHECK (screening_status IN ('not_run', 'clear', 'review', 'match', 'overdue'));

ALTER TABLE onboarding_provider_events DROP CONSTRAINT IF EXISTS onboarding_provider_events_purpose_check;
ALTER TABLE onboarding_provider_events ADD CONSTRAINT onboarding_provider_events_purpose_check
  CHECK (purpose IN ('onboarding', 'rescreen'));

CREATE INDEX IF NOT EXISTS onboarding_cases_screening_due_idx
  ON onboarding_cases(screening_status, next_screening_at);
