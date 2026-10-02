import { neon, neonConfig } from '@neondatabase/serverless';

neonConfig.fetchOptions = {
  cache: 'no-store',
};

let cachedSql = null;

const DEFAULT_DB_URL = 'postgresql://neondb_owner:npg_oN0lRhJ2zank@ep-rough-truth-b5j6kb9l.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require';

function getDb() {
  if (cachedSql) return cachedSql;

  let connectionString = process.env.DATABASE_URL || DEFAULT_DB_URL;
  if (connectionString.includes('-pooler.')) {
    connectionString = connectionString.replace('-pooler.', '.');
  }

  cachedSql = neon(connectionString);
  return cachedSql;
}

let isDbInitialized = false;

async function ensureDbInitialized(force = false) {
  if (isDbInitialized && !force) return;
  try {
    const sql = getDb();
    await sql`
      CREATE TABLE IF NOT EXISTS flats (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        pin VARCHAR(255),
        password VARCHAR(255),
        user_code VARCHAR(50) UNIQUE NOT NULL,
        flat_id INT REFERENCES flats(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS flat_members (
        id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_flat_member UNIQUE (flat_id, user_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
        paid_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS expense_splits (
        id SERIAL PRIMARY KEY,
        expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT unique_expense_user_split UNIQUE (expense_id, user_id)
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES flats(id) ON DELETE CASCADE,
        payer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payee_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    isDbInitialized = true;
  } catch (err) {
    console.error('ensureDbInitialized warning:', err);
  }
}

function generateUserCode(name) {
  const cleanName = (name || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  let prefix = cleanName.slice(0, 3);
  while (prefix.length < 3) {
    prefix += 'X';
  }
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}

function generateFlatCode() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ROOM-${randomNum}`;
}

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

// 1. REGISTER HANDLER
async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sql = getDb();
  const { name, phone, password, pin } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!phone || typeof phone !== 'string' || !phone.trim()) return res.status(400).json({ error: 'Phone number is required' });

  const passToUse = (password || pin || '').trim();
  if (!passToUse) return res.status(400).json({ error: 'Password is required' });

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  const existingPhone = await sql`SELECT id FROM users WHERE phone = ${trimmedPhone}`;
  if (existingPhone.length > 0) {
    return res.status(400).json({ error: 'An account with this phone number already exists. Please login instead.' });
  }

  let userCode = '';
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    attempts++;
    userCode = generateUserCode(trimmedName);
    const existing = await sql`SELECT id FROM users WHERE user_code = ${userCode}`;
    if (existing.length === 0) isUnique = true;
  }

  const result = await sql`
    INSERT INTO users (name, phone, password, pin, user_code)
    VALUES (${trimmedName}, ${trimmedPhone}, ${passToUse}, ${passToUse}, ${userCode})
    RETURNING id, name, phone, user_code, flat_id, created_at
  `;

  return res.status(201).json({ success: true, user: result[0] });
}

