import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function migrateSettlements() {
  console.log('Adding status column to settlements table...');
  await sql`
    ALTER TABLE settlements
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
  `;
  console.log('✓ Settlements status column added successfully!');
}

migrateSettlements().catch(console.error);
