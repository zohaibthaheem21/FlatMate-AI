import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing in .env');
  process.exit(1);
}

const sql = neon(connectionString);

async function init() {
  console.log('Connecting to Neon PostgreSQL database...');

  await sql`
    CREATE TABLE IF NOT EXISTS flats (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  console.log('✓ Table "flats" ready.');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      pin VARCHAR(10) NOT NULL,
      user_code VARCHAR(20) UNIQUE NOT NULL,
      flat_id INT REFERENCES flats(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  console.log('✓ Table "users" ready.');

  await sql`
    CREATE TABLE IF NOT EXISTS flat_members (
      id SERIAL PRIMARY KEY,
      flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT unique_flat_member UNIQUE (flat_id, user_id)
    );
  `;
  console.log('✓ Table "flat_members" ready.');

  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
      paid_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      category VARCHAR(100) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  console.log('✓ Table "expenses" ready.');

  await sql`
    CREATE TABLE IF NOT EXISTS expense_splits (
      id SERIAL PRIMARY KEY,
      expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(10, 2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT unique_expense_user_split UNIQUE (expense_id, user_id)
    );
  `;
  console.log('✓ Table "expense_splits" ready.');

  await sql`
    CREATE TABLE IF NOT EXISTS settlements (
      id SERIAL PRIMARY KEY,
      flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
      payer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(10, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  console.log('✓ Table "settlements" ready.');

  console.log('\n✅ Database schema initialized successfully in Neon PostgreSQL!');
}

init().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