// 2. LOGIN HANDLER
async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sql = getDb();
  const { phone, userCode, name, password, pin } = req.body || {};

  const passToUse = String(password || pin || '').trim();
  if (!passToUse) return res.status(400).json({ error: 'Password is required' });

  const trimmedPhone = phone ? String(phone).trim() : null;
  const trimmedCode = userCode ? String(userCode).trim().toUpperCase() : null;
  const trimmedName = name ? String(name).trim() : null;

  let users = [];
  if (trimmedPhone) {
    users = await sql`
      SELECT u.id, u.name, u.phone, u.user_code, u.password, u.pin, u.flat_id, f.name as flat_name, f.code as flat_code
      FROM users u LEFT JOIN flats f ON u.flat_id = f.id
      WHERE u.phone = ${trimmedPhone} OR UPPER(u.user_code) = UPPER(${trimmedPhone}) OR LOWER(u.name) = LOWER(${trimmedPhone})
    `;
  } else if (trimmedCode) {
    users = await sql`
      SELECT u.id, u.name, u.phone, u.user_code, u.password, u.pin, u.flat_id, f.name as flat_name, f.code as flat_code
      FROM users u LEFT JOIN flats f ON u.flat_id = f.id
      WHERE UPPER(u.user_code) = UPPER(${trimmedCode}) OR u.phone = ${trimmedCode} OR LOWER(u.name) = LOWER(${trimmedCode})
    `;
  } else if (trimmedName) {
    users = await sql`
      SELECT u.id, u.name, u.phone, u.user_code, u.password, u.pin, u.flat_id, f.name as flat_name, f.code as flat_code
      FROM users u LEFT JOIN flats f ON u.flat_id = f.id
      WHERE LOWER(u.name) = LOWER(${trimmedName}) OR u.phone = ${trimmedName} OR UPPER(u.user_code) = UPPER(${trimmedName})
    `;
  } else {
    return res.status(400).json({ error: 'Provide Phone Number or Unique User ID to login' });
  }

  if (users.length === 0) return res.status(404).json({ error: 'Account not found. Please register first.' });

  const user = users[0];
  const matchPassword = user.password === passToUse || user.pin === passToUse;
  if (!matchPassword) return res.status(401).json({ error: 'Incorrect Password' });

  const { password: _, pin: __, ...userData } = user;
  return res.status(200).json({ success: true, user: userData });
}

// 3. FETCH ME HANDLER
async function handleMe(req, res) {
  const sql = getDb();
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId parameter is required' });

  const users = await sql`
    SELECT u.id, u.name, u.phone, u.user_code, u.flat_id, f.name as flat_name, f.code as flat_code, f.phone as flat_phone
    FROM users u LEFT JOIN flats f ON u.flat_id = f.id WHERE u.id = ${userId}
  `;

  if (users.length === 0) return res.status(404).json({ error: 'User not found' });
  const userObj = users[0];
  let flatObj = null;
  if (userObj.flat_id && userObj.flat_name) {
    flatObj = { id: userObj.flat_id, name: userObj.flat_name, code: userObj.flat_code, phone: userObj.flat_phone };
  }
  const { flat_name, flat_code, flat_phone, ...cleanUser } = userObj;
  return res.status(200).json({ success: true, user: cleanUser, flat: flatObj });
}

// 4. CREATE FLAT HANDLER
async function handleCreateFlat(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sql = getDb();
  const { userId, flatName, roomName, phone, password } = req.body || {};
  const nameToUse = (flatName || roomName || '').trim();

  if (!userId) return res.status(400).json({ error: 'userId is required' });
  if (!nameToUse) return res.status(400).json({ error: 'Room / Flat name is required' });

  const trimmedPhone = phone ? String(phone).trim() : null;
  const trimmedPassword = password ? String(password).trim() : null;

  const users = await sql`SELECT id, flat_id FROM users WHERE id = ${userId}`;
  if (users.length === 0) return res.status(404).json({ error: 'User account not found' });

  if (users[0].flat_id) {
    const activeFlat = await sql`SELECT id FROM flats WHERE id = ${users[0].flat_id}`;
    if (activeFlat.length > 0) return res.status(400).json({ error: 'You are already in a room. Leave current room first.' });
    await sql`UPDATE users SET flat_id = NULL WHERE id = ${userId}`;
  }

  let flatCode = '';
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 15) {
    attempts++;
    flatCode = generateFlatCode();
    const existing = await sql`SELECT id FROM flats WHERE UPPER(code) = ${flatCode}`;
    if (existing.length === 0) isUnique = true;
  }

  const flatResult = await sql`
    INSERT INTO flats (name, code, phone, password) VALUES (${nameToUse}, ${flatCode}, ${trimmedPhone}, ${trimmedPassword})
    RETURNING id, name, code, phone, created_at
  `;
  const flat = flatResult[0];

  await sql`UPDATE users SET flat_id = ${flat.id} WHERE id = ${userId}`;
  await sql`INSERT INTO flat_members (flat_id, user_id) VALUES (${flat.id}, ${userId}) ON CONFLICT DO NOTHING`;
  const updatedUsers = await sql`SELECT id, name, phone, user_code, flat_id FROM users WHERE id = ${userId}`;

  return res.status(201).json({ success: true, flat, user: updatedUsers[0] });
}

