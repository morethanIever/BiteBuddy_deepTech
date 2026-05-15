require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const rateLimit = require('express-rate-limit');
const { db, initPromise, initSchema } = require('./db');
const { initWebSocket } = require('./lib/websocket');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const globalLimiter = rateLimit({ windowMs: 60000, max: 200, message: { error: 'Too many requests.' } });
app.use(globalLimiter);

const scanLimiter = rateLimit({ windowMs: 60000, max: 60, message: { error: 'Scan rate limit exceeded.' } });

// Start only after DB is ready
initPromise.then(() => {
  initSchema();
  initWebSocket(server);

  const { count } = db.prepare('SELECT COUNT(*) as count FROM restaurants').get();
  if (count === 0) {
    console.log('📦 Empty database — auto-seeding...');
    await require('../scripts/seed.js');
  }

  const authRoutes        = require('./routes/auth');
  const restaurantRoutes  = require('./routes/restaurants');
  const scanRoutes        = require('./routes/scans');
  const adminRoutes       = require('./routes/admin');
  const applicationRoutes = require('./routes/applications');

  app.use('/auth',             authRoutes);
  app.use('/api/restaurants',  restaurantRoutes);
  app.use('/api/scans',        scanLimiter, scanRoutes);
  app.use('/api/admin',        adminRoutes);
  app.use('/api/applications', applicationRoutes);

  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`\n🦠 BiteBuddy API: http://localhost:${PORT}`);
    console.log(`📡 WebSocket:     ws://localhost:${PORT}/ws`);
    console.log(`🌍 Env: ${process.env.NODE_ENV}\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });

module.exports = { app, server };
