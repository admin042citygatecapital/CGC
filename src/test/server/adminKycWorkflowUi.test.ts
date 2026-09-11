import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('administrator KYC workflow UI', () => {
  const usersPage = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/users.tsx'), 'utf8');
  const clientEditor = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/ClientEditModal.tsx'), 'utf8');

  it('routes submitted identity evidence into the dedicated review workflow', () => {
    expect(usersPage).toContain('/admin/kyc?search=');
    expect(usersPage).toContain("u.kycStatus === 'submitted'");
    expect(usersPage).not.toContain("onAction(user.id, 'approve_kyc')");
    expect(usersPage).toContain('not yet submitted identity evidence');
  });

  it('offers final activation only after KYC approval and with a rationale', () => {
    expect(usersPage).toContain("u.status === 'pending_approval' && u.kycStatus === 'approved'");
    expect(usersPage).toContain('final registration approval rationale');
    expect(usersPage).toContain('JSON.stringify({ userId, reason })');
  });

  it('uses the CSRF-refreshing request path for protected mutations', () => {
    expect(usersPage).toContain("adminFetch('/api/admin/users/approve'");
    expect(clientEditor).toContain("adminFetch('/api/admin/users/edit'");
  });
});
