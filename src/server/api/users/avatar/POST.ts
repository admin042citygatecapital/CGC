/**
 * POST /api/users/avatar
 * Compatibility route — identical capability to
 * users/profile/avatar-url/POST.ts (upload + persist avatarUrl). Re-exports
 * the same handler rather than duplicating the upload logic.
 */
export { default } from '../profile/avatar-url/POST.js';
