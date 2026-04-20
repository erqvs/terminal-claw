import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();
const VALID_OWNERS = new Set(['me', 'partner']);

router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerFilter = req.query.owner;
    let sql = 'SELECT * FROM schedule_time_slots ORDER BY owner, slot_number';
    const params: string[] = [];

    if (typeof ownerFilter === 'string' && VALID_OWNERS.has(ownerFilter)) {
      sql = 'SELECT * FROM schedule_time_slots WHERE owner = ? ORDER BY slot_number';
      params.push(ownerFilter);
    }

    const [rows] = params.length > 0
      ? await pool.execute(sql, params)
      : await pool.execute(sql);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: '获取时间配置失败' });
  }
});

router.put('/batch', async (req: Request, res: Response) => {
  const { owner, slots } = req.body;

  if (typeof owner !== 'string' || !VALID_OWNERS.has(owner)) {
    res.status(400).json({ error: 'owner 参数无效，应为 me 或 partner' });
    return;
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    res.status(400).json({ error: 'slots 不能为空' });
    return;
  }

  for (const slot of slots) {
    const { slot_number, start_time, end_time } = slot;
    if (
      !Number.isInteger(slot_number) || slot_number < 1 || slot_number > 20 ||
      typeof start_time !== 'string' || !/^\d{2}:\d{2}$/.test(start_time) ||
      typeof end_time !== 'string' || !/^\d{2}:\d{2}$/.test(end_time)
    ) {
      res.status(400).json({ error: `slot_number ${slot_number} 数据格式无效` });
      return;
    }
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM schedule_time_slots WHERE owner = ?', [owner]);

    for (const slot of slots) {
      await connection.execute(
        'INSERT INTO schedule_time_slots (owner, slot_number, start_time, end_time) VALUES (?, ?, ?, ?)',
        [owner, slot.slot_number, slot.start_time, slot.end_time]
      );
    }

    await connection.commit();
    res.json({ success: true, message: `已更新 ${owner} 的时间配置，共 ${slots.length} 个节次` });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating time slots:', error);
    res.status(500).json({ error: '更新时间配置失败' });
  } finally {
    connection.release();
  }
});

export default router;
