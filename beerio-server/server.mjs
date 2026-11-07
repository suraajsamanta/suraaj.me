import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomService } from './core.mjs';

/** One process owns all rooms. Do not put round-robin replicas in front of this service. */
export function createRelay({ allowedOrigins = [], maxConnections = 2000, logger = console } = {}) {
  const rooms = new RoomService();
  const upgrades = new Map();
  const server = http.createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: true, service: 'beerio-relay', rooms: rooms.rooms.size }));
    } else { response.writeHead(404); response.end('Not found'); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 40_960, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => {
    const reject = (code) => { socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`); };
    if (request.url !== '/' && request.url !== '/room') { reject('404 Not Found'); return; }
    if (allowedOrigins.length && !allowedOrigins.includes(request.headers.origin)) { reject('403 Forbidden'); return; }
    if (wss.clients.size >= maxConnections) { reject('503 Service Unavailable'); return; }
    // Trust the TCP peer rather than spoofable forwarded headers. Tune at the reverse proxy too.
    const ip = socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    let bucket = upgrades.get(ip);
    if (!bucket || now - bucket.since > 60_000) {
      bucket = { since: now, count: 0 };
      upgrades.set(ip, bucket);
    }
    if (++bucket.count > 120) { reject('429 Too Many Requests'); return; }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws));
  });
  wss.on('connection', (ws) => {
    ws.isAlive = true;
    const peer = {
      send(message) {
        if (ws.readyState !== WebSocket.OPEN) return;
        // A stalled mobile link should not accumulate an unbounded state queue.
        if (ws.bufferedAmount > 256 * 1024) { ws.terminate(); return; }
        ws.send(JSON.stringify(message));
      },
      close() { ws.close(1000); },
    };
    rooms.connect(peer);
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data, binary) => {
      if (binary) { ws.close(1003, 'Text messages only'); return; }
      try { rooms.receive(peer, JSON.parse(data.toString())); }
      catch { ws.close(1007, 'Invalid message'); }
    });
    ws.on('close', () => rooms.disconnect(peer));
    ws.on('error', () => rooms.disconnect(peer));
  });
  const sweep = setInterval(() => rooms.sweep(), 100);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
    for (const [ip, bucket] of upgrades) if (Date.now() - bucket.since > 60_000) upgrades.delete(ip);
  }, 15_000);
  sweep.unref();
  heartbeat.unref();
  const close = () => new Promise((resolve) => {
    clearInterval(sweep);
    clearInterval(heartbeat);
    // A transport restart is not a host Leave. Never erase clients' recovery
    // credentials with room_closed; their host retains the authoritative race.
    for (const room of rooms.rooms.values()) rooms.broadcast(room, { type: 'relay_restarting' });
    for (const ws of wss.clients) ws.terminate();
    wss.close(() => server.close(resolve));
  });
  server.on('error', (error) => logger.error('Beerio relay server error:', error.message));
  return { server, rooms, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origins = (process.env.BEERIO_ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && origins.length === 0) {
    console.error('Set BEERIO_ALLOWED_ORIGINS to the exact HTTPS origins of your Beerio site before starting in production.');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8787);
  const relay = createRelay({ allowedOrigins: origins });
  relay.server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`Beerio relay listening on port ${port}`));
  let shuttingDown = false;
  const stop = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await relay.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
