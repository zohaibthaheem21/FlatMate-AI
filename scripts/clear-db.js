import 'dotenv/config';
import { getDb } from '../api/_db.js';

async function clearDb() {
  try {
    const sql = getDb();
    console.log('Clearing database tables...');
    await sql`TRUNCATE TABLE settlements, expense_splits, expenses, flat_members, users, flats RESTART IDENTITY CASCADE;`;
    console.log('Database tables cleared successfully! Fresh state ready.');
    process.exit(0);
  } catch (err) {
    console.error('Error clearing database:', err);
    process.exit(1);
  }
}

clearDb();
