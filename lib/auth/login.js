import { getDb } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { phone, userCode, name, password, pin } = req.body || {};

    const passToUse = String(password || pin || '').trim();
    if (!passToUse) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const trimmedPhone = phone ? String(phone).trim() : null;
    const trimmedCode = userCode ? String(userCode).trim().toUpperCase() : null;
    const trimmedName = name ? String(name).trim() : null;

    let users = [];
    if (trimmedPhone) {
      users = await sql`
        SELECT u.id, u.name, u.phone, u.user_code, u.password, u.pin, u.flat_id, f.name as flat_name, f.code as flat_code
        FROM users u
        LEFT JOIN flats f ON u.flat_id = f.id
        WHERE u.phone = ${trimmedPhone}
           OR UPPER(u.user_code) = UPPER(${trimmedPhone})
           OR LOWER(u.name) = LOWER(${trimmedPhone})
      `;
    } else if (trimmedCode) {
      users = await sql`
        SELECT u.id, u.name, u.phone, u.user_code, u.password, u.pin, u.flat_id, f.name as flat_name, f.code as flat_code
        FROM users u
        LEFT JOIN flats f ON u.flat_id = f.id
        WHERE UPPER(u.user_code) = UPPER(${trimmedCode})
           OR u.phone = ${trimmedCode}
           OR LOWER(u.name) = LOWER(${trimmedCode})
      `;
    } else if (trimmedName) {
      users = await sql`
        SELECT u.id, u.name, u.phone, u.user_code, u.password, u.pin, u.flat_id, f.name as flat_name, f.code as flat_code
        FROM users u
        LEFT JOIN flats f ON u.flat_id = f.id
        WHERE LOWER(u.name) = LOWER(${trimmedName})
           OR u.phone = ${trimmedName}
           OR UPPER(u.user_code) = UPPER(${trimmedName})
      `;
    } else {
      return res.status(400).json({ error: 'Provide Phone Number or Unique User ID to login' });
    }

    if (users.length === 0) {
      return res.status(404).json({ error: 'Account not found. Please register first.' });
    }

    const user = users[0];
    const matchPassword = user.password === passToUse || user.pin === passToUse;

    if (!matchPassword) {
      return res.status(401).json({ error: 'Incorrect Password' });
    }

    // Omit password from response
    const { password: _, pin: __, ...userData } = user;
    return res.status(200).json({ success: true, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during login' });
  }
}
