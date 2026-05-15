const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../db');
const { requireAuth, requireDeviceKey } = require('../middleware/auth');
const { computeScore, generateSimulatedReadings } = require('../lib/scoring');
const { broadcast } = require('../lib/websocket');

const router = express.Router();
const BACTERIA_VALUES = ['ND', 'Trace', 'Detected'];

function createScan(restaurantId, readings, deviceKey, notes) {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id=?').get(restaurantId);
  if (!restaurant) return { error: 'Restaurant not found', status: 404 };

  const { score, result } = computeScore(readings);
  const now = new Date().toISOString();

  const scan = db.prepare(
    'INSERT INTO scans (restaurant_id,device_key,salmonella,ecoli,staph,result,score,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(restaurantId, deviceKey || 'manual', readings.salmonella, readings.ecoli, readings.staph, result, score, notes || null, now);

  db.prepare("UPDATE restaurants SET status=?, score=?, verified_at=? WHERE id=?")
    .run(result, score, now, restaurantId);

  const scanData = {
    id: scan.lastInsertRowid,
    restaurant_id: restaurantId,
    restaurant_name: restaurant.name,
    restaurant_area: restaurant.area,
    ...readings, result, score,
    created_at: now,
  };

  broadcast('scan_result', scanData);
  return { data: scanData };
}

// POST /api/scans  (device)
router.post('/',
  requireDeviceKey,
  body('restaurant_id').isInt({ min: 1 }),
  body('salmonella').isIn(BACTERIA_VALUES),
  body('ecoli').isIn(BACTERIA_VALUES),
  body('staph').isIn(BACTERIA_VALUES),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { restaurant_id, salmonella, ecoli, staph, notes } = req.body;
    const r = createScan(restaurant_id, { salmonella, ecoli, staph }, req.device.key_value, notes);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.status(201).json({ ...r, message: 'Scan recorded' });
  }
);

// POST /api/scans/simulate  (admin demo)
router.post('/simulate',
  requireAuth,
  body('restaurant_id').isInt({ min: 1 }),
  body('preset').isIn(['safe', 'warning', 'danger']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { restaurant_id, preset, notes } = req.body;
    const readings = generateSimulatedReadings(preset);
    const r = createScan(restaurant_id, readings, 'simulator', notes || `Simulated: ${preset}`);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.status(201).json({ ...r, simulated: true, preset, readings });
  }
);

// GET /api/scans  (admin)
router.get('/', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const scans = db.prepare(
    'SELECT s.*,r.name AS restaurant_name,r.area AS restaurant_area FROM scans s JOIN restaurants r ON r.id=s.restaurant_id ORDER BY s.id DESC LIMIT ?'
  ).all(limit);
  res.json({ data: scans, count: scans.length });
});

module.exports = router;
