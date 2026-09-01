import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { assertKycCaseVersionUpdated } from '../../server/lib/kycPrivateStore';
import { createKycObjectKey, MAX_KYC_DOCUMENT_BYTES, sanitizeOriginalFilename, validateAndSanitizeKycDocument } from '../../server/lib/kycStorage';

describe('private KYC evidence boundary',()=>{
  it('fails a stale case-version update so the surrounding transaction rolls back',()=>{
    expect(assertKycCaseVersionUpdated([{ id: 'case-1' }])).toEqual({ id: 'case-1' });
    expect(() => assertKycCaseVersionUpdated([])).toThrow(/workflow changed/i);
    try {
      assertKycCaseVersionUpdated([]);
    } catch (error) {
      expect(error).toMatchObject({ code: 'WORKFLOW_CONFLICT' });
    }
  });
  it('uses opaque object keys without customer identity',()=>{
    const key=createKycObjectKey('case-with-customer@example.test','kd_0123456789abcdef01234567','application/pdf');
    expect(key).toMatch(/^cases\/[a-f0-9]{24}\/kd_[a-f0-9]{24}\.pdf$/);
    expect(key).not.toContain('@');
    expect(key).not.toContain('customer');
  });
  it('decodes and re-encodes images while removing metadata',async()=>{
    const image=new PNG({width:4,height:4}); image.data.fill(255);
    const source=PNG.sync.write(image);
    const result=await validateAndSanitizeKycDocument(source,'image/png');
    expect(result.mimeType).toBe('image/png');
    const decoded=PNG.sync.read(result.bytes);
    expect(decoded.width).toBe(4);
  });
  it('rejects MIME mismatches, active PDFs, unsupported files and oversized data',async()=>{
    const image=new PNG({width:2,height:2}); const png=PNG.sync.write(image);
    await expect(validateAndSanitizeKycDocument(png,'image/jpeg')).rejects.toThrow(/signature|image/i);
    await expect(validateAndSanitizeKycDocument(Buffer.from('%PDF-1.7\n/JavaScript\n%%EOF'),'application/pdf')).rejects.toThrow(/active|encrypted/i);
    await expect(validateAndSanitizeKycDocument(Buffer.from('<svg/>'),'image/svg+xml')).rejects.toThrow(/JPEG|PNG|PDF/);
    await expect(validateAndSanitizeKycDocument(Buffer.alloc(MAX_KYC_DOCUMENT_BYTES+1),'application/pdf')).rejects.toThrow(/5 MB/);
  });
  it('removes traversal and does not preserve unsafe names',()=>{
    expect(sanitizeOriginalFilename('../../passport<script>.pdf','application/pdf')).toBe('passportscript.pdf');
    expect(sanitizeOriginalFilename('wrong.exe','image/jpeg')).toBe('document.jpg');
  });
});
