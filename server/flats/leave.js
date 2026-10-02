import { getDb } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { userId, targetUserId } = req.body || {};
    const idToProcess = targetUserId || userId;

    if (!idToProcess) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const existingUser = await sql`SELECT id, name, flat_id FROM users WHERE id = ${idToProcess}`;
    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentFlatId = existingUser[0].flat_id;

    if (!currentFlatId) {
      return res.status(200).json({
        success: true,
        user: existingUser[0],
        message: 'User is not currently in any flat'
      });
    }

    // 1. Calculate user's approved split debts and credits
    const approvedOwedByOthers = await sql`
      SELECT COALESCE(SUM(es.amount), 0) as total
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      WHERE e.flat_id = ${currentFlatId}
        AND e.paid_by = ${idToProcess}
        AND es.user_id != ${idToProcess}
        AND es.status = 'approved'
    `;

    const approvedOwedToOthers = await sql`
      SELECT COALESCE(SUM(es.amount), 0) as total
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      WHERE e.flat_id = ${currentFlatId}
        AND es.user_id = ${idToProcess}
        AND e.paid_by != ${idToProcess}
        AND es.status = 'approved'
    `;

    // 2. Calculate confirmed settlements sent and received
    const settlementsSent = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM settlements
      WHERE flat_id = ${currentFlatId}
        AND payer_id = ${idToProcess}
        AND status IN ('confirmed', 'approved')
    `;

    const settlementsReceived = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM settlements
      WHERE flat_id = ${currentFlatId}
        AND payee_id = ${idToProcess}
        AND status IN ('confirmed', 'approved')
    `;

    const owedByOthers = parseFloat(approvedOwedByOthers[0].total);
    const owedToOthers = parseFloat(approvedOwedToOthers[0].total);
    const sent = parseFloat(settlementsSent[0].total);
    const received = parseFloat(settlementsReceived[0].total);

    // Net balance = (Receivables - Payables)
    const netBalance = Math.round(((owedByOthers - received) - (owedToOthers - sent)) * 100) / 100;

    // Check for pending split approvals or pending cash settlements
    const pendingSplits = await sql`
      SELECT COUNT(*) as count
      FROM expense_splits es
      JOIN expenses e ON es.expense_id = e.id
      WHERE e.flat_id = ${currentFlatId}
        AND (es.user_id = ${idToProcess} OR e.paid_by = ${idToProcess})
        AND es.status = 'pending'
    `;

    const pendingSettlements = await sql`
      SELECT COUNT(*) as count
      FROM settlements
      WHERE flat_id = ${currentFlatId}
        AND (payer_id = ${idToProcess} OR payee_id = ${idToProcess})
        AND status = 'pending'
    `;

    const hasPendingItems = parseInt(pendingSplits[0].count) > 0 || parseInt(pendingSettlements[0].count) > 0;

    // STRICT VALIDATION RULE:
    // User cannot leave if net balance != 0.00 PKR or has outstanding pending splits/settlements
    if (Math.abs(netBalance) > 0.01) {
      const formattedAmt = netBalance > 0
        ? `+${netBalance.toLocaleString()}`
        : `${netBalance.toLocaleString()}`;

      return res.status(400).json({
        error: `Cannot leave flat. Please settle all pending debts (Current balance: PKR ${formattedAmt}) first.`,
        netBalance,
        canLeave: false
      });
    }

    if (hasPendingItems) {
      return res.status(400).json({
        error: `Cannot leave flat while there are pending expense approvals or cash settlement requests.`,
        netBalance,
        canLeave: false
      });
    }

    // Balance is exactly 0.00 PKR and no pending items -> Remove cleanly
    await sql`
      DELETE FROM flat_members
      WHERE flat_id = ${currentFlatId} AND user_id = ${idToProcess}
    `;

    await sql`
      UPDATE users
      SET flat_id = NULL
      WHERE id = ${idToProcess}
    `;

    const updatedUser = await sql`
      SELECT id, name, phone, user_code, flat_id
      FROM users
      WHERE id = ${idToProcess}
    `;

    return res.status(200).json({
      success: true,
      user: updatedUser[0],
      message: 'Successfully left room'
    });
  } catch (error) {
    console.error('Leave room error:', error);
    return res.status(500).json({ error: error.message || 'Failed to leave room' });
  }
}
