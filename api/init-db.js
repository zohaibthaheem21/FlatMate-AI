import { getDb } from './_db.js';

let isInitialized = false;

export async function ensureDbInitialized(force = false) {
  if (isInitialized && !force) return;
  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS flats (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        pin VARCHAR(255),
        password VARCHAR(255),
        user_code VARCHAR(50) UNIQUE NOT NULL,
        flat_id INT REFERENCES flats(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS flat_members (
        id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_flat_member UNIQUE (flat_id, user_id)
      );
    `;

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

    await sql`
      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
        payer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    isInitialized = true;
  } catch (err) {
    console.error('ensureDbInitialized error:', err);
  }
}

export default async function handler(req, res) {
  try {
    await ensureDbInitialized(true);
    res.status(200).json({ success: true, message: 'Database tables initialized successfully.' });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize database.' });
  }
}
