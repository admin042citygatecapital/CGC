CREATE TABLE IF NOT EXISTS customer_relationships (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  related_customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('joint_holder','beneficial_owner','director','authorised_user','beneficiary','guarantor','household','business_contact')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','inactive')),
  label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  last_edited_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_relationships_distinct_customers CHECK (customer_id <> related_customer_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS customer_relationships_unique_idx ON customer_relationships (customer_id, related_customer_id, relationship_type);
CREATE INDEX IF NOT EXISTS customer_relationships_customer_idx ON customer_relationships (customer_id, updated_at);
CREATE INDEX IF NOT EXISTS customer_relationships_related_idx ON customer_relationships (related_customer_id, updated_at);

-- The server's database role is authoritative. Do not expose administration
-- relationship metadata through Supabase's public Data API.
ALTER TABLE customer_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE customer_relationships FROM PUBLIC;

INSERT INTO schema_migrations (version) VALUES ('0027_customer_relationships') ON CONFLICT (version) DO NOTHING;
