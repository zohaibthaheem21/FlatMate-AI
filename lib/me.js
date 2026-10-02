import { getDb } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId parameter is required' });
    }

    const users = await sql`
      SELECT u.id, u.name, u.phone, u.user_code, u.flat_id, f.name as flat_name, f.code as flat_code, f.phone as flat_phone
      FROM users u
      LEFT JOIN flats f ON u.flat_id = f.id
      WHERE u.id = ${userId}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userObj = users[0];

    let flatObj = null;
    if (userObj.flat_id && userObj.flat_name) {
      flatObj = {
        id: userObj.flat_id,
        name: userObj.flat_name,
        code: userObj.flat_code,
        phone: userObj.flat_phone
      };
    }

    const { flat_name, flat_code, flat_phone, ...cleanUser } = userObj;

    return res.status(200).json({
      success: true,
      user: cleanUser,
      flat: flatObj
    });
  } catch (error) {
    console.error('Fetch me error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
