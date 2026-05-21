import { Router } from 'express';
import { query, queryOne } from '../db.js';

const router = Router();

// GET /api/courses
router.get('/', async (req, res) => {
  const courses = await query('SELECT * FROM courses ORDER BY name');
  res.json(courses);
});

// GET /api/courses/:id — course with tees and holes
router.get('/:id', async (req, res) => {
  const course = await queryOne('SELECT * FROM courses WHERE id = $1', [req.params.id]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const tees = await query(
    'SELECT * FROM course_tees WHERE course_id = $1 ORDER BY total_yardage DESC',
    [course.id]
  );
  for (const tee of tees) {
    tee.holes = await query(
      'SELECT * FROM course_holes WHERE tee_id = $1 ORDER BY number',
      [tee.id]
    );
  }

  res.json({ ...course, tees });
});

export default router;
