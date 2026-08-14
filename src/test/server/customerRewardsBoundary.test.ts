import fs from 'node:fs'; import path from 'node:path'; import { describe, expect, it } from 'vitest';
const read=(file:string)=>fs.readFileSync(path.resolve(process.cwd(),file),'utf8');
describe('customer rewards boundary',()=>{
  it('is controlled by the administrator feature toggle',()=>{const config=read('src/server/lib/configStore.ts');const admin=read('src/pages/admin/config.tsx');const api=read('src/server/api/users/rewards/GET.ts');expect(config).toContain('rewardsEnabled');expect(admin).toContain("['rewardsEnabled'");expect(api).toContain("getSection('featureToggles').rewardsEnabled");});
  it('is read-only for customers and scoped to their authenticated identity',()=>{const entry=read('src/server/entry.ts');const api=read('src/server/api/users/rewards/GET.ts');expect(entry).toContain('app.get("/api/users/rewards"');expect(entry).not.toContain('app.post("/api/users/rewards"');expect(api).toContain('req.customerUser');expect(api).toContain('user_id=${customer.id}');});
  it('does not expose internal admin errors',()=>{const get=read('src/server/api/admin/config/GET.ts');const post=read('src/server/api/admin/config/POST.ts');expect(get).not.toContain('message: String(err)');expect(post).not.toContain('message: String(err)');});
});
