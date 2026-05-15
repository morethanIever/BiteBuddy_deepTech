const express = require('express');
const nodemailer = require('nodemailer');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getClientCount } = require('../lib/websocket');

function getMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmail(to, subject, html) {
  const transporter = getMailer();
  if (!transporter) {
    console.log(`[EMAIL - no SMTP configured]\nTo: ${to}\nSubject: ${subject}\n${html.replace(/<[^>]+>/g, '')}`);
    return { simulated: true };
  }
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
  return { sent: true };
}

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
  if (!['pending','contacted','negotiating','approved','rejected'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE applications SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ message: 'Updated' });
});

router.patch('/applications/:id/progress', requireAuth, (req, res) => {
  const progress = parseInt(req.body.progress);
  if (isNaN(progress) || progress < 0 || progress > 100)
    return res.status(400).json({ error: 'progress must be 0–100' });
  const adminNotes = req.body.admin_notes !== undefined ? req.body.admin_notes : undefined;
  if (adminNotes !== undefined) {
    db.prepare('UPDATE applications SET progress=?, admin_notes=? WHERE id=?').run(progress, adminNotes, req.params.id);
  } else {
    db.prepare('UPDATE applications SET progress=? WHERE id=?').run(progress, req.params.id);
  }
  res.json({ message: 'Updated' });
});

router.post('/applications/:id/contact', requireAuth, async (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id=?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!app.contact_email) return res.status(400).json({ error: 'No email on file for this application' });

  const subject = req.body.subject || `BiteBuddy — Interest in certifying ${app.restaurant_name}`;
  const message = req.body.message || `Hi,\n\nWe'd love to help ${app.restaurant_name} get BiteBuddy certified!\n\nBest regards,\nBiteBuddy Team`;
  const html = message.replace(/\n/g, '<br>');

  try {
    const result = await sendEmail(app.contact_email, subject, html);
    const now = new Date().toISOString();
    db.prepare("UPDATE applications SET status='contacted', contacted_at=?, progress=CASE WHEN progress<10 THEN 10 ELSE progress END WHERE id=?").run(now, req.params.id);
    res.json({ message: 'Email sent', ...result, contacted_at: now });
  } catch (err) {
    console.error('[contact email error]', err.message);
    res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
});

router.post('/applications/:id/approve', requireAuth, (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id=?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const { lat, lng, address } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required to add restaurant' });

  try {
    const r = db.prepare(
      'INSERT INTO restaurants (name, type, area, address, lat, lng, status) VALUES (?,?,?,?,?,?,?)'
    ).run(
      app.restaurant_name,
      app.cuisine_type || 'Restaurant',
      app.area,
      address || app.area,
      parseFloat(lat),
      parseFloat(lng),
      'pending'
    );

    db.prepare("UPDATE applications SET status='approved', progress=100 WHERE id=?").run(app.id);

    res.status(201).json({
      message: 'Restaurant added successfully',
      restaurant_id: r.lastInsertRowid,
      restaurant_name: app.restaurant_name,
    });
  } catch (err) {
    console.error('[approve error]', err.message);
    res.status(500).json({ error: err.message });
  }
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
