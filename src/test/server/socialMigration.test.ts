import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('social share center migration', () => {
  it('is additive, constrained, credential-free, and indexed', () => {
    const sql = fs.readFileSync(path.resolve('src/server/db/migrations/0007_social_share_center.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS social_profiles/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS social_share_events/i);
    expect(sql).toMatch(/CHECK \(status IN \('ready', 'opened'\)\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS social_share_events_created_idx/i);
    expect(sql).not.toMatch(/access_token|refresh_token|client_secret|DROP TABLE|TRUNCATE|DELETE FROM/i);
  });
});
