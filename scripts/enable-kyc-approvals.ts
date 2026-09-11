import 'dotenv/config';
import { getDb } from '../src/server/db/db.js';
import { config as configTable } from '../src/server/db/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    const db = getDb();
    console.log('Connecting to database to enable KYC approvals...');
    
    // 1. Ensure the workflow config row exists
    await db.insert(configTable).values({ 
      key: 'admin_workflow_controls', 
      value: { kycApprovalsEnabled: true, sandboxFinancialControlsEnabled: false, version: 'manual-enable' }, 
      updatedBy: 'system' 
    }).onConflictDoNothing();

    // 2. Read current value
    const rows = await db.select().from(configTable).where(eq(configTable.key, 'admin_workflow_controls'));
    const current = rows[0]?.value as any || {};
    
    // 3. Merge and update
    const newValue = { ...current, kycApprovalsEnabled: true, version: 'manual-enable-' + Date.now() };
    
    await db.update(configTable)
      .set({ 
        value: newValue, 
        updatedAt: new Date() 
      })
      .where(eq(configTable.key, 'admin_workflow_controls'));

    console.log('✅ Successfully enabled KYC approvals in the database.');
  } catch (error) {
    console.error('❌ Error enabling KYC approvals:', error);
    process.exit(1);
  }
}

main();
