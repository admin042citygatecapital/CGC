-- Add Nigerian naira support to existing transaction databases.
ALTER TYPE tx_currency ADD VALUE IF NOT EXISTS 'NGN';
