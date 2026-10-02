import { getDb } from '../_db.js';

function generateUserCode(name) {
  const cleanName = (name || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  let prefix = cleanName.slice(0, 3);
  while (prefix.length < 3) {
    prefix += 'X';
  }
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomNum}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { name, phone, password, pin } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const passToUse = (password || pin || '').trim();
    if (!passToUse) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    // Check if phone number is already registered
    const existingPhone = await sql`SELECT id FROM users WHERE phone = ${trimmedPhone}`;
    if (existingPhone.length > 0) {
      return res.status(400).json({ error: 'An account with this phone number already exists. Please login instead.' });
    }

    // Generate unique user code
    let userCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      userCode = generateUserCode(trimmedName);
      const existing = await sql`SELECT id FROM users WHERE user_code = ${userCode}`;
      if (existing.length === 0) {
        isUnique = true;
      }
    }

    const result = await sql`
      INSERT INTO users (name, phone, password, pin, user_code)
      VALUES (${trimmedName}, ${trimmedPhone}, ${passToUse}, ${passToUse}, ${userCode})
      RETURNING id, name, phone, user_code, flat_id, created_at
    `;

    const user = result[0];
    return res.status(201).json({ success: true, user });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during registration' });
  }
}
