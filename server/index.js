import http from 'node:http';
import { Worker } from 'node:worker_threads';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 3000);
const ROOM_NAMES = (process.env.ROOMS ?? 'Alpha,Bravo,Charlie,Delta').split(',').map((s) => s.trim()).filter(Boolean);
const MSGS_PER_SEC = 80;

const sockets = new Map();
let nextCid = 1;

// Each room is a worker thread, so rooms run in parallel and a crash only takes down that room.
function startRoom(id, name) {
  const room = { id, name, info: { name, players: 0, max: 12, score: [0, 0], time: 600 }, worker: null };
  const spawn = () => {
    room.worker = new Worker(new URL('./room-worker.js', import.meta.url), { workerData: { name } });
    room.worker.on('message', (msg) => {
      if (msg.info) room.info = msg.info;
      for (const [cid, data] of msg.out ?? []) {
        const ws = sockets.get(cid);
        if (ws?.readyState === ws.OPEN) ws.send(data);
      }
    });
    room.worker.on('error', (err) => console.error(`room ${name} crashed:`, err));
    room.worker.on('exit', () => {
      for (const ws of sockets.values()) if (ws.room === room) ws.close(1011, 'room restarted');
      setTimeout(spawn, 1000);
    });
  };
  spawn();
  return room;
}

const rooms = ROOM_NAMES.map((name, i) => startRoom(i, name));

const cleanName = (n) => String(n ?? '').replace(/[^\w\- ]/g, '').trim().slice(0, 16) || `Player${Math.floor(Math.random() * 1000)}`;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/rooms') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(rooms.map((r) => ({ id: r.id, ...r.info }))));
  } else if (req.url === '/healthz') {
    res.end('ok');
  } else {
    res.writeHead(404).end();
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

wss.on('connection', (ws) => {
  const cid = nextCid++;
  sockets.set(cid, ws);
  ws.room = null;
  ws.isAlive = true;
  let budget = MSGS_PER_SEC, last = Date.now();

  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (data) => {
    const now = Date.now();
    budget = Math.min(MSGS_PER_SEC, budget + (now - last) / 1000 * MSGS_PER_SEC);
    last = now;
    if (budget < 1) return;
    budget -= 1;

    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;

    if (m.t === 'join') {
      const room = rooms[m.room];
      if (ws.room || !room) return;
      ws.room = room;
      room.worker.postMessage({ cid, m: { t: 'join', name: cleanName(m.name) } });
    } else if (ws.room && m.t !== 'leave') {
      ws.room.worker.postMessage({ cid, m });
    }
  });
  ws.on('close', () => {
    sockets.delete(cid);
    ws.room?.worker.postMessage({ cid, m: { t: 'leave' } });
  });
});

// Drop connections that stopped answering pings so their soldiers don't linger.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`game server on :${PORT} with rooms: ${ROOM_NAMES.join(', ')}`));
