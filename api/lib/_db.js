import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchOptions = {
  cache: 'no-store',
};

let cachedSql = null;

const DEFAULT_DB_URL = 'postgresql://neondb_owner:npg_oN0lRhJ2zank@ep-rough-truth-b5j6kb9l.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

export function getDb() {
  if (cachedSql) return cachedSql;

  let connectionString = process.env.DATABASE_URL || DEFAULT_DB_URL;

  if (connectionString.includes('-pooler.')) {
    connectionString = connectionString.replace('-pooler.', '.');
  }

  cachedSql = neon(connectionString);
  return cachedSql;
}

export function jsonResponse(res, status, data) {
  res.status(status).json(data);
}

export function errorResponse(res, status, message) {
  res.status(status).json({ error: message });
}
