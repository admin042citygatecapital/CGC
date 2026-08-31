import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CustomerRelationshipError, validateRelationship } from '../../server/lib/customerRelationshipStore.js';
import { allowedRolesForAdminRequest } from '../../server/lib/adminAuthorizationMiddleware.js';

describe('customer relationship administration controls', () => {
  it('restricts relationship reads and writes to the super-administrator policy', () => {
    expect(allowedRolesForAdminRequest('/customer-relationships', 'GET')).toEqual([]);
    expect(allowedRolesForAdminRequest('/customer-relationships', 'POST')).toEqual([]);
  });

  it('rejects self-links and unsupported relationship types', () => {
    expect(() => validateRelationship({ customerId: 'user_1', relatedCustomerId: 'user_1', relationshipType: 'beneficiary' })).toThrowError(CustomerRelationshipError);
    expect(() => validateRelationship({ customerId: 'user_1', relatedCustomerId: 'user_2', relationshipType: 'administrator' })).toThrowError(CustomerRelationshipError);
    expect(() => validateRelationship({ customerId: 'user_1', relatedCustomerId: 'user_2', relationshipType: 'joint_holder' })).not.toThrow();
  });

  it('uses database constraints to prevent duplicate and self relationships', () => {
    const migration = readFileSync('src/server/db/migrations/0027_customer_relationships.sql', 'utf8');
    expect(migration).toContain('customer_id <> related_customer_id');
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS customer_relationships_unique_idx');
    expect(migration).toContain('ALTER TABLE customer_relationships ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL ON TABLE customer_relationships FROM PUBLIC');
  });

  it('records critical audit intent before relationship mutations', () => {
    const store = readFileSync('src/server/lib/customerRelationshipStore.ts', 'utf8');
    expect(store).toContain("event: 'customer_relationship_create_intent'");
    expect(store).toContain("event: 'customer_relationship_update_intent'");
    expect(store.indexOf("event: 'customer_relationship_create_intent'")).toBeLessThan(store.indexOf('insert(customerRelationships)'));
  });

  it('exposes create, select and edit navigation in the customer administration area', () => {
    const layout = readFileSync('src/layouts/AdminLayout.tsx', 'utf8');
    const routes = readFileSync('src/routes.tsx', 'utf8');
    const users = readFileSync('src/pages/admin/users.tsx', 'utf8');
    const page = readFileSync('src/pages/admin/customer-relationships.tsx', 'utf8');
    expect(layout).not.toContain("label: 'Customer Relations'");
    expect(routes).toContain("path: '/admin/customer-relationships'");
    expect(users).toContain('to="/admin/customer-relationships"');
    expect(page).toContain('Create relationship');
    expect(page).toContain('Select customer');
    expect(page).toContain('Edit relationship');
  });
});
