import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');

describe('authenticated global search boundary', () => {
  it('keeps customer results scoped to the authenticated customer', () => {
    const source = read('src/server/api/users/search/GET.ts');
    expect(source).toContain('const customer = req.customerUser');
    expect(source).toContain('WHERE user_id=${customer.id}');
    expect(source).not.toMatch(/req\.(body|query)\.(userId|customerId)/);
    expect(source).not.toMatch(/SELECT[^\n]*(password|token|number_full|cvv|private_key)/i);
  });

  it('returns only masked, operational summaries to administrators', () => {
    const source = read('src/server/api/admin/search/GET.ts');
    expect(source).toContain('cardholder_name,last4,status,type');
    expect(source).not.toMatch(/number_full|numberFull|cvv|password|session_token|private_key/i);
    expect(source).toContain("res.setHeader('Cache-Control', 'no-store')");
  });

  it('registers read-only rate-limited endpoints behind the central auth boundaries', () => {
    const entry = read('src/server/entry.ts');
    expect(entry).toContain("app.use('/api/admin', requireAdminAuthorization)");
    expect(entry).toContain('return requireCustomerAuth(req, res, next)');
    expect(entry).toContain('app.get("/api/users/search", rateLimitMiddleware(');
    expect(entry).toContain('app.get("/api/admin/search", rateLimitMiddleware(');
    expect(entry).not.toMatch(/app\.(post|put|patch|delete)\("\/api\/(users|admin)\/search/);
  });

  it('places customer search behind CustomerOnly and exposes it in mobile navigation', () => {
    const routes = read('src/routes.tsx');
    const navigation = read('src/components/CustomerMobileNav.tsx');
    const adminLayout = read('src/layouts/AdminLayout.tsx');
    expect(routes).toMatch(/path: '\/dashboard\/search'[^\n]*<CustomerOnly>/);
    expect(navigation).toContain("href: '/dashboard/search'");
    expect(adminLayout).toContain('/api/admin/search?q=');
  });
});
