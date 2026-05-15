const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/restaurants
router.get('/', (req, res) => {
  const { status, area } = req.query;
  let sql = `
    SELECT r.*, s.salmonella, s.ecoli, s.staph, s.created_at AS last_tested_at
    FROM restaurants r
    LEFT JOIN (
      SELECT restaurant_id, salmonella, ecoli, staph, created_at,
             MAX(id) as max_id
      FROM scans GROUP BY restaurant_id
    ) s ON s.restaurant_id = r.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (area)   { sql += ' AND r.area LIKE ?'; params.push(`%${area}%`); }
  sql += ' ORDER BY r.score DESC, r.name ASC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows, count: rows.length });
});

// GET /api/restaurants/verify/:id  (must be before /:id)
router.get('/verify/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  const latestScan = db.prepare(
    'SELECT salmonella,ecoli,staph,result,score,created_at FROM scans WHERE restaurant_id=? ORDER BY id DESC LIMIT 1'
  ).get(id);
  const maxAge = restaurant.status === 'safe' ? 300 : 60;
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.json({ data: { ...restaurant, latest_scan: latestScan || null } });
});

// GET /api/restaurants/:id
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
  const history = db.prepare(
    'SELECT id,salmonella,ecoli,staph,result,score,created_at FROM scans WHERE restaurant_id=? ORDER BY id DESC LIMIT 10'
  ).all(id);
  res.json({ data: { ...restaurant, scan_history: history } });
});

// POST /api/restaurants  (admin)
router.post('/',
  requireAuth,
  body('name').notEmpty().trim(),
  body('type').notEmpty().trim(),
  body('area').notEmpty().trim(),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, type, area, address, lat, lng } = req.body;
    const r = db.prepare(
      'INSERT INTO restaurants (name,type,area,address,lat,lng) VALUES (?,?,?,?,?,?)'
    ).run(name, type, area, address || null, lat, lng);
    res.status(201).json({ data: db.prepare('SELECT * FROM restaurants WHERE id=?').get(r.lastInsertRowid) });
  }
);

module.exports = router;
