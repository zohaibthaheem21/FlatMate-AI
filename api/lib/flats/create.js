import { getDb } from '../_db.js';

function generateFlatCode() {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ROOM-${randomNum}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { userId, flatName, roomName, phone, password } = req.body || {};

    const nameToUse = (flatName || roomName || '').trim();

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!nameToUse) {
      return res.status(400).json({ error: 'Room / Flat name is required' });
    }

    const trimmedPhone = phone ? String(phone).trim() : null;
    const trimmedPassword = password ? String(password).trim() : null;

    // Verify user exists
    const users = await sql`SELECT id, flat_id FROM users WHERE id = ${userId}`;
    if (users.length === 0) {
      return res.status(404).json({ error: 'User account not found. Please log in again.' });
    }

    // Check if user has an active flat
    if (users[0].flat_id) {
      const activeFlat = await sql`SELECT id FROM flats WHERE id = ${users[0].flat_id}`;
      if (activeFlat.length > 0) {
        return res.status(400).json({ error: 'You are already in a room. Leave your current room before creating a new one.' });
      } else {
        // Orphaned flat_id -> clear it
        await sql`UPDATE users SET flat_id = NULL WHERE id = ${userId}`;
      }
    }

    // Generate unique room code
    let flatCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 15) {
      attempts++;
      flatCode = generateFlatCode();
      const existing = await sql`SELECT id FROM flats WHERE UPPER(code) = ${flatCode}`;
      if (existing.length === 0) {
        isUnique = true;
      }
    }

    // Insert flat
    const flatResult = await sql`
      INSERT INTO flats (name, code, phone, password)
      VALUES (${nameToUse}, ${flatCode}, ${trimmedPhone}, ${trimmedPassword})
      RETURNING id, name, code, phone, created_at
    `;
    const flat = flatResult[0];

    // Update user flat_id
    await sql`
      UPDATE users
      SET flat_id = ${flat.id}
      WHERE id = ${userId}
    `;

    // Add to flat_members
    await sql`
      INSERT INTO flat_members (flat_id, user_id)
      VALUES (${flat.id}, ${userId})
      ON CONFLICT DO NOTHING
    `;

    const updatedUsers = await sql`
      SELECT id, name, phone, user_code, flat_id
      FROM users
      WHERE id = ${userId}
    `;

    return res.status(201).json({
      success: true,
      flat,
      user: updatedUsers[0]
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create room' });
  }
}
