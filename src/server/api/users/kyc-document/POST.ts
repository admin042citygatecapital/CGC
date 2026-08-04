/**
 * POST /api/users/kyc-document
 * Compatibility route — identical capability to users/kyc/upload-url
 * (upload a KYC document via R2/local fallback, persist onto idDocumentUrl
 * or selfieUrl). Re-exports the same handler rather than duplicating the
 * upload logic.
 */
export { default } from '../kyc/upload-url/POST.js';
