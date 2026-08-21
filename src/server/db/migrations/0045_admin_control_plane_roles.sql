-- Extend the existing staff-role enum without changing or deleting data.
-- PostgreSQL enum additions are intentionally additive and non-destructive.
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'CONTENT_ADMIN';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'OPERATIONS_ADMIN';
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'AUDITOR';