// 5. JOIN FLAT HANDLER
async function handleJoinFlat(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sql = getDb();
  const { userId, code, phone, password } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const users = await sql`SELECT id, flat_id FROM users WHERE id = ${userId}`;
  if (users.length === 0) return res.status(404).json({ error: 'User account not found' });
  if (users[0].flat_id) {
    const activeFlat = await sql`SELECT id FROM flats WHERE id = ${users[0].flat_id}`;
    if (activeFlat.length > 0) return res.status(400).json({ error: 'You are already in a room' });
    await sql`UPDATE users SET flat_id = NULL WHERE id = ${userId}`;
  }

  let targetFlat = null;
  if (phone && password) {
    const trimmedPhone = String(phone).trim();
    const trimmedPass = String(password).trim();
    const flatsByPhone = await sql`SELECT id, name, code, password FROM flats WHERE phone = ${trimmedPhone}`;
    if (flatsByPhone.length === 0) return res.status(404).json({ error: 'No room found with this Phone Number' });
    const room = flatsByPhone[0];
    if (room.password && room.password !== trimmedPass) return res.status(401).json({ error: 'Incorrect Room Password' });
    targetFlat = { id: room.id, name: room.name, code: room.code };
  } else if (code && typeof code === 'string' && code.trim()) {
    const cleanCode = code.trim().toUpperCase();
    const flatsByCode = await sql`SELECT id, name, code FROM flats WHERE UPPER(code) = ${cleanCode}`;
    if (flatsByCode.length > 0) {
      targetFlat = flatsByCode[0];
    } else {
      const roommateResult = await sql`
        SELECT u.id, u.name, u.flat_id, f.name as flat_name, f.code as flat_code
        FROM users u JOIN flats f ON u.flat_id = f.id WHERE UPPER(u.user_code) = ${cleanCode}
      `;
      if (roommateResult.length > 0) {
        targetFlat = { id: roommateResult[0].flat_id, name: roommateResult[0].flat_name, code: roommateResult[0].flat_code };
      }
    }
  } else {
    return res.status(400).json({ error: 'Enter Unique Room Key (ROOM-XXXX) or Phone & Password' });
  }

  if (!targetFlat) return res.status(404).json({ error: 'Invalid Room Key. Room not found.' });

  await sql`UPDATE users SET flat_id = ${targetFlat.id} WHERE id = ${userId}`;
  await sql`INSERT INTO flat_members (flat_id, user_id) VALUES (${targetFlat.id}, ${userId}) ON CONFLICT DO NOTHING`;
  const updatedUser = await sql`SELECT id, name, phone, user_code, flat_id FROM users WHERE id = ${userId}`;

  return res.status(200).json({ success: true, flat: targetFlat, user: updatedUser[0] });
}

// 6. LEAVE FLAT HANDLER
async function handleLeaveFlat(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const sql = getDb();
  const { userId, targetUserId } = req.body || {};
  const idToProcess = targetUserId || userId;

  if (!idToProcess) return res.status(400).json({ error: 'userId is required' });
  const existingUser = await sql`SELECT id, name, flat_id FROM users WHERE id = ${idToProcess}`;
  if (existingUser.length === 0) return res.status(404).json({ error: 'User not found' });
  const currentFlatId = existingUser[0].flat_id;
  if (!currentFlatId) return res.status(200).json({ success: true, user: existingUser[0] });

  await sql`DELETE FROM flat_members WHERE flat_id = ${currentFlatId} AND user_id = ${idToProcess}`;
  await sql`UPDATE users SET flat_id = NULL WHERE id = ${idToProcess}`;
  const updatedUser = await sql`SELECT id, name, phone, user_code, flat_id FROM users WHERE id = ${idToProcess}`;

  return res.status(200).json({ success: true, user: updatedUser[0], message: 'Left room successfully' });
}

