import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();
const MAX_TIME_SLOT = 12;
const VALID_OWNERS = new Set(['me', 'partner']);

interface NormalizedCoursePayload {
  name: string;
  teacher: string | null;
  location: string | null;
  color: string;
  dayOfWeek: number;
  timeSlot: number[];
  weeks: number[];
  owner: string;
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeNumberList(values: unknown, min: number, max = Number.MAX_SAFE_INTEGER): number[] {
  return Array.from(
    new Set(
      parseJsonArray(values)
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= min && value <= max)
    )
  ).sort((left, right) => left - right);
}

function isConsecutive(values: number[]): boolean {
  return values.every((value, index) => index === 0 || value === values[index - 1] + 1);
}

function numberListsOverlap(left: number[], right: number[]): boolean {
  if (left.length === 0 || right.length === 0) {
    return true;
  }

  const [smaller, larger] = left.length <= right.length ? [left, right] : [right, left];
  const smallerSet = new Set(smaller);

  return larger.some((value) => smallerSet.has(value));
}

function coursesConflict(
  left: Pick<NormalizedCoursePayload, 'timeSlot' | 'weeks'>,
  right: Pick<NormalizedCoursePayload, 'timeSlot' | 'weeks'>
): boolean {
  return numberListsOverlap(left.timeSlot, right.timeSlot) && numberListsOverlap(left.weeks, right.weeks);
}

function normalizeStoredCourse(row: any) {
  return {
    ...row,
    owner: typeof row.owner === 'string' && VALID_OWNERS.has(row.owner) ? row.owner : 'me',
    time_slot: normalizeNumberList(row.time_slot, 1, MAX_TIME_SLOT),
    weeks: normalizeNumberList(row.weeks, 1),
  };
}

function normalizeOwner(value: unknown): string {
  if (typeof value === 'string' && VALID_OWNERS.has(value)) {
    return value;
  }
  return 'me';
}

function parseCoursePayload(body: any): { data?: NormalizedCoursePayload; error?: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const dayOfWeek = Number(body.day_of_week);
  const timeSlot = normalizeNumberList(body.time_slot, 1, MAX_TIME_SLOT);
  const weeks = normalizeNumberList(body.weeks, 1);
  const owner = normalizeOwner(body.owner);

  if (!name) {
    return { error: '课程名称不能为空' };
  }

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return { error: '星期参数无效' };
  }

  if (timeSlot.length === 0) {
    return { error: '至少选择一个上课节次' };
  }

  if (!isConsecutive(timeSlot)) {
    return { error: '上课节次必须连续，不能跳节' };
  }

  return {
    data: {
      name,
      teacher: typeof body.teacher === 'string' && body.teacher.trim() ? body.teacher.trim() : null,
      location: typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null,
      color: typeof body.color === 'string' && body.color.trim() ? body.color.trim() : '#1890ff',
      dayOfWeek,
      timeSlot,
      weeks,
      owner,
    },
  };
}

