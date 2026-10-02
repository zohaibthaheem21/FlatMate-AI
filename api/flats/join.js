import { getDb } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { userId, code, phone, password } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if user exists and flat membership
    const users = await sql`SELECT id, flat_id FROM users WHERE id = ${userId}`;
    if (users.length === 0) {
      return res.status(404).json({ error: 'User account not found' });
    }
    if (users[0].flat_id) {
      const activeFlat = await sql`SELECT id FROM flats WHERE id = ${users[0].flat_id}`;
      if (activeFlat.length > 0) {
        return res.status(400).json({ error: 'You are already in a room. Leave your current room before joining another.' });
      } else {
        await sql`UPDATE users SET flat_id = NULL WHERE id = ${userId}`;
      }
    }

    let targetFlat = null;

    // 1. If joining via Room Phone & Password
    if (phone && password) {
      const trimmedPhone = String(phone).trim();
      const trimmedPass = String(password).trim();

      const flatsByPhone = await sql`
        SELECT id, name, code, password FROM flats WHERE phone = ${trimmedPhone}
      `;

      if (flatsByPhone.length === 0) {
        return res.status(404).json({ error: 'No room found with this Room Phone Number' });
      }

      const room = flatsByPhone[0];
      if (room.password && room.password !== trimmedPass) {
        return res.status(401).json({ error: 'Incorrect Room Password' });
      }
      targetFlat = { id: room.id, name: room.name, code: room.code };
    } 
    // 2. Joining via Unique Room Key or Roommate User Code
    else if (code && typeof code === 'string' && code.trim()) {
      const cleanCode = code.trim().toUpperCase();

      // Try matching flat code (ROOM-XXXX)
      const flatsByCode = await sql`
        SELECT id, name, code FROM flats WHERE UPPER(code) = ${cleanCode}
      `;

      if (flatsByCode.length > 0) {
        targetFlat = flatsByCode[0];
      } else {
        // Try matching roommate user code (e.g., ZOH-4821)
        const roommateResult = await sql`
          SELECT u.id, u.name, u.flat_id, f.name as flat_name, f.code as flat_code
          FROM users u
          JOIN flats f ON u.flat_id = f.id
          WHERE UPPER(u.user_code) = ${cleanCode}
        `;

        if (roommateResult.length > 0) {
          targetFlat = {
            id: roommateResult[0].flat_id,
            name: roommateResult[0].flat_name,
            code: roommateResult[0].flat_code
          };
        }
      }
    } else {
      return res.status(400).json({ error: 'Enter Unique Room Key (e.g. ROOM-5501) OR Room Phone & Password' });
    }

    if (!targetFlat) {
      return res.status(404).json({
        error: 'Invalid Room Key. No room found with this key or code.'
      });
    }

    // Join the flat
    await sql`
      UPDATE users
      SET flat_id = ${targetFlat.id}
      WHERE id = ${userId}
    `;

    await sql`
      INSERT INTO flat_members (flat_id, user_id)
      VALUES (${targetFlat.id}, ${userId})
      ON CONFLICT DO NOTHING
    `;

    const updatedUser = await sql`
      SELECT id, name, phone, user_code, flat_id
      FROM users
      WHERE id = ${userId}
    `;

    return res.status(200).json({
      success: true,
      flat: targetFlat,
      user: updatedUser[0]
    });
  } catch (error) {
    console.error('Join room error:', error);
    return res.status(500).json({ error: error.message || 'Failed to join room' });
  }
}