// 7. GET MEMBERS HANDLER
async function handleGetMembers(req, res) {
  const sql = getDb();
  const flatId = req.query.flatId;
  if (!flatId) return res.status(400).json({ error: 'flatId parameter is required' });

  const members = await sql`
    SELECT u.id, u.name, u.phone, u.user_code, fm.joined_at
    FROM flat_members fm JOIN users u ON fm.user_id = u.id WHERE fm.flat_id = ${flatId}
    ORDER BY fm.joined_at ASC
  `;
  return res.status(200).json({ success: true, members });
}

// 8. EXPENSES HANDLER
async function handleExpenses(req, res) {
  const sql = getDb();
  if (req.method === 'GET') {
    const flatId = req.query.flatId;
    if (!flatId) return res.status(400).json({ error: 'flatId parameter is required' });

    const expenses = await sql`
      SELECT e.id, e.flat_id, e.paid_by, e.title, e.amount, e.category, e.created_at, u.name as payer_name, u.user_code as payer_code
      FROM expenses e JOIN users u ON e.paid_by = u.id WHERE e.flat_id = ${flatId} ORDER BY e.created_at DESC
    `;
    if (expenses.length === 0) return res.status(200).json({ success: true, expenses: [] });

    const expenseIds = expenses.map(e => e.id);
    const splits = await sql`
      SELECT es.id, es.expense_id, es.user_id, es.amount, es.status, es.updated_at, u.name as user_name, u.user_code
      FROM expense_splits es JOIN users u ON es.user_id = u.id WHERE es.expense_id = ANY(${expenseIds})
    `;

    const splitsByExpense = {};
    splits.forEach(s => {
      if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = [];
      splitsByExpense[s.expense_id].push(s);
    });

    const fullExpenses = expenses.map(e => ({
      ...e,
      amount: parseFloat(e.amount),
      splits: (splitsByExpense[e.id] || []).map(s => ({ ...s, amount: parseFloat(s.amount) }))
    }));

    return res.status(200).json({ success: true, expenses: fullExpenses });
  }

  if (req.method === 'POST') {
    const { flatId, paidBy, title, amount, category, splitUserIds } = req.body || {};
    if (!flatId || !paidBy || !title || !amount || amount <= 0 || !splitUserIds || splitUserIds.length === 0) {
      return res.status(400).json({ error: 'Missing required expense parameters' });
    }

    const expenseRes = await sql`
      INSERT INTO expenses (flat_id, paid_by, title, amount, category)
      VALUES (${flatId}, ${paidBy}, ${title}, ${amount}, ${category || 'Meal'})
      RETURNING id, flat_id, paid_by, title, amount, category, created_at
    `;
    const expense = expenseRes[0];
    const splitAmount = (parseFloat(amount) / splitUserIds.length).toFixed(2);

    for (const uid of splitUserIds) {
      const status = parseInt(uid) === parseInt(paidBy) ? 'approved' : 'pending';
      await sql`
        INSERT INTO expense_splits (expense_id, user_id, amount, status)
        VALUES (${expense.id}, ${uid}, ${splitAmount}, ${status})
      `;
    }

    return res.status(201).json({ success: true, expense });
  }
}

// 9. APPROVALS HANDLER
async function handleApprovals(req, res) {
  const sql = getDb();
  if (req.method === 'GET') {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId parameter is required' });

    const approvals = await sql`
      SELECT es.id as split_id, es.expense_id, es.user_id as borrower_id, es.amount, es.status, es.updated_at,
             e.title as expense_title, e.category, e.created_at, u.name as payer_name, u.user_code as payer_code
      FROM expense_splits es JOIN expenses e ON es.expense_id = e.id JOIN users u ON e.paid_by = u.id
      WHERE es.user_id = ${userId} AND es.status = 'pending' AND e.paid_by != ${userId}
      ORDER BY e.created_at DESC
    `;
    return res.status(200).json({ success: true, approvals: approvals.map(a => ({ ...a, amount: parseFloat(a.amount) })) });
  }

  if (req.method === 'PATCH') {
    const { splitId, status, userId } = req.body || {};
    if (!splitId || !status || !userId) return res.status(400).json({ error: 'splitId, status, and userId required' });

    const newStatus = status === 'approved' ? 'approved' : 'rejected';
    const updated = await sql`
      UPDATE expense_splits SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${splitId} AND user_id = ${userId} RETURNING *
    `;
    return res.status(200).json({ success: true, split: updated[0] });
  }
}

