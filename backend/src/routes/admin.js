const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getClientCount } = require('../lib/websocket');

const router = express.Router();

router.get('/stats', requireAuth, (req, res) => {
  try {
    const totals = db.prepare(`
      SELECT COUNT(*) AS total_restaurants,
        SUM(CASE WHEN status='safe'    THEN 1 ELSE 0 END) AS safe_count,
        SUM(CASE WHEN status='warning' THEN 1 ELSE 0 END) AS warning_count,
        SUM(CASE WHEN status='danger'  THEN 1 ELSE 0 END) AS danger_count,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count
      FROM restaurants
    `).get();

    const scansToday = db.prepare(
      "SELECT COUNT(*) AS count FROM scans WHERE date(created_at)=date('now')"
    ).get();

    const recentScans = db.prepare(`
      SELECT s.id, s.result, s.score, s.ecoli, s.staph, s.bcereus,
             s.raw_na, s.cfu_data, s.created_at,
             r.name AS restaurant_name, r.area AS restaurant_area
      FROM scans s JOIN restaurants r ON r.id=s.restaurant_id
      ORDER BY s.id DESC LIMIT 10
    `).all();

    const topAreas = db.prepare(`
      SELECT area, COUNT(*) AS total,
        SUM(CASE WHEN status='safe' THEN 1 ELSE 0 END) AS safe_count
      FROM restaurants WHERE status != 'pending'
      GROUP BY area ORDER BY safe_count DESC LIMIT 6
    `).all();

    const pendingApps = db.prepare(
      "SELECT COUNT(*) AS count FROM applications WHERE status='pending'"
    ).get();

    res.json({ data: {
      ...totals,
      scans_today:          scansToday?.count ?? 0,
      pending_applications: pendingApps?.count ?? 0,
      live_connections:     getClientCount(),
      top_areas:            topAreas,
      recent_scans:         recentScans,
    }});
  } catch (err) {
    console.error('[admin/stats error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications', requireAuth, (req, res) => {
  res.json({ data: db.prepare('SELECT * FROM applications ORDER BY id DESC').all() });
});

router.patch('/applications/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['pending','approved','rejected'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE applications SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ message: 'Updated' });
});

router.get('/devices', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT dk.*, r.name AS restaurant_name
    FROM device_keys dk LEFT JOIN restaurants r ON r.id=dk.restaurant_id
    ORDER BY dk.id DESC
  `).all();
  res.json({ data: rows });
});

module.exports = router;
