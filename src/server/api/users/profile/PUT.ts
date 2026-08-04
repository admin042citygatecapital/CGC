/**
 * PUT /api/users/profile
 * Compatibility route — identical capability to users/me PATCH (profile
 * field updates + optional password change). Re-exports the same handler
 * rather than duplicating the logic.
 */
export { default } from '../me/PATCH.js';
