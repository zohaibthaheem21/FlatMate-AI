import { getDb } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = getDb();
    const { flatId } = req.query;

    if (!flatId) {
      return res.status(400).json({ error: 'flatId query parameter is required' });
    }

    const members = await sql`
      SELECT u.id, u.name, u.user_code, fm.joined_at
      FROM flat_members fm
      JOIN users u ON fm.user_id = u.id
      WHERE fm.flat_id = ${flatId}
      ORDER BY fm.joined_at ASC
    `;

    return res.status(200).json({ success: true, members });
  } catch (error) {
    console.error('Fetch flat members error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch flat members' });
  }
}
