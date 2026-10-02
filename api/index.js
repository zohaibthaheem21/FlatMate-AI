import { getDb } from './_db.js';
import aiHandler from './ai.js';
import expensesHandler from './expenses.js';
import approvalsHandler from './approvals.js';
import settleHandler from './settle.js';
import initDbHandler from './init-db.js';
import loginHandler from './auth/login.js';
import registerHandler from './auth/register.js';
import meHandler from './auth/me.js';
import createFlatHandler from './flats/create.js';
import joinFlatHandler from './flats/join.js';
import leaveFlatHandler from './flats/leave.js';
import membersFlatHandler from './flats/members.js';

// Single Master Vercel Serverless Entry Point to stay under Vercel Hobby 12-function limit
export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Route requests to consolidated handlers
  if (pathname.startsWith('/api/ai')) {
    return aiHandler(req, res);
  } else if (pathname.startsWith('/api/expenses')) {
    return expensesHandler(req, res);
  } else if (pathname.startsWith('/api/approvals')) {
    return approvalsHandler(req, res);
  } else if (pathname.startsWith('/api/settle')) {
    return settleHandler(req, res);
  } else if (pathname.startsWith('/api/init-db')) {
    return initDbHandler(req, res);
  } else if (pathname.startsWith('/api/auth/login')) {
    return loginHandler(req, res);
  } else if (pathname.startsWith('/api/auth/register')) {
    return registerHandler(req, res);
  } else if (pathname.startsWith('/api/auth/me')) {
    return meHandler(req, res);
  } else if (pathname.startsWith('/api/flats/create')) {
    return createFlatHandler(req, res);
  } else if (pathname.startsWith('/api/flats/join')) {
    return joinFlatHandler(req, res);
  } else if (pathname.startsWith('/api/flats/leave')) {
    return leaveFlatHandler(req, res);
  } else if (pathname.startsWith('/api/flats/members')) {
    return membersFlatHandler(req, res);
  } else {
    return res.status(404).json({ error: `API route ${pathname} not found` });
  }
}