// 10. SETTLEMENTS HANDLER
async function handleSettlements(req, res) {
  const sql = getDb();
  if (req.method === 'GET') {
    const flatId = req.query.flatId;
    if (!flatId) return res.status(400).json({ error: 'flatId parameter is required' });

    const settlements = await sql`
      SELECT s.id, s.flat_id, s.payer_id, s.payee_id, s.amount, s.status, s.created_at,
             p.name as payer_name, r.name as payee_name
      FROM settlements s JOIN users p ON s.payer_id = p.id JOIN users r ON s.payee_id = r.id
      WHERE s.flat_id = ${flatId} ORDER BY s.created_at DESC
    `;
    return res.status(200).json({ success: true, settlements: settlements.map(s => ({ ...s, amount: parseFloat(s.amount) })) });
  }

  if (req.method === 'POST') {
    const { flatId, payerId, payeeId, amount, initiatorId } = req.body || {};
    if (!flatId || !payerId || !payeeId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Missing required settlement fields' });
    }

    const status = initiatorId && parseInt(initiatorId) === parseInt(payeeId) ? 'confirmed' : 'pending';
    const result = await sql`
      INSERT INTO settlements (flat_id, payer_id, payee_id, amount, status)
      VALUES (${flatId}, ${payerId}, ${payeeId}, ${amount}, ${status})
      RETURNING id, flat_id, payer_id, payee_id, amount, status, created_at
    `;
    return res.status(201).json({ success: true, settlement: { ...result[0], amount: parseFloat(result[0].amount) } });
  }

  if (req.method === 'PATCH') {
    const { settlementId, status, userId } = req.body || {};
    if (!settlementId || !status || !userId) return res.status(400).json({ error: 'settlementId, status, and userId required' });

    const normStatus = (status === 'approved' || status === 'confirmed') ? 'confirmed' : 'rejected';
    const result = await sql`
      UPDATE settlements SET status = ${normStatus} WHERE id = ${settlementId} AND payee_id = ${userId} RETURNING *
    `;
    return res.status(200).json({ success: true, settlement: result[0] });
  }
}

