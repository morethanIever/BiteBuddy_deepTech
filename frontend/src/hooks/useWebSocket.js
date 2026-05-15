import { useEffect, useRef, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL ||
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
  window.location.host + '/ws';

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        console.log('[WS] Connected to BiteBuddy live feed');
        onMessageRef.current?.({ type: 'connection_status', payload: { connected: true } });
      };

      ws.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          onMessageRef.current?.(msg);
        } catch {}
      };

      ws.current.onclose = () => {
        console.log('[WS] Disconnected. Reconnecting in 5s...');
        onMessageRef.current?.({ type: 'connection_status', payload: { connected: false } });
        reconnectTimer.current = setTimeout(connect, 5000);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch (err) {
      console.warn('[WS] Could not connect:', err.message);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return ws;
}
