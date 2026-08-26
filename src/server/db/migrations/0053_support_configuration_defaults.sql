-- Durable defaults for the PostgreSQL-backed support routing and notification
-- controls. Existing administrator configuration is preserved.

INSERT INTO config (key, value, updated_at, updated_by)
VALUES (
  'support_routing',
  '{"rules":[{"id":"rr_1","category":"KYC","assignTo":"KYC Team","enabled":true},{"id":"rr_2","category":"Transfer","assignTo":"Banking Team","enabled":true},{"id":"rr_3","category":"Wire","assignTo":"Banking Team","enabled":true},{"id":"rr_4","category":"Card","assignTo":"Cards Team","enabled":true},{"id":"rr_5","category":"Exchange","assignTo":"Banking Team","enabled":true},{"id":"rr_6","category":"Account","assignTo":"General Queue","enabled":true},{"id":"rr_7","category":"Other","assignTo":"General Queue","enabled":true}],"updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb,
  NOW(),
  'system:migration'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO config (key, value, updated_at, updated_by)
VALUES (
  'support_notifications',
  '{"urgentTicketInPanel":true,"urgentTicketEmail":true,"noResponseInPanel":true,"noResponseEmail":false,"noResponseHours":24,"reopenedInPanel":true,"reopenedEmail":false,"notifyEmail":"","updatedAt":"1970-01-01T00:00:00.000Z"}'::jsonb,
  NOW(),
  'system:migration'
)
ON CONFLICT (key) DO NOTHING;
