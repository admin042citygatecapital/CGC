import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeMediaError, validateMediaMetadata, validateMediaUpload } from '../../server/lib/mediaValidation.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('durable media library', () => {
  it('accepts verified media and rejects spoofed names, types, and encodings', () => {
    expect(validateMediaUpload({ originalName: 'city-gate.png', mimeType: 'image/png', dataBase64: png.toString('base64') }).buffer).toEqual(png);
    expect(() => validateMediaUpload({ originalName: '../city-gate.png', mimeType: 'image/png', dataBase64: png.toString('base64') })).toThrow('INVALID_MEDIA_NAME');
    expect(() => validateMediaUpload({ originalName: 'city-gate.exe', mimeType: 'image/png', dataBase64: png.toString('base64') })).toThrow('MEDIA_EXTENSION_MISMATCH');
    expect(() => validateMediaUpload({ originalName: 'city-gate.png', mimeType: 'application/pdf', dataBase64: png.toString('base64') })).toThrow('MEDIA_EXTENSION_MISMATCH');
    expect(() => validateMediaUpload({ originalName: 'city-gate.png', mimeType: 'image/png', dataBase64: 'abc' })).toThrow('INVALID_MEDIA_DATA');
  });

  it('bounds descriptions, tags, folders, and dimensions', () => {
    expect(validateMediaMetadata({ alt: ' Brand mark ', tags: ['logo', 'logo', 'gold'], folder: 'brand', width: 1200, height: 1200 })).toEqual({
      alt: 'Brand mark', tags: ['logo', 'gold'], folder: 'brand', width: 1200, height: 1200,
    });
    expect(() => validateMediaMetadata({ tags: ['x'.repeat(41)] })).toThrow('INVALID_MEDIA_METADATA');
    expect(() => validateMediaMetadata({ folder: '../private' })).toThrow('INVALID_MEDIA_METADATA');
    expect(() => validateMediaMetadata({ width: -1 })).toThrow('INVALID_MEDIA_METADATA');
    expect(safeMediaError(new Error('MEDIA_EXTENSION_MISMATCH')).status).toBe(400);
  });

  it('stores metadata in PostgreSQL and fails closed without managed production storage', () => {
    const migration = fs.readFileSync(path.resolve(process.cwd(), 'src/server/db/migrations/0039_media_library.sql'), 'utf8');
    const store = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/mediaStore.ts'), 'utf8');
    const storage = fs.readFileSync(path.resolve(process.cwd(), 'src/server/lib/supabaseStorage.ts'), 'utf8');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS media_assets');
    expect(migration).toContain('size_bytes > 0 AND size_bytes <= 10485760');
    expect(store).toContain('INSERT INTO media_assets');
    expect(store).toContain("process.env.NODE_ENV === 'production' && !isDatabaseConfigured()");
    expect(storage).toContain("if (process.env.NODE_ENV === 'production') throw new Error('MEDIA_STORAGE_UNAVAILABLE')");
  });

  it('cleans up a newly uploaded object when metadata persistence fails', () => {
    const uploadRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/media/POST.ts'), 'utf8');
    const replaceRoute = fs.readFileSync(path.resolve(process.cwd(), 'src/server/api/admin/media/replace/POST.ts'), 'utf8');
    expect(uploadRoute).toContain('await deleteMedia(filename');
    expect(replaceRoute).toContain('await deleteMedia(filename');
    expect(uploadRoute).not.toContain("message: String(error)");
    expect(replaceRoute).not.toContain("message: String(error)");
  });
});
