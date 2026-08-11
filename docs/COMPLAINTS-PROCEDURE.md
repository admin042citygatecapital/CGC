# Complaints control procedure

## Scope and status

This control records formal complaints and their handling history for sponsor-readiness. It does not claim FCA authorisation, define a statutory deadline, or enable any financial operation. `COMPLAINT_RESPONSE_TARGET_DAYS` is an internal operational target only and must be reviewed by UK financial-services counsel and the selected sponsor before a controlled pilot.

## Operating procedure

1. Support or Compliance logs the complaint with the customer reference, category, severity, description, and controlled HTTPS evidence references. Sensitive documents and credentials must not be stored in this register.
2. The complaint receives an internal response target and an immutable creation event.
3. The operator moves the case through `open`, `investigating`, and, where appropriate, `escalated`. Potential reportable, systemic, vulnerable-customer, sanctions, or financial-crime matters must be marked for regulatory escalation and referred to Compliance.
4. Resolution requires meaningful remediation notes. A resolved case may be reopened for investigation or closed after review.
5. Every change records the administrator, timestamp, prior status, new status, and non-sensitive control metadata in the append-only event ledger and central audit log.

## Governance prerequisites

Before any controlled customer pilot, counsel and the sponsor must approve the complaint definition, acknowledgement and final-response templates, applicable response/reporting deadlines, Financial Ombudsman Service wording and eligibility, vulnerable-customer handling, root-cause analysis, management information, retention, and escalation thresholds.
