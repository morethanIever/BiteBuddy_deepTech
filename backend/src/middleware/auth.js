const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization header' });
  try {
    req.admin = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireDeviceKey(req, res, next) {
  const { db } = require('../db');
  const key = req.headers['x-device-key'];
  if (!key) return res.status(401).json({ error: 'Missing X-Device-Key header' });
  const device = db.prepare('SELECT * FROM device_keys WHERE key_value=? AND active=1').get(key);
  if (!device) return res.status(401).json({ error: 'Invalid or inactive device key' });
  req.device = device;
  next();
}

module.exports = { requireAuth, requireDeviceKey };
