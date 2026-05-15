const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/restaurants
router.get('/', (req, res) => {
  const { status, area } = req.query;
  let sql = `
    SELECT r.*,
      s.ecoli, s.staph, s.bcereus,
      s.created_at AS last_tested_at
    FROM restaurants r
    LEFT JOIN (
      SELECT restaurant_id, ecoli, staph, bcereus, created_at
      FROM scans WHERE id IN (SELECT MAX(id) FROM scans GROUP BY restaurant_id)
    ) s ON s.restaurant_id = r.id
    WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND r.status=?'; params.push(status); }
  if (area)   { sql += ' AND r.area LIKE ?'; params.push(`%${area}%`); }
  sql += ' ORDER BY r.score DESC, r.name ASC';
  const rows = db.prepare(sql).all(...params);
  res.json({ data: rows, count: rows.length });
});

// GET /api/restaurants/verify/:id  (QR code public endpoint)
router.get('/verify/:id', param('id').isInt({ min: 1 }), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const r = db.prepare('SELECT * FROM restaurants WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Restaurant not found' });

  const scan = db.prepare(`
    SELECT ecoli, staph, bcereus, result, score, created_at
    FROM scans WHERE restaurant_id=? ORDER BY id DESC LIMIT 1
  `).get(req.params.id);

  const maxAge = r.status === 'safe' ? 300 : 60;
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  res.json({ data: { ...r, latest_scan: scan || null } });
});

// GET /api/restaurants/:id  (detail + history)
router.get('/:id', param('id').isInt({ min: 1 }), (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const r = db.prepare('SELECT * FROM restaurants WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Restaurant not found' });

  const history = db.prepare(`
    SELECT id, ecoli, staph, bcereus, result, score, raw_na, cfu_data, created_at
    FROM scans WHERE restaurant_id=? ORDER BY id DESC LIMIT 10
  `).all(req.params.id);

  res.json({ data: { ...r, scan_history: history } });
});

// POST /api/restaurants  (admin)
router.post('/',
  requireAuth,
  body('name').notEmpty().trim(),
  body('type').notEmpty().trim(),
  body('area').notEmpty().trim(),
  body('lat').isFloat({ min: -90,  max: 90  }),
  body('lng').isFloat({ min: -180, max: 180 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, type, area, address, lat, lng } = req.body;
    const result = db.prepare(
      'INSERT INTO restaurants (name,type,area,address,lat,lng) VALUES (?,?,?,?,?,?)'
    ).run(name, type, area, address || null, lat, lng);
    const row = db.prepare('SELECT * FROM restaurants WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json({ data: row, message: 'Restaurant created' });
  }
);

module.exports = router;
