import { getDb } from './_db.js';

export default async function handler(req, res) {
  const sql = getDb();

  if (req.method === 'GET') {
    try {
      const { flatId, userId } = req.query;
      if (!flatId) {
        return res.status(400).json({ error: 'flatId query parameter is required' });
      }

      // Fetch flat members
      const members = await sql`
        SELECT u.id, u.name, u.user_code
        FROM flat_members fm
        JOIN users u ON fm.user_id = u.id
        WHERE fm.flat_id = ${flatId}
        ORDER BY fm.joined_at ASC
      `;

      if (members.length === 0) {
        return res.status(200).json({
          success: true,
          balances: [],
          transactions: [],
          pairwiseDebts: [],
          history: [],
          pendingSettlements: []
        });
      }

      // 1. Fetch all APPROVED expense splits in this flat
      const approvedSplits = await sql`
        SELECT 
          es.user_id as debtor_id,
          e.paid_by as creditor_id,
          COALESCE(SUM(es.amount), 0) as total_amount
        FROM expense_splits es
        JOIN expenses e ON es.expense_id = e.id
        WHERE e.flat_id = ${flatId} 
          AND es.status = 'approved'
          AND es.user_id != e.paid_by
        GROUP BY es.user_id, e.paid_by
      `;

      // Map gross split debt: splitDebtMap[debtor_id][creditor_id]
      const splitDebtMap = {};
      approvedSplits.forEach(row => {
        const d = Number(row.debtor_id);
        const c = Number(row.creditor_id);
        const amt = parseFloat(row.total_amount);
        if (!splitDebtMap[d]) splitDebtMap[d] = {};
        splitDebtMap[d][c] = (splitDebtMap[d][c] || 0) + amt;
      });

      // 2. Fetch all CONFIRMED / APPROVED cash settlements in this flat
      const confirmedSettlements = await sql`
        SELECT 
          payer_id,
          payee_id,
          COALESCE(SUM(amount), 0) as total_amount
        FROM settlements
        WHERE flat_id = ${flatId} 
          AND status IN ('confirmed', 'approved')
        GROUP BY payer_id, payee_id
      `;

      // Map cash paid: cashPaidMap[payer_id][payee_id]
      const cashPaidMap = {};
      confirmedSettlements.forEach(row => {
        const p = Number(row.payer_id);
        const r = Number(row.payee_id);
        const amt = parseFloat(row.total_amount);
        if (!cashPaidMap[p]) cashPaidMap[p] = {};
        cashPaidMap[p][r] = (cashPaidMap[p][r] || 0) + amt;
      });

      // 3. Compute Pairwise Bilateral Debts & Dynamic Auto-Offsets Across Days
      // For any two members A and B:
      // gross_A_owes_B = (approved splits where A owes B) - (confirmed cash A paid B)
      // gross_B_owes_A = (approved splits where B owes A) - (confirmed cash B paid A)
      // net_A_to_B = gross_A_owes_B - gross_B_owes_A
      // If net_A_to_B > 0: A owes B net_A_to_B
      // If net_A_to_B < 0: B owes A Math.abs(net_A_to_B)

      const memberMap = {};
      members.forEach(m => {
        memberMap[m.id] = m;
      });

      const memberIds = members.map(m => m.id);
      const netPairwiseMap = {}; // key: "debtorId-creditorId" -> netAmount
      const pairwiseTransactions = [];

      for (let i = 0; i < memberIds.length; i++) {
        for (let j = i + 1; j < memberIds.length; j++) {
          const idA = memberIds[i];
          const idB = memberIds[j];

          const splitsAOwesB = (splitDebtMap[idA] && splitDebtMap[idA][idB]) || 0;
          const cashAPaidB = (cashPaidMap[idA] && cashPaidMap[idA][idB]) || 0;
          const effectiveCashAPaidB = Math.min(cashAPaidB, splitsAOwesB);
          const grossAOwesB = Math.max(0, splitsAOwesB - effectiveCashAPaidB);

          const splitsBOwesA = (splitDebtMap[idB] && splitDebtMap[idB][idA]) || 0;
          const cashBPaidA = (cashPaidMap[idB] && cashPaidMap[idB][idA]) || 0;
          const effectiveCashBPaidA = Math.min(cashBPaidA, splitsBOwesA);
          const grossBOwesA = Math.max(0, splitsBOwesA - effectiveCashBPaidA);

          const netAToB = Math.round((grossAOwesB - grossBOwesA) * 100) / 100;

          if (netAToB > 0.01) {
            // A owes B netAToB
            pairwiseTransactions.push({
              payer_id: idA,
              payer_name: memberMap[idA].name,
              payer_code: memberMap[idA].user_code,
              payee_id: idB,
              payee_name: memberMap[idB].name,
              payee_code: memberMap[idB].user_code,
              amount: netAToB,
            });
            netPairwiseMap[`${idA}-${idB}`] = netAToB;
          } else if (netAToB < -0.01) {
            // B owes A Math.abs(netAToB)
            const amt = Math.abs(netAToB);
            pairwiseTransactions.push({
              payer_id: idB,
              payer_name: memberMap[idB].name,
              payer_code: memberMap[idB].user_code,
              payee_id: idA,
              payee_name: memberMap[idA].name,
              payee_code: memberMap[idA].user_code,
              amount: amt,
            });
            netPairwiseMap[`${idB}-${idA}`] = amt;
          }
        }
      }

      // 4. Calculate Net Balance for each member (Total Receivables - Total Payables)
      const memberBalances = members.map(m => {
        let totalReceivable = 0;
        let totalPayable = 0;

        pairwiseTransactions.forEach(tx => {
          if (tx.payee_id === m.id) {
            totalReceivable += tx.amount;
          }
          if (tx.payer_id === m.id) {
            totalPayable += tx.amount;
          }
        });

        const netBalance = Math.round((totalReceivable - totalPayable) * 100) / 100;

        return {
          id: m.id,
          name: m.name,
          user_code: m.user_code,
          total_receivable: Math.round(totalReceivable * 100) / 100,
          total_payable: Math.round(totalPayable * 100) / 100,
          net_balance: netBalance,
        };
      });

      // 5. Fetch pending settlements waiting for approval by user (or overall pending)
      let pendingSettlements = [];
      if (userId) {
        pendingSettlements = await sql`
          SELECT 
            s.id, s.amount, s.created_at, s.payer_id, s.payee_id, s.status,
            u_payer.name as payer_name, u_payer.user_code as payer_code,
            u_payee.name as payee_name, u_payee.user_code as payee_code
          FROM settlements s
          JOIN users u_payer ON s.payer_id = u_payer.id
          JOIN users u_payee ON s.payee_id = u_payee.id
          WHERE s.flat_id = ${flatId} 
            AND s.payee_id = ${userId}
            AND s.status = 'pending'
          ORDER BY s.created_at DESC
        `;
      } else {
        pendingSettlements = await sql`
          SELECT 
            s.id, s.amount, s.created_at, s.payer_id, s.payee_id, s.status,
            u_payer.name as payer_name, u_payer.user_code as payer_code,
            u_payee.name as payee_name, u_payee.user_code as payee_code
          FROM settlements s
          JOIN users u_payer ON s.payer_id = u_payer.id
          JOIN users u_payee ON s.payee_id = u_payee.id
          WHERE s.flat_id = ${flatId} 
            AND s.status = 'pending'
          ORDER BY s.created_at DESC
        `;
      }

      // 6. Fetch confirmed settlement history
      const history = await sql`
        SELECT 
          s.id, s.amount, s.created_at, s.status,
          u1.name as payer_name, u1.user_code as payer_code,
          u2.name as payee_name, u2.user_code as payee_code
        FROM settlements s
        JOIN users u1 ON s.payer_id = u1.id
        JOIN users u2 ON s.payee_id = u2.id
        WHERE s.flat_id = ${flatId} AND s.status IN ('confirmed', 'approved')
        ORDER BY s.created_at DESC
        LIMIT 20
      `;

      return res.status(200).json({
        success: true,
        balances: memberBalances,
        transactions: pairwiseTransactions,
        pairwiseDebts: pairwiseTransactions,
        pendingSettlements: pendingSettlements.map(s => ({ ...s, amount: parseFloat(s.amount) })),
        history: history.map(h => ({ ...h, amount: parseFloat(h.amount) }))
      });
    } catch (error) {
      console.error('Fetch settle status error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch settlement data' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { flatId, payerId, payeeId, receiverId, amount, initiatorId } = req.body || {};
      const targetPayeeId = payeeId || receiverId;

      if (!flatId || !payerId || !targetPayeeId || !amount) {
        return res.status(400).json({ error: 'flatId, payerId, payeeId/receiverId, and amount are required' });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
      }

      // If initiator is payee (creditor recording cash directly), default to 'confirmed'
      // If debtor logging cash sent, default to 'pending'
      const status = Number(initiatorId) === Number(targetPayeeId) ? 'confirmed' : 'pending';

      const result = await sql`
        INSERT INTO settlements (flat_id, payer_id, payee_id, amount, status)
        VALUES (${flatId}, ${payerId}, ${targetPayeeId}, ${parsedAmount}, ${status})
        RETURNING id, flat_id, payer_id, payee_id, amount, status, created_at
      `;

      return res.status(201).json({
        success: true,
        settlement: {
          ...result[0],
          amount: parseFloat(result[0].amount)
        }
      });
    } catch (error) {
      console.error('Record settlement error:', error);
      return res.status(500).json({ error: error.message || 'Failed to record settlement' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { settlementId, status, userId } = req.body || {};

      if (!settlementId || !status || !userId) {
        return res.status(400).json({ error: 'settlementId, status, and userId are required' });
      }

      const existing = await sql`
        SELECT id, payee_id FROM settlements WHERE id = ${settlementId}
      `;

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Settlement request not found' });
      }

      if (Number(existing[0].payee_id) !== Number(userId)) {
        return res.status(403).json({ error: 'Only the cash receiver (creditor) can confirm or decline this payment' });
      }

      const normalizedStatus = status === 'approved' ? 'confirmed' : status === 'disputed' ? 'rejected' : status;

      const updated = await sql`
        UPDATE settlements
        SET status = ${normalizedStatus}
        WHERE id = ${settlementId}
        RETURNING id, flat_id, payer_id, payee_id, amount, status, created_at
      `;

      return res.status(200).json({
        success: true,
        settlement: {
          ...updated[0],
          amount: parseFloat(updated[0].amount)
        }
      });
    } catch (error) {
      console.error('Confirm settlement error:', error);
      return res.status(500).json({ error: error.message || 'Failed to confirm settlement' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { settlementId } = req.body || req.query;

      if (!settlementId) {
        return res.status(400).json({ error: 'settlementId is required' });
      }

      await sql`
        DELETE FROM settlements
        WHERE id = ${settlementId}
      `;

      return res.status(200).json({ success: true, message: 'Settlement deleted successfully' });
    } catch (error) {
      console.error('Delete settlement error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete settlement' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
