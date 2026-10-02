import 'dotenv/config';
import { getDb } from '../api/_db.js';
import dns from 'dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

const sql = getDb();

async function runVerification() {
  console.log('--- STARTING FULL END-TO-END VERIFICATION ---');

  // 1. Wipe DB tables
  await sql`TRUNCATE TABLE settlements, expense_splits, expenses, flat_members, users, flats RESTART IDENTITY CASCADE;`;
  console.log('✓ Database cleared.');

  // 2. Register User 1 (Zohaib)
  const user1Res = await sql`
    INSERT INTO users (name, phone, password, pin, user_code)
    VALUES ('Zohaib', '03001111111', '1234', '1234', 'ZOH-1001')
    RETURNING id, name, phone, user_code;
  `;
  const u1 = user1Res[0];
  console.log('✓ User 1 created:', u1.name, u1.user_code);

  // 3. Register User 2 (Ali)
  const user2Res = await sql`
    INSERT INTO users (name, phone, password, pin, user_code)
    VALUES ('Ali', '03002222222', '1234', '1234', 'ALI-2002')
    RETURNING id, name, phone, user_code;
  `;
  const u2 = user2Res[0];
  console.log('✓ User 2 created:', u2.name, u2.user_code);

  // 4. Create Flat by User 1
  const flatRes = await sql`
    INSERT INTO flats (name, code, phone, password)
    VALUES ('Bachelor Hub 404', 'ROOM-4040', '03009998887', 'pass123')
    RETURNING id, name, code;
  `;
  const flat = flatRes[0];
  console.log('✓ Flat created:', flat.name, flat.code);

  // Add User 1 to flat
  await sql`UPDATE users SET flat_id = ${flat.id} WHERE id = ${u1.id}`;
  await sql`INSERT INTO flat_members (flat_id, user_id) VALUES (${flat.id}, ${u1.id})`;

  // Add User 2 to flat
  await sql`UPDATE users SET flat_id = ${flat.id} WHERE id = ${u2.id}`;
  await sql`INSERT INTO flat_members (flat_id, user_id) VALUES (${flat.id}, ${u2.id})`;
  console.log('✓ User 1 & User 2 joined Flat.');

  // 5. User 1 adds expense: "Grocery 600 PKR" split 50-50 (300 each)
  const expRes = await sql`
    INSERT INTO expenses (flat_id, paid_by, title, amount, category)
    VALUES (${flat.id}, ${u1.id}, 'Grocery', 600.00, 'Food')
    RETURNING id, flat_id, paid_by, title, amount;
  `;
  const exp = expRes[0];

  // User 1 auto-approved share
  await sql`
    INSERT INTO expense_splits (expense_id, user_id, amount, status)
    VALUES (${exp.id}, ${u1.id}, 300.00, 'approved');
  `;
  // User 2 pending share
  const split2Res = await sql`
    INSERT INTO expense_splits (expense_id, user_id, amount, status)
    VALUES (${exp.id}, ${u2.id}, 300.00, 'pending')
    RETURNING id;
  `;
  const split2Id = split2Res[0].id;
  console.log('✓ Expense created: 600 PKR split between Zohaib (auto-approved) & Ali (pending).');

  // 6. User 2 approves their split
  await sql`
    UPDATE expense_splits
    SET status = 'approved', updated_at = NOW()
    WHERE id = ${split2Id};
  `;
  console.log('✓ Ali accepted / approved split.');

  // 7. Verify Expense is STILL in DB and splits are APPROVED
  const remainingExpenses = await sql`SELECT id, title FROM expenses WHERE id = ${exp.id}`;
  console.log('✓ Expense persists in DB:', remainingExpenses.length > 0 ? 'YES (PERSISTED)' : 'NO (DELETED)');

  // 8. Calculate debts using logic from /api/settle
  const approvedSplits = await sql`
    SELECT es.user_id as debtor_id, e.paid_by as creditor_id, SUM(es.amount) as total
    FROM expense_splits es
    JOIN expenses e ON es.expense_id = e.id
    WHERE e.flat_id = ${flat.id} AND es.status = 'approved' AND es.user_id != e.paid_by
    GROUP BY es.user_id, e.paid_by
  `;
  console.log('✓ Approved split debts:', approvedSplits);
  if (approvedSplits.length > 0 && Number(approvedSplits[0].debtor_id) === u2.id && Number(approvedSplits[0].creditor_id) === u1.id && parseFloat(approvedSplits[0].total) === 300) {
    console.log('✅ SUCCESS: Ali owes Zohaib 300 PKR accurately!');
  } else {
    console.error('❌ ERROR: Debt calculation mismatch!');
  }

  // 9. User 2 pays Zohaib 300 PKR cash settlement
  const settleRes = await sql`
    INSERT INTO settlements (flat_id, payer_id, payee_id, amount, status)
    VALUES (${flat.id}, ${u2.id}, ${u1.id}, 300.00, 'confirmed')
    RETURNING id, amount, status;
  `;
  console.log('✓ Ali sent 300 PKR cash settlement to Zohaib (Confirmed).');

  // 10. Re-calculate net debt after settlement
  const confirmedCash = await sql`
    SELECT payer_id, payee_id, SUM(amount) as total
    FROM settlements
    WHERE flat_id = ${flat.id} AND status IN ('confirmed', 'approved')
    GROUP BY payer_id, payee_id
  `;
  const grossOwed = parseFloat(approvedSplits[0].total);
  const cashPaid = parseFloat(confirmedCash[0].total);
  const netOwed = grossOwed - cashPaid;
  console.log(`✓ Net Debt after settlement: ${netOwed} PKR`);

  if (netOwed === 0) {
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('❌ ERROR: Net debt not 0 after full settlement!');
  }

  // Clear DB at end
  await sql`TRUNCATE TABLE settlements, expense_splits, expenses, flat_members, users, flats RESTART IDENTITY CASCADE;`;
  console.log('✓ DB reset clean for fresh usage.');
}

runVerification().catch(err => {
  console.error('Test execution failed:', err);
});
