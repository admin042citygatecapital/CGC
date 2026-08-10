import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('operations inbox migration', () => {
  it('is additive, idempotent, constrained, and indexed', () => {
    const sql = fs.readFileSync(path.resolve('src/server/db/migrations/0006_operations_inbox.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS operations_items/i);
    expect(sql).toMatch(/UNIQUE \(source, reference_id\)/i);
    expect(sql).toMatch(/CHECK \(status IN/i);
    expect(sql).toMatch(/CHECK \(priority IN/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS operations_items_status_updated_idx/i);
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM/i);
  });
});
