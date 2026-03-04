const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// Serve built Angular app in production
app.use(express.static(path.join(__dirname, '../dist/planning-poker/browser')));

// ── In-memory state ──────────────────────────────────────────────────────────
// rooms[roomId] = {
//   smSocketId: string,
//   members: { [socketId]: { name, vote: string|null } },
//   revealed: boolean
// }
const rooms = {};

function log(event, details) {
  const ts = new Date().toISOString();
  const parts = Object.entries(details).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`[${ts}] ${event} ${parts}`);
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function buildRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;
  return {
    roomId,
    smSocketId: room.smSocketId,
    revealed: room.revealed,
    members: Object.entries(room.members).map(([socketId, m]) => ({
      socketId,
      name: m.name,
      voted: m.vote !== null,
      vote: room.revealed ? m.vote : null,
    })),
  };
}

function broadcastRoom(roomId) {
  io.to(roomId).emit('room-updated', buildRoomState(roomId));
}

// ── Socket events ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create-room', ({ name }) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      smSocketId: socket.id,
      members: { [socket.id]: { name, vote: null } },
      revealed: false,
    };
    socket.join(roomId);
    socket.emit('room-created', buildRoomState(roomId));
    log('room-created', { room: roomId, user: name });
  });

  socket.on('join-room', ({ roomId, name }) => {
    const room = rooms[roomId];
    if (!room) {
      log('join-failed', { room: roomId, user: name, reason: 'not-found' });
      socket.emit('error', { message: `Room "${roomId}" not found.` });
      return;
    }
    room.members[socket.id] = { name, vote: null };
    socket.join(roomId);
    socket.emit('room-joined', buildRoomState(roomId));
    broadcastRoom(roomId);
    log('user-joined', { room: roomId, user: name, members: Object.keys(room.members).length });
  });

  socket.on('vote', ({ roomId, value }) => {
    const room = rooms[roomId];
    if (!room || !room.members[socket.id] || room.revealed) return;
    room.members[socket.id].vote = value;
    broadcastRoom(roomId);
    log('user-voted', { room: roomId, user: room.members[socket.id].name, value });
  });

  socket.on('flip-cards', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.smSocketId !== socket.id) return;
    room.revealed = true;
    broadcastRoom(roomId);
    const sm = room.members[socket.id]?.name ?? socket.id;
    log('cards-flipped', { room: roomId, by: sm });
  });

  socket.on('reset-room', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.smSocketId !== socket.id) return;
    room.revealed = false;
    Object.values(room.members).forEach((m) => (m.vote = null));
    broadcastRoom(roomId);
    const sm = room.members[socket.id]?.name ?? socket.id;
    log('round-reset', { room: roomId, by: sm });
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      const room = rooms[roomId];
      if (!room) continue;

      const name = room.members[socket.id]?.name ?? socket.id;
      const wasSM = room.smSocketId === socket.id;
      delete room.members[socket.id];

      if (Object.keys(room.members).length === 0) {
        delete rooms[roomId];
        log('room-closed', { room: roomId, reason: 'empty' });
      } else {
        if (wasSM) {
          room.smSocketId = Object.keys(room.members)[0];
          const newSM = room.members[room.smSocketId].name;
          log('sm-reassigned', { room: roomId, from: name, to: newSM });
        }
        broadcastRoom(roomId);
        log('user-left', { room: roomId, user: name, members: Object.keys(room.members).length });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Planning Poker server running on port ${PORT}`));
