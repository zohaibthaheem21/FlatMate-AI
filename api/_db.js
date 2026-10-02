import { neon, neonConfig } from '@neondatabase/serverless';
import dns from 'dns';

// Force Node.js fetch to prefer IPv4 over IPv6 on Windows environments to prevent connection timeouts
try {
  if (dns && typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Ignore fallback errors
}

neonConfig.fetchOptions = {
  cache: 'no-store',
  keepalive: true,
};

let cachedSql = null;

export function getDb() {
  if (cachedSql) return cachedSql;

  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  // Optimize HTTP Serverless connection by pointing to the primary Neon endpoint (removing -pooler)
  // which eliminates PgBouncer HTTP queueing latencies and connection timeouts
  if (connectionString.includes('-pooler.')) {
    connectionString = connectionString.replace('-pooler.', '.');
  }

  cachedSql = neon(connectionString);
  return cachedSql;
}

// Utility response helpers for Vercel Serverless functions
export function jsonResponse(res, status, data) {
  res.status(status).json(data);
}

export function errorResponse(res, status, message) {
  res.status(status).json({ error: message });
}
