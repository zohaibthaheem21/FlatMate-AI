import 'dotenv/config';
import { neon, neonConfig } from '@neondatabase/serverless';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

neonConfig.fetchOptions = {
  cache: 'no-store',
  keepalive: true,
};

const rawUrl = process.env.DATABASE_URL;
const directUrl = rawUrl ? rawUrl.replace('-pooler.', '.') : '';

const sql = neon(directUrl);

async function runConcurrencyTest() {
  console.log('Testing 10 concurrent HTTP database queries...');
  const t0 = Date.now();
  const queries = Array.from({ length: 10 }, (_, i) => 
    sql`SELECT ${i} as idx, NOW() as ts`
  );

  try {
    const results = await Promise.all(queries);
    console.log(`✅ All 10 concurrent queries succeeded in ${Date.now() - t0}ms!`);
  } catch (err) {
    console.error(`❌ Concurrency test failed in ${Date.now() - t0}ms:`, err);
  }
}

runConcurrencyTest();