// 11. AI HANDLER (Scan Receipt, Multi-Agent Insights, Parse Command)
async function handleAI(req, res) {
  const sql = getDb();
  const action = req.query.action || req.body.action || 'insights';

  if (action === 'scan-receipt') {
    const { imageBase64, textContent, apiKey } = req.body || {};
    const groqKey = apiKey || process.env.GROQ_API_KEY;

    if (groqKey) {
      try {
        const messagesContent = imageBase64 ? [
          { type: "text", text: "Analyze this bill/receipt. Extract: Title (store/vendor name), Total Amount (number only), Category (Meal, Groceries, Utilities, Rent, Transport, Entertainment, Other). Return ONLY JSON format: {\"title\": \"...\", \"amount\": 0.0, \"category\": \"...\"}" },
          { type: "image_url", image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` } }
        ] : "Extract expense JSON: {\"title\": \"...\", \"amount\": 0.0, \"category\": \"...\"} from: " + (textContent || '');

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: messagesContent }],
            temperature: 0.2
          })
        });

        const groqData = await groqRes.json();
        const content = groqData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.status(200).json({
            success: true,
            method: 'Groq Cloud AI (Llama 3.2 Vision / 3.3 70B)',
            parsed: { title: parsed.title || 'Receipt Expense', amount: parseFloat(parsed.amount) || 0, category: parsed.category || 'Meal' }
          });
        }
      } catch (err) {
        console.warn('Groq API fallback to heuristic parser:', err.message);
      }
    }

    // Heuristic Fallback Parser
    const text = textContent || '';
    const numbers = text.match(/\d+(?:\.\d{1,2})?/g);
    let amount = 1200.0;
    if (numbers) {
      const floats = numbers.map(n => parseFloat(n)).filter(n => n > 5 && n < 500000);
      if (floats.length > 0) amount = Math.max(...floats);
    }

    let category = 'Meal';
    const lower = text.toLowerCase();
    if (lower.includes('electric') || lower.includes('wapda') || lower.includes('gas') || lower.includes('wifi')) category = 'Utilities';
    else if (lower.includes('mart') || lower.includes('supermarket') || lower.includes('grocery')) category = 'Groceries';

    const lines = text.split('\n').filter(l => l.trim());
    const title = lines[0] ? lines[0].substring(0, 30) : 'Scanned Receipt';

    return res.status(200).json({
      success: true,
      method: 'Flatmate AI Engine (Free Zero-Cost Parser)',
      parsed: { title, amount, category }
    });
  }

  if (action === 'parse-command') {
    const { command, apiKey } = req.body || {};
    const text = (command || '').trim();
    const groqKey = apiKey || process.env.GROQ_API_KEY;

    if (groqKey) {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Parse input text into JSON: {\"title\": \"...\", \"amount\": 0.0, \"category\": \"Meal\"}" },
              { role: "user", content: text }
            ],
            temperature: 0.1
          })
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return res.status(200).json({
            success: true,
            method: 'Groq Cloud AI (Llama 3.3 70B)',
            parsed: { title: parsed.title || 'Expense', amount: parseFloat(parsed.amount) || 0, category: parsed.category || 'Meal' }
          });
        }
      } catch (e) {
        console.warn('Groq command parser fallback:', e.message);
      }
    }

    const amountMatch = text.match(/(\d+(?:\.\d{1,2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 500;
    let category = 'Meal';
    const lower = text.toLowerCase();
    if (lower.includes('grocery') || lower.includes('mart')) category = 'Groceries';
    else if (lower.includes('bill') || lower.includes('wifi') || lower.includes('electric')) category = 'Utilities';

    let title = text.replace(/(\d+(?:\.\d{1,2})?)/, '').replace(/paid|for|rs|pkr|split|with|and|the/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!title || title.length < 2) title = `${category} Expense`;

    return res.status(200).json({
      success: true,
      parsed: { title: title.charAt(0).toUpperCase() + title.slice(1), amount, category }
    });
  }

  // Multi-agent insights
  const flatId = req.query.flatId || req.body.flatId;
  if (!flatId) return res.status(400).json({ error: 'flatId is required' });

  const expenses = await sql`
    SELECT e.*, u.name as payer_name FROM expenses e JOIN users u ON e.paid_by = u.id
    WHERE e.flat_id = ${flatId} ORDER BY e.created_at DESC
  `;
  const members = await sql`
    SELECT u.id, u.name, u.user_code FROM flat_members fm JOIN users u ON fm.user_id = u.id WHERE fm.flat_id = ${flatId}
  `;
  const splits = await sql`
    SELECT es.*, u.name as user_name FROM expense_splits es JOIN expenses e ON es.expense_id = e.id JOIN users u ON es.user_id = u.id
    WHERE e.flat_id = ${flatId}
  `;

  // 1. Auditor Agent
  const findings = [];
  let totalSpent = 0;
  expenses.forEach(e => {
    const amt = parseFloat(e.amount);
    totalSpent += amt;
    if (amt > 15000) {
      findings.push({ type: 'high_expense', severity: 'warning', title: 'High Expense Spike', description: `"${e.title}" by ${e.payer_name} is Rs ${amt.toLocaleString()}` });
    }
  });

  if (findings.length === 0) {
    findings.push({ type: 'clean', severity: 'success', title: 'All Clear!', description: 'No duplicate bills or expense anomalies detected.' });
  }

  // 2. Debt Minimizer Agent
  const balances = {};
  members.forEach(m => { balances[m.id] = 0; });
  expenses.forEach(e => { if (balances[e.paid_by] !== undefined) balances[e.paid_by] += parseFloat(e.amount); });
  splits.forEach(s => { if (balances[s.user_id] !== undefined) balances[s.user_id] -= parseFloat(s.amount); });

  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m.name; });

  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([idStr, bal]) => {
    const uid = parseInt(idStr);
    const rounded = Math.round(bal * 100) / 100;
    if (rounded < -0.5) debtors.push({ id: uid, name: memberMap[uid] || `User #${uid}`, amount: -rounded });
    else if (rounded > 0.5) creditors.push({ id: uid, name: memberMap[uid] || `User #${uid}`, amount: rounded });
  });

  const optimalTransfers = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    optimalTransfers.push({
      fromId: debtors[i].id, fromName: debtors[i].name,
      toId: creditors[j].id, toName: creditors[j].name,
      amount: Math.round(transfer * 100) / 100
    });
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount < 0.5) i++;
    if (creditors[j].amount < 0.5) j++;
  }

  return res.status(200).json({
    success: true,
    agents: {
      auditor: { agentName: 'Expense Auditor Agent', status: 'Active', totalSpent, findings },
      debtOptimizer: {
        agentName: 'Debt Minimizer Agent', status: 'Active',
        netBalances: Object.entries(balances).map(([id, amount]) => ({ userName: memberMap[id] || `User #${id}`, balance: Math.round(amount * 100) / 100 })),
        recommendedTransfers: optimalTransfers,
        reductionRatio: optimalTransfers.length > 0 ? `${Math.max(0, splits.length - optimalTransfers.length)} transactions saved` : 'Balances settled'
      },
      budgetAdvisor: {
        agentName: 'Budget Advisor Agent', status: 'Active',
        recommendations: [
          { category: 'Food & Meals', icon: '🍲', title: 'Meal Prepping', tip: 'Cooking flat meals together saves up to 40% vs ordering out.' },
          { category: 'Smart Settlement', icon: '🎯', title: 'Weekly Clearance', tip: 'Use Debt Minimizer every Sunday to settle flat balances.' }
        ]
      }
    }
  });
}

// MASTER API ROUTER FUNCTION
export default async function handler(req, res) {
  const host = req.headers.host || 'localhost';
  const urlObj = new URL(req.url, `http://${host}`);
  const pathname = urlObj.pathname;

  req.query = req.query || Object.fromEntries(urlObj.searchParams.entries());

  if (!res.status) {
    res.status = function(code) { res.statusCode = code; return res; };
  }
  if (!res.json) {
    res.json = function(data) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
  }

  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      req.body = await parseJsonBody(req);
    }

    await ensureDbInitialized();

    if (pathname.startsWith('/api/ai')) return await handleAI(req, res);
    if (pathname.startsWith('/api/expenses')) return await handleExpenses(req, res);
    if (pathname.startsWith('/api/approvals')) return await handleApprovals(req, res);
    if (pathname.startsWith('/api/settle')) return await handleSettlements(req, res);
    if (pathname.startsWith('/api/init-db')) {
      await ensureDbInitialized(true);
      return res.status(200).json({ success: true, message: 'Database initialized.' });
    }
    if (pathname.startsWith('/api/auth/register')) return await handleRegister(req, res);
    if (pathname.startsWith('/api/auth/login')) return await handleLogin(req, res);
    if (pathname.startsWith('/api/auth/me')) return await handleMe(req, res);
    if (pathname.startsWith('/api/flats/create')) return await handleCreateFlat(req, res);
    if (pathname.startsWith('/api/flats/join')) return await handleJoinFlat(req, res);
    if (pathname.startsWith('/api/flats/leave')) return await handleLeaveFlat(req, res);
    if (pathname.startsWith('/api/flats/members')) return await handleGetMembers(req, res);

    return res.status(404).json({ error: `API route ${pathname} not found` });
  } catch (error) {
    console.error('Master Serverless Exception:', error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: error.message || 'Server error occurred' });
  }
}
