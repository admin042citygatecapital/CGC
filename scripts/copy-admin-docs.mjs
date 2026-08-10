import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('docs', 'api-reference');
const target = path.resolve('dist', 'admin-docs');

await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(source, target, { recursive: true });

console.log(JSON.stringify({ ok: true, artifact: 'dist/admin-docs', access: 'admin-only' }));
