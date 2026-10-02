import { getDb } from './_db.js';

export default async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    try {
      const { flatId } = req.query;
      if (!flatId) {
        return res.status(400).json({ error: 'flatId parameter is required' });
      }

      // Fetch expenses
      const expenses = await sql`
        SELECT 
          e.id, e.flat_id, e.paid_by, e.title, e.amount, e.category, e.created_at,
          u.name as payer_name, u.user_code as payer_code
        FROM expenses e
        JOIN users u ON e.paid_by = u.id
        WHERE e.flat_id = ${flatId}
        ORDER BY e.created_at DESC
      `;

      if (expenses.length === 0) {
        return res.status(200).json({ success: true, expenses: [] });
      }

      const expenseIds = expenses.map(e => e.id);

      // Fetch splits
      const splits = await sql`
        SELECT 
          es.id, es.expense_id, es.user_id, es.amount, es.status, es.updated_at,
          u.name as user_name, u.user_code
        FROM expense_splits es
        JOIN users u ON es.user_id = u.id
        WHERE es.expense_id = ANY(${expenseIds})
      `;

      const splitsByExpense = {};
      splits.forEach(s => {
        if (!splitsByExpense[s.expense_id]) {
          splitsByExpense[s.expense_id] = [];
        }
        splitsByExpense[s.expense_id].push(s);
      });

      const fullExpenses = expenses.map(e => ({
        ...e,
        amount: parseFloat(e.amount),
        splits: (splitsByExpense[e.id] || []).map(s => ({
          ...s,
          amount: parseFloat(s.amount)
        }))
      }));

      return res.status(200).json({ success: true, expenses: fullExpenses });
    } catch (error) {
      console.error('Fetch expenses error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch expenses' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { flatId, paidBy, title, amount, category, splitUserIds } = req.body || {};

      if (!flatId || !paidBy || !title || !amount || !splitUserIds || !Array.isArray(splitUserIds)) {
        return res.status(400).json({ error: 'Missing required expense fields' });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }

      if (splitUserIds.length === 0) {
        return res.status(400).json({ error: 'At least one member must be selected for expense split' });
      }

      const perPersonShare = Math.round((parsedAmount / splitUserIds.length) * 100) / 100;

      // Create expense
      const expenseResult = await sql`
        INSERT INTO expenses (flat_id, paid_by, title, amount, category)
        VALUES (${flatId}, ${paidBy}, ${title.trim()}, ${parsedAmount}, ${category || 'General'})
        RETURNING id, flat_id, paid_by, title, amount, category, created_at
      `;
      const newExpense = expenseResult[0];

      // Create splits
      const splitRecords = [];
      for (const uid of splitUserIds) {
        const status = Number(uid) === Number(paidBy) ? 'approved' : 'pending';
        const splitRes = await sql`
          INSERT INTO expense_splits (expense_id, user_id, amount, status)
          VALUES (${newExpense.id}, ${uid}, ${perPersonShare}, ${status})
          RETURNING id, expense_id, user_id, amount, status
        `;
        splitRecords.push(splitRes[0]);
      }

      return res.status(201).json({
        success: true,
        expense: {
          ...newExpense,
          amount: parseFloat(newExpense.amount),
          splits: splitRecords
        }
      });
    } catch (error) {
      console.error('Add expense error:', error);
      return res.status(500).json({ error: error.message || 'Failed to add expense' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const expenseId = req.query?.expenseId || req.body?.expenseId || req.body?.id;
      const userId = req.query?.userId || req.body?.userId;

      if (!expenseId) {
        return res.status(400).json({ error: 'expenseId is required' });
      }

      const existingExpense = await sql`SELECT id, flat_id, paid_by FROM expenses WHERE id = ${expenseId}`;
      if (existingExpense.length === 0) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      const flatId = existingExpense[0].flat_id;

      if (userId && Number(existingExpense[0].paid_by) !== Number(userId)) {
        return res.status(403).json({ error: 'Only the person who added this expense can delete it.' });
      }

      // 1. Delete associated split records from DB
      await sql`DELETE FROM expense_splits WHERE expense_id = ${expenseId}`;

      // 2. Delete parent expense record from DB
      await sql`
        DELETE FROM expenses
        WHERE id = ${expenseId}
      `;

      // 3. Check remaining expenses in flat; if none remain, clear settlements history for flat
      const remaining = await sql`SELECT COUNT(*) as count FROM expenses WHERE flat_id = ${flatId}`;
      if (parseInt(remaining[0]?.count || '0', 10) === 0) {
        await sql`DELETE FROM settlements WHERE flat_id = ${flatId}`;
      }

      return res.status(200).json({ success: true, message: 'Expense and all associated payment history deleted successfully' });
    } catch (error) {
      console.error('Delete expense error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete expense' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
