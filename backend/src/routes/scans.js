const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../db');
const { requireAuth, requireDeviceKey } = require('../middleware/auth');
const { computeScore, simulateFullPipeline } = require('../lib/scoring');
const { broadcast } = require('../lib/websocket');

const router = express.Router();
const BACTERIA_VALUES = ['ND', 'Trace', 'Detected'];

/**
 * Core scan creation — used by both real device POST and demo simulator.
 * Accepts readings {ecoli, staph, bcereus}, optional raw sensor metadata.
 */
function createScan(restaurantId, readings, deviceKey, notes, sensorMeta) {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id=?').get(restaurantId);
  if (!restaurant) return { error: 'Restaurant not found', status: 404 };

  const { score, result } = computeScore(readings);
  const now = new Date().toISOString();

  const scan = db.prepare(`
    INSERT INTO scans
      (restaurant_id, device_key, ecoli, staph, bcereus, result, score, notes, raw_na, cfu_data, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    restaurantId,
    deviceKey || 'manual',
    readings.ecoli   || 'ND',
    readings.staph   || 'ND',
    readings.bcereus || 'ND',
    result, score,
    notes || null,
    sensorMeta?.raw_nA  ? JSON.stringify(sensorMeta.raw_nA)  : null,
    sensorMeta?.cfu_per_ml ? JSON.stringify(sensorMeta.cfu_per_ml) : null,
    now
  );

  db.prepare("UPDATE restaurants SET status=?, score=?, verified_at=? WHERE id=?")
    .run(result, score, now, restaurantId);

  const scanData = {
    id: scan.lastInsertRowid,
    restaurant_id:   restaurantId,
    restaurant_name: restaurant.name,
    restaurant_area: restaurant.area,
    ...readings,
    result, score,
    sensor: sensorMeta || null,
    created_at: now,
  };

  broadcast('scan_result', scanData);
  return { data: scanData };
}

// ── Real device ingestion ──────────────────────────────────────────────────────
// POST /api/scans   Headers: X-Device-Key: BB-DEV-001-ALPHA
router.post('/',
  requireDeviceKey,
  body('restaurant_id').isInt({ min: 1 }),
  body('ecoli').isIn(BACTERIA_VALUES),
  body('staph').isIn(BACTERIA_VALUES),
  body('bcereus').isIn(BACTERIA_VALUES),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { restaurant_id, ecoli, staph, bcereus, notes, raw_nA, cfu_per_ml } = req.body;
    const r = createScan(
      restaurant_id,
      { ecoli, staph, bcereus },
      req.device.key_value,
      notes,
      raw_nA ? { raw_nA, cfu_per_ml } : null
    );
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.status(201).json({ ...r, message: 'Scan recorded' });
  }
);

// ── Full demo simulation (mimics real firmware pipeline) ──────────────────────
// POST /api/scans/simulate   Auth: JWT
// Body: { restaurant_id, preset: 'safe'|'warning'|'danger', step_by_step: true }
router.post('/simulate',
  requireAuth,
  body('restaurant_id').isInt({ min: 1 }),
  body('preset').isIn(['safe', 'warning', 'danger']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { restaurant_id, preset, notes } = req.body;

    // Run the full biosensor pipeline simulation
    const pipeline = simulateFullPipeline(preset);
    const { ecoli, staph, bcereus, raw_nA, cfu_per_ml, score, result, ...meta } = pipeline;

    const r = createScan(
      restaurant_id,
      { ecoli, staph, bcereus },
      'demo-simulator',
      notes || `Demo scan — preset: ${preset}`,
      { raw_nA, cfu_per_ml, ...meta }
    );

    if (r.error) return res.status(r.status).json({ error: r.error });
    res.status(201).json({
      ...r,
      simulated: true,
      preset,
      pipeline: { raw_nA, cfu_per_ml, detection_time_s: meta.detection_time_s, sample_volume_ul: meta.sample_volume_ul, electrode_temp_c: meta.electrode_temp_c }
    });
  }
);

// ── Demo: stream scan progress via SSE (for the live device UI) ───────────────
// GET /api/scans/stream/:restaurant_id?preset=safe&token=<jwt>
// EventSource can't send custom headers, so the JWT is accepted from a query param.
router.get('/stream/:restaurant_id', (req, res) => {
  const rawToken = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  if (!rawToken) return res.status(401).json({ error: 'Unauthorized' });
  try { jwt.verify(rawToken, process.env.JWT_SECRET); } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const restaurantId = parseInt(req.params.restaurant_id);
  const preset = ['safe','warning','danger'].includes(req.query.preset) ? req.query.preset : 'safe';

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let ended = false;
  const endOnce = () => { if (!ended) { ended = true; res.end(); } };
  const send = (event, data) => { if (!ended) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  const pipeline = simulateFullPipeline(preset);
  const STEPS = [
    { t:  500, event: 'phase', data: { phase: 'sample_loading',    pct:  5, msg: 'Sample loaded (9 µL)' } },
    { t: 1500, event: 'phase', data: { phase: 'electrode_prep',    pct: 12, msg: 'Conditioning electrodes…' } },
    { t: 3000, event: 'phase', data: { phase: 'aptamer_binding',   pct: 30, msg: 'Aptamer–pathogen binding in progress…' } },
    { t: 5000, event: 'phase', data: { phase: 'signal_acquisition',pct: 55, msg: 'Acquiring DPV signal…' } },
    { t: 6500, event: 'raw',   data: { raw_nA: pipeline.raw_nA, msg: 'Raw electrode current captured' } },
    { t: 8000, event: 'phase', data: { phase: 'cfu_calculation',   pct: 72, msg: 'Converting signal → CFU/mL…' } },
    { t: 9500, event: 'cfu',   data: { cfu_per_ml: pipeline.cfu_per_ml, msg: 'Concentration calculated' } },
    { t:11000, event: 'phase', data: { phase: 'classification',    pct: 88, msg: 'Applying detection thresholds…' } },
    { t:12500, event: 'levels',data: { ecoli: pipeline.ecoli, staph: pipeline.staph, bcereus: pipeline.bcereus, msg: 'Detection levels determined' } },
    { t:14000, event: 'phase', data: { phase: 'scoring',           pct: 96, msg: 'Computing safety score…' } },
  ];

  const timers = [];

  STEPS.forEach(step => {
    timers.push(setTimeout(() => send(step.event, step.data), step.t));
  });

  timers.push(setTimeout(() => {
    try {
      const r = createScan(
        restaurantId,
        { ecoli: pipeline.ecoli, staph: pipeline.staph, bcereus: pipeline.bcereus },
        'demo-device',
        `Streamed demo scan — ${preset}`,
        { raw_nA: pipeline.raw_nA, cfu_per_ml: pipeline.cfu_per_ml }
      );

      if (!r.error) {
        send('result', {
          pct: 100,
          phase: 'complete',
          result:  pipeline.result,
          score:   pipeline.score,
          ecoli:   pipeline.ecoli,
          staph:   pipeline.staph,
          bcereus: pipeline.bcereus,
          raw_nA:  pipeline.raw_nA,
          cfu_per_ml: pipeline.cfu_per_ml,
          scan_id: r.data.id,
          restaurant_name: r.data.restaurant_name,
          msg: 'Analysis complete',
        });
      }
    } catch (err) {
      console.error('[SSE createScan error]', err.message);
    }
    endOnce();
  }, 15500));

  req.on('close', () => { timers.forEach(clearTimeout); endOnce(); });
});

// ── Recent scans feed (admin) ─────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const scans = db.prepare(`
    SELECT s.*, r.name AS restaurant_name, r.area AS restaurant_area
    FROM scans s
    JOIN restaurants r ON r.id = s.restaurant_id
    ORDER BY s.id DESC LIMIT ?
  `).all(limit);
  res.json({ data: scans, count: scans.length });
});

module.exports = router;
