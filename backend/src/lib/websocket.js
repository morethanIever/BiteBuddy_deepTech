const { WebSocketServer } = require('ws');

let wss = null;
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    console.log(`[WS] Client connected. Total: ${clients.size}`);

    // Send a welcome ping
    ws.send(JSON.stringify({ type: 'connected', message: 'BiteBuddy live feed connected' }));

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WS] Error:', err.message);
      clients.delete(ws);
    });
  });

  console.log('[WS] WebSocket server initialized on /ws');
}

/**
 * Broadcast a message to all connected WebSocket clients.
 * @param {string} type - event type
 * @param {object} payload - data to send
 */
function broadcast(type, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  let sent = 0;
  clients.forEach((ws) => {
    if (ws.readyState === 1) { // OPEN
      ws.send(message);
      sent++;
    } else {
      clients.delete(ws);
    }
  });
  console.log(`[WS] Broadcast '${type}' to ${sent} clients`);
}

function getClientCount() {
  return clients.size;
}

module.exports = { initWebSocket, broadcast, getClientCount };
