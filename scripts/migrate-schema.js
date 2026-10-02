import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function migrateSchema() {
  console.log('Updating database schema for simplified phone/password authentication and room setup...');

  // Add phone and password to users if not exist
  await sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS password VARCHAR(255);
  `;

  // Enlarge pin and user_code columns to prevent value length truncation errors
  await sql`
    ALTER TABLE users 
    ALTER COLUMN pin TYPE VARCHAR(255),
    ALTER COLUMN user_code TYPE VARCHAR(50);
  `;

  // Add phone and password to flats if not exist
  await sql`
    ALTER TABLE flats 
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS password VARCHAR(255);
  `;

  console.log('✅ Schema migration completed successfully!');
}

migrateSchema().catch(console.error);

