import { getDb } from '../server/_db.js';
import aiHandler from '../server/ai.js';
import expensesHandler from '../server/expenses.js';
import approvalsHandler from '../server/approvals.js';
import settleHandler from '../server/settle.js';
import initDbHandler from '../server/init-db.js';
import loginHandler from '../server/auth/login.js';
import registerHandler from '../server/auth/register.js';
import meHandler from '../server/auth/me.js';
import createFlatHandler from '../server/flats/create.js';
import joinFlatHandler from '../server/flats/join.js';
import leaveFlatHandler from '../server/flats/leave.js';
import membersFlatHandler from '../server/flats/members.js';

// Master Single Vercel Serverless Function (1 of 12 limit)
export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
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
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
