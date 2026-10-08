import { parentPort, workerData } from 'node:worker_threads';
import { Room, TICK } from './room.js';

const room = new Room(workerData.name);

parentPort.on('message', ({ cid, m }) => {
  try {
    room.handle(cid, m);
  } catch (err) {
    console.error(`[${room.name}] bad message from ${cid}:`, err);
  }
});

setInterval(() => parentPort.postMessage({ out: room.tick() }), TICK * 1000);
setInterval(() => parentPort.postMessage({ info: room.info() }), 1000);