async function findConflictingCourse(
  dayOfWeek: number,
  timeSlot: number[],
  weeks: number[],
  owner: string,
  excludeId?: number
): Promise<number | null> {
  const sql = excludeId === undefined
    ? 'SELECT id, time_slot, weeks FROM schedule_courses WHERE day_of_week = ? AND owner = ?'
    : 'SELECT id, time_slot, weeks FROM schedule_courses WHERE day_of_week = ? AND owner = ? AND id != ?';
  const params = excludeId === undefined ? [dayOfWeek, owner] : [dayOfWeek, owner, excludeId];
  const [rows] = await pool.execute(sql, params);

  for (const row of rows as any[]) {
    const existingCourse = normalizeStoredCourse(row);
    if (coursesConflict({ timeSlot, weeks }, { timeSlot: existingCourse.time_slot, weeks: existingCourse.weeks })) {
      return Number(row.id);
    }
  }

  return null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const ownerFilter = req.query.owner;
    let sql = 'SELECT * FROM schedule_courses';
    const params: string[] = [];

    if (typeof ownerFilter === 'string' && VALID_OWNERS.has(ownerFilter)) {
      sql += ' WHERE owner = ?';
      params.push(ownerFilter);
    }

    sql += ' ORDER BY owner, day_of_week, time_slot';

    const [rows] = params.length > 0
      ? await pool.execute(sql, params)
      : await pool.execute(sql);
    const courses = (rows as any[]).map(normalizeStoredCourse);
    res.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: '获取课程失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { data, error } = parseCoursePayload(req.body);

  if (!data) {
    res.status(400).json({ error: error || '缺少必要参数' });
    return;
  }

  try {
    const conflictingCourseId = await findConflictingCourse(data.dayOfWeek, data.timeSlot, data.weeks, data.owner);

    if (conflictingCourseId !== null) {
      res.status(409).json({ error: '所选节次在这些周次已有其他课程' });
      return;
    }

    const timeSlotJson = JSON.stringify(data.timeSlot);
    const weeksJson = JSON.stringify(data.weeks);

    const [result] = await pool.execute(
      `INSERT INTO schedule_courses (name, teacher, location, color, day_of_week, time_slot, weeks, owner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.teacher, data.location, data.color, data.dayOfWeek, timeSlotJson, weeksJson, data.owner]
    );

    res.status(201).json({
      id: (result as any).insertId,
      name: data.name,
      teacher: data.teacher,
      location: data.location,
      color: data.color,
      day_of_week: data.dayOfWeek,
      time_slot: data.timeSlot,
      weeks: data.weeks,
      owner: data.owner,
    });
  } catch (error) {
    console.error('Error saving course:', error);
    res.status(500).json({ error: '保存课程失败' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const courseId = Number(req.params.id);
  const { data, error } = parseCoursePayload(req.body);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    res.status(400).json({ error: '课程 ID 无效' });
    return;
  }

  if (!data) {
    res.status(400).json({ error: error || '缺少必要参数' });
    return;
  }

  try {
    const conflictingCourseId = await findConflictingCourse(data.dayOfWeek, data.timeSlot, data.weeks, data.owner, courseId);

    if (conflictingCourseId !== null) {
      res.status(409).json({ error: '所选节次在这些周次已有其他课程' });
      return;
    }

    const timeSlotJson = JSON.stringify(data.timeSlot);
    const weeksJson = JSON.stringify(data.weeks);

    const [result] = await pool.execute(
      'UPDATE schedule_courses SET name = ?, teacher = ?, location = ?, color = ?, day_of_week = ?, time_slot = ?, weeks = ?, owner = ? WHERE id = ?',
      [data.name, data.teacher, data.location, data.color, data.dayOfWeek, timeSlotJson, weeksJson, data.owner, courseId]
    );

    if ((result as any).affectedRows === 0) {
      res.status(404).json({ error: '课程不存在' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: '更新课程失败' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await pool.execute('DELETE FROM schedule_courses WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: '删除课程失败' });
  }
});

router.post('/import', async (req: Request, res: Response) => {
  const { courses } = req.body;

  if (!courses || !Array.isArray(courses) || courses.length === 0) {
    res.status(400).json({ error: '缺少课程数据' });
    return;
  }

  const normalizedCourses: NormalizedCoursePayload[] = [];
  for (const [index, course] of courses.entries()) {
    const { data, error } = parseCoursePayload(course);

    if (!data) {
      res.status(400).json({ error: `第 ${index + 1} 条课程数据无效: ${error}` });
      return;
    }

    const conflictingCourse = normalizedCourses.find((existingCourse) => (
      existingCourse.owner === data.owner && existingCourse.dayOfWeek === data.dayOfWeek && coursesConflict(existingCourse, data)
    ));

    if (conflictingCourse) {
      res.status(409).json({ error: `第 ${index + 1} 条课程与其他课程在相同周次的节次冲突` });
      return;
    }

    normalizedCourses.push(data);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM schedule_courses');

    for (const course of normalizedCourses) {
      await connection.execute(
        'INSERT INTO schedule_courses (name, teacher, location, color, day_of_week, time_slot, weeks, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [course.name, course.teacher, course.location, course.color, course.dayOfWeek, JSON.stringify(course.timeSlot), JSON.stringify(course.weeks), course.owner]
      );
    }

    await connection.commit();

    res.json({ success: true, message: `成功导入 ${normalizedCourses.length} 条课程记录` });
  } catch (error) {
    await connection.rollback();
    console.error('Error importing courses:', error);
    res.status(500).json({ error: '导入课程失败' });
  } finally {
    connection.release();
  }
});

export default router;
