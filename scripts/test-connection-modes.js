import 'dotenv/config';
import { neon, Pool } from '@neondatabase/serverless';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const connStr = process.env.DATABASE_URL;

console.log('Original DATABASE_URL:', connStr);

// Option A: Original URL via neon()
async function testOriginalNeon() {
  console.log('Testing Original neon()...');
  const t0 = Date.now();
  try {
    const sql = neon(connStr);
    const res = await sql`SELECT 1 as test`;
    console.log(`✓ Original neon() succeeded in ${Date.now() - t0}ms:`, res);
  } catch (err) {
    console.error(`❌ Original neon() failed in ${Date.now() - t0}ms:`, err.message);
  }
}

// Option B: Direct Host URL (removing -pooler) via neon()
async function testDirectNeon() {
  const directUrl = connStr.replace('-pooler.', '.');
  console.log('Testing Direct Host neon() (url:', directUrl, ')...');
  const t0 = Date.now();
  try {
    const sql = neon(directUrl);
    const res = await sql`SELECT 1 as test`;
    console.log(`✓ Direct neon() succeeded in ${Date.now() - t0}ms:`, res);
  } catch (err) {
    console.error(`❌ Direct neon() failed in ${Date.now() - t0}ms:`, err.message);
  }
}

// Option C: WebSocket Pool via @neondatabase/serverless
async function testWsPool() {
  console.log('Testing WebSocket Pool...');
  const t0 = Date.now();
  try {
    const pool = new Pool({ connectionString: connStr });
    const res = await pool.query('SELECT 1 as test');
    console.log(`✓ WS Pool succeeded in ${Date.now() - t0}ms:`, res.rows);
    await pool.end();
  } catch (err) {
    console.error(`❌ WS Pool failed in ${Date.now() - t0}ms:`, err.message);
  }
}

async function run() {
  await testOriginalNeon();
  await testDirectNeon();
  await testWsPool();
}

run();
