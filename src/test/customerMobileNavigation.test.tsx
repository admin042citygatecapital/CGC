import fs from 'node:fs'; import path from 'node:path'; import { describe, expect, it } from 'vitest';
const read=(file:string)=>fs.readFileSync(path.resolve(process.cwd(),file),'utf8');
describe('shared customer mobile navigation',()=>{
  it('provides the required primary destinations',()=>{const nav=read('src/components/CustomerMobileNav.tsx');for(const label of ['Home','Accounts','Transfer','Cards','More']) expect(nav).toContain(label);});
  it('connects every remaining core customer area through More',()=>{const nav=read('src/components/CustomerMobileNav.tsx');for(const pathName of ['wallets','trading','analytics','goals','bills','beneficiaries','statements','notifications','disputes','rewards','security','support','profile','settings']) expect(nav).toContain(`/dashboard/${pathName}`);});
  // The CustomerOnly guard (which attaches the nav) lives in routeGuards.tsx
  // since the react-refresh provider/hook split; routes.tsx only exports the table.
  it('is attached once at the authenticated customer boundary',()=>{const guards=read('src/components/routeGuards.tsx');expect(guards).toContain('<CustomerMobileNav />');expect(guards).toContain('pb-16 md:pb-0');});
});
