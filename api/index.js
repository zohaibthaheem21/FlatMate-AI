import { getDb } from './lib/_db.js';
import { ensureDbInitialized } from './lib/init-db.js';
import aiHandler from './lib/ai.js';
import expensesHandler from './lib/expenses.js';
import approvalsHandler from './lib/approvals.js';
import settleHandler from './lib/settle.js';
import initDbHandler from './lib/init-db.js';
import loginHandler from './lib/auth/login.js';
import registerHandler from './lib/auth/register.js';
import meHandler from './lib/auth/me.js';
import createFlatHandler from './lib/flats/create.js';
import joinFlatHandler from './lib/flats/join.js';
import leaveFlatHandler from './lib/flats/leave.js';
import membersFlatHandler from './lib/flats/members.js';

async function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return req.body;
  }
  if (req.method === 'GET' || req.method === 'HEAD') return {};

  return new Promise((resolve) => {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(bodyData ? JSON.parse(bodyData) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Master Single Vercel Serverless Function
export default async function handler(req, res) {
  const host = req.headers.host || 'localhost';
  const urlObj = new URL(req.url, `http://${host}`);
  const pathname = urlObj.pathname;

  // Add query helper if missing
  req.query = req.query || Object.fromEntries(urlObj.searchParams.entries());

  // Add response helpers if missing
  if (!res.status) {
    res.status = function(code) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function(data) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
  }

  try {
    // Parse body if stream
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      req.body = await parseJsonBody(req);
    }

    // Auto initialize DB tables if needed
    await ensureDbInitialized();

    // Route to sub-handlers
    if (pathname.startsWith('/api/ai')) {
      return await aiHandler(req, res);
    } else if (pathname.startsWith('/api/expenses')) {
      return await expensesHandler(req, res);
    } else if (pathname.startsWith('/api/approvals')) {
      return await approvalsHandler(req, res);
    } else if (pathname.startsWith('/api/settle')) {
      return await settleHandler(req, res);
    } else if (pathname.startsWith('/api/init-db')) {
      return await initDbHandler(req, res);
    } else if (pathname.startsWith('/api/auth/login')) {
      return await loginHandler(req, res);
    } else if (pathname.startsWith('/api/auth/register')) {
      return await registerHandler(req, res);
    } else if (pathname.startsWith('/api/auth/me')) {
      return await meHandler(req, res);
    } else if (pathname.startsWith('/api/flats/create')) {
      return await createFlatHandler(req, res);
    } else if (pathname.startsWith('/api/flats/join')) {
      return await joinFlatHandler(req, res);
    } else if (pathname.startsWith('/api/flats/leave')) {
      return await leaveFlatHandler(req, res);
    } else if (pathname.startsWith('/api/flats/members')) {
      return await membersFlatHandler(req, res);
    } else {
      return res.status(404).json({ error: `API route ${pathname} not found` });
    }
  } catch (error) {
    console.error('Master Serverless Error:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: error.message || 'Server error occurred' });
  }
}
