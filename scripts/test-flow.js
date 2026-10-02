import 'dotenv/config';

async function runTest() {
  try {
    const reg1 = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: 'Zohaib', phone: '03001111111', password: '123' })
    }).then(r => r.json());
    console.log('Reg Zohaib:', reg1);

    const reg2 = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: 'Ali', phone: '03002222222', password: '123' })
    }).then(r => r.json());
    console.log('Reg Ali:', reg2);

    const reg3 = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name: 'Raza', phone: '03003333333', password: '123' })
    }).then(r => r.json());
    console.log('Reg Raza:', reg3);

    const flat = await fetch('http://localhost:3000/api/flats/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: reg1.user.id, flatName: 'BEM Villa 101' })
    }).then(r => r.json());
    console.log('Flat Created:', flat);

    await fetch('http://localhost:3000/api/flats/join', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: reg2.user.id, code: flat.flat.code })
    });

    await fetch('http://localhost:3000/api/flats/join', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ userId: reg3.user.id, code: flat.flat.code })
    });

    // Log expense by Zohaib split among all 3 (Z, A, R)
    const exp = await fetch('http://localhost:3000/api/expenses', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        flatId: flat.flat.id,
        paidBy: reg1.user.id,
        title: 'Dinner & Sweets',
        amount: 300,
        category: 'Meal',
        splitUserIds: [reg1.user.id, reg2.user.id, reg3.user.id]
      })
    }).then(r => r.json());
    console.log('Expense Created:', exp);

    // Check balances
    const settleData = await fetch(`http://localhost:3000/api/settle?flatId=${flat.flat.id}&userId=${reg1.user.id}`).then(r => r.json());
    console.log('Bilateral Debt Transactions:', settleData.transactions);
  } catch (err) {
    console.error('Test error:', err);
  }
}

runTest();
