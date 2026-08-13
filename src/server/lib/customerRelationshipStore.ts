import crypto from 'node:crypto';
import { desc, eq, or } from 'drizzle-orm';
import { getDb, isDatabaseConfigured } from '../db/db.js';
import { customerRelationships } from '../db/schema.js';
import { appendCriticalAudit, appendAudit } from './auditLog.js';
import { findUserById, loadAllUsers } from './userStore.js';

export const RELATIONSHIP_TYPES = ['joint_holder','beneficial_owner','director','authorised_user','beneficiary','guarantor','household','business_contact'] as const;
export const RELATIONSHIP_STATUSES = ['pending','active','inactive'] as const;
export type RelationshipType = typeof RELATIONSHIP_TYPES[number];
export type RelationshipStatus = typeof RELATIONSHIP_STATUSES[number];
export interface RelationshipActor { id: string; email: string; ip?: string; correlationId: string }

export class CustomerRelationshipError extends Error {
  constructor(message: string, public readonly code: string) { super(message); }
}

export function validateRelationship(input: { customerId: string; relatedCustomerId: string; relationshipType: string }) {
  if (input.customerId === input.relatedCustomerId) throw new CustomerRelationshipError('A customer cannot be related to the same profile.', 'SELF_RELATIONSHIP');
  if (!RELATIONSHIP_TYPES.includes(input.relationshipType as RelationshipType)) throw new CustomerRelationshipError('Unsupported relationship type.', 'INVALID_RELATIONSHIP_TYPE');
}

function requireDatabase() {
  if (!isDatabaseConfigured()) throw new CustomerRelationshipError('Customer relationships require PostgreSQL.', 'DATABASE_REQUIRED');
}

export async function listCustomerRelationships(customerId?: string) {
  requireDatabase();
  const rows = await getDb().select().from(customerRelationships)
    .where(customerId ? or(eq(customerRelationships.customerId, customerId), eq(customerRelationships.relatedCustomerId, customerId)) : undefined)
    .orderBy(desc(customerRelationships.updatedAt));
  const users = await loadAllUsers();
  const directory = new Map(users.map(user => [user.id, { id: user.id, name: user.name, email: user.email, status: user.status }]));
  return rows.map(row => ({ ...row, customer: directory.get(row.customerId) ?? null, relatedCustomer: directory.get(row.relatedCustomerId) ?? null }));
}

export async function createCustomerRelationship(input: { customerId: string; relatedCustomerId: string; relationshipType: RelationshipType; status: RelationshipStatus; label: string; notes: string }, actor: RelationshipActor) {
  requireDatabase(); validateRelationship(input);
  const [customer, related] = await Promise.all([findUserById(input.customerId), findUserById(input.relatedCustomerId)]);
  if (!customer || !related) throw new CustomerRelationshipError('Both selected customer profiles must exist.', 'CUSTOMER_NOT_FOUND');
  const id = `rel_${crypto.randomUUID()}`;
  await appendCriticalAudit({ event: 'customer_relationship_create_intent', adminId: actor.id, email: actor.email, ip: actor.ip, userId: input.customerId, meta: { relationshipId: id, relatedCustomerId: input.relatedCustomerId, relationshipType: input.relationshipType, status: input.status, correlationId: actor.correlationId } });
  try {
    const [created] = await getDb().insert(customerRelationships).values({ id, ...input, createdBy: actor.id, lastEditedBy: actor.id }).returning();
    appendAudit({ event: 'customer_relationship_created', adminId: actor.id, email: actor.email, ip: actor.ip, userId: input.customerId, meta: { relationshipId: id, relatedCustomerId: input.relatedCustomerId, relationshipType: input.relationshipType, status: input.status, correlationId: actor.correlationId } });
    return created;
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) throw new CustomerRelationshipError('That customer relationship already exists.', 'RELATIONSHIP_EXISTS');
    throw error;
  }
}

export async function updateCustomerRelationship(id: string, patch: { relationshipType?: RelationshipType; status?: RelationshipStatus; label?: string; notes?: string }, actor: RelationshipActor) {
  requireDatabase();
  const [current] = await getDb().select().from(customerRelationships).where(eq(customerRelationships.id, id)).limit(1);
  if (!current) throw new CustomerRelationshipError('Customer relationship not found.', 'RELATIONSHIP_NOT_FOUND');
  if (patch.relationshipType) validateRelationship({ customerId: current.customerId, relatedCustomerId: current.relatedCustomerId, relationshipType: patch.relationshipType });
  await appendCriticalAudit({ event: 'customer_relationship_update_intent', adminId: actor.id, email: actor.email, ip: actor.ip, userId: current.customerId, meta: { relationshipId: id, previous: { relationshipType: current.relationshipType, status: current.status, label: current.label, notes: current.notes }, updatedFields: Object.keys(patch), correlationId: actor.correlationId } });
  const [updated] = await getDb().update(customerRelationships).set({ ...patch, lastEditedBy: actor.id, updatedAt: new Date() }).where(eq(customerRelationships.id, id)).returning();
  appendAudit({ event: 'customer_relationship_updated', adminId: actor.id, email: actor.email, ip: actor.ip, userId: current.customerId, meta: { relationshipId: id, updated: patch, correlationId: actor.correlationId } });
  return updated;
}
