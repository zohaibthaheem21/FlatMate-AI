import { getDb } from './_db.js';

export default async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ error: 'userId query parameter is required' });
      }

      // 1. Pending expense split shares for this user
      const pendingExpenses = await sql`
        SELECT 
          es.id as split_id,
          'expense' as approval_type,
          es.amount as share_amount,
          es.status,
          es.updated_at,
          e.id as expense_id,
          e.title,
          e.amount as total_amount,
          e.category,
          e.created_at as expense_date,
          u_payer.name as paid_by_name,
          u_payer.user_code as paid_by_code,
          u_payer.id as paid_by_id
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        JOIN users u_payer ON e.paid_by = u_payer.id
        WHERE es.user_id = ${userId}
          AND es.status = 'pending'
          AND e.paid_by != ${userId}
        ORDER BY e.created_at DESC
      `;

      // 2. Pending cash settlement confirmation requests sent to this user
      const pendingSettlements = await sql`
        SELECT 
          s.id as settlement_id,
          'settlement' as approval_type,
          s.amount as share_amount,
          s.status,
          s.created_at as expense_date,
          u_payer.name as paid_by_name,
          u_payer.user_code as paid_by_code,
          u_payer.id as paid_by_id,
          'Cash Settlement' as title,
          'Settlement' as category,
          s.amount as total_amount
        FROM settlements s
        JOIN users u_payer ON s.payer_id = u_payer.id
        WHERE s.payee_id = ${userId}
          AND s.status = 'pending'
        ORDER BY s.created_at DESC
      `;

      const formattedExpenses = pendingExpenses.map(a => ({
        ...a,
        share_amount: parseFloat(a.share_amount),
        total_amount: parseFloat(a.total_amount)
      }));

      const formattedSettlements = pendingSettlements.map(s => ({
        ...s,
        share_amount: parseFloat(s.share_amount),
        total_amount: parseFloat(s.total_amount)
      }));

      const allApprovals = [...formattedExpenses, ...formattedSettlements];

      return res.status(200).json({ success: true, approvals: allApprovals });
    } catch (error) {
      console.error('Fetch approvals error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch pending approvals' });
    }
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    try {
      const { splitId, settlementId, type, status, userId } = req.body || {};

      if (!status || !userId) {
        return res.status(400).json({ error: 'status and userId are required' });
      }

      const validStatuses = ['approved', 'disputed', 'pending', 'confirmed', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Handle Cash Settlement Approval
      if (type === 'settlement') {
        const targetId = settlementId || splitId;
        const existingSettlement = await sql`
          SELECT id, payee_id FROM settlements WHERE id = ${targetId}
        `;

        if (existingSettlement.length === 0) {
          return res.status(404).json({ error: 'Settlement request not found' });
        }

        if (Number(existingSettlement[0].payee_id) !== Number(userId)) {
          return res.status(403).json({ error: 'Unauthorized to modify this settlement' });
        }

        const normalizedStatus = status === 'approved' ? 'confirmed' : status === 'disputed' ? 'rejected' : status;

        const updated = await sql`
          UPDATE settlements
          SET status = ${normalizedStatus}
          WHERE id = ${targetId}
          RETURNING id, flat_id, payer_id, payee_id, amount, status, created_at
        `;

        return res.status(200).json({
          success: true,
          settlement: {
            ...updated[0],
            amount: parseFloat(updated[0].amount)
          }
        });
      }

      // Handle Expense Split Approval
      const existingSplit = await sql`
        SELECT id, user_id FROM expense_splits WHERE id = ${splitId}
      `;

      if (existingSplit.length === 0) {
        return res.status(404).json({ error: 'Split not found' });
      }

      if (Number(existingSplit[0].user_id) !== Number(userId)) {
        return res.status(403).json({ error: 'Unauthorized to modify this approval' });
      }

      const updated = await sql`
        UPDATE expense_splits
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${splitId}
        RETURNING id, expense_id, user_id, amount, status, updated_at
      `;

      return res.status(200).json({
        success: true,
        split: {
          ...updated[0],
          amount: parseFloat(updated[0].amount)
        }
      });
    } catch (error) {
      console.error('Update approval status error:', error);
      return res.status(500).json({ error: error.message || 'Failed to update approval status' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
