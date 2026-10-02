import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function testConnection() {
  console.log('Verifying Neon Database Tables...');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log('Tables found in Neon DB:', tables.map(t => t.table_name));
}

testConnection().catch(console.error);
