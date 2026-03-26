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
//   smUserId: string,
//   members: { [userId]: { name, vote: string|null, socketId: string } },
//   revealed: boolean
// }
const rooms = {};

// socketId -> { userId, roomId }  (for fast lookup on disconnect)
const socketToUser = {};

// `${userId}:${roomId}` -> timeout handle  (grace period before removal)
const disconnectTimers = {};

const GRACE_MS = 15_000;

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
    smUserId: room.smUserId,
    revealed: room.revealed,
    members: Object.entries(room.members).map(([userId, m]) => ({
      userId,
      name: m.name,
      voted: m.vote !== null,
      vote: room.revealed ? m.vote : null,
    })),
  };
}

function broadcastRoom(roomId) {
  io.to(roomId).emit('room-updated', buildRoomState(roomId));
}

function removeMember(roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;
  const name = room.members[userId]?.name ?? userId;
  const wasSM = room.smUserId === userId;
  delete room.members[userId];

  if (Object.keys(room.members).length === 0) {
    delete rooms[roomId];
    log('room-closed', { room: roomId, reason: 'empty' });
  } else {
    if (wasSM) {
      room.smUserId = Object.keys(room.members)[0];
      const newSM = room.members[room.smUserId].name;
      log('sm-reassigned', { room: roomId, from: name, to: newSM });
    }
    broadcastRoom(roomId);
    log('user-left', { room: roomId, user: name, members: Object.keys(room.members).length });
  }
}

// ── Socket events ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create-room', ({ name, userId }) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      smUserId: userId,
      members: { [userId]: { name, vote: '☕', socketId: socket.id } },
      revealed: false,
    };
    socketToUser[socket.id] = { userId, roomId };
    socket.join(roomId);
    socket.emit('room-created', buildRoomState(roomId));
    log('room-created', { room: roomId, user: name });
  });

  socket.on('join-room', ({ roomId, name, userId, isSM, vote, revealed }) => {
    let room = rooms[roomId];

    if (!room) {
      if (isSM) {
        // SM reconnecting after server restart — recreate the room with the same ID
        rooms[roomId] = {
          smUserId: userId,
          members: { [userId]: { name, vote: null, socketId: socket.id } },
          revealed: revealed ?? false,
        };
        room = rooms[roomId];
        log('room-recreated', { room: roomId, by: name });
      } else {
        // Regular member — room may not exist yet (SM hasn't reconnected); ask client to retry
        log('join-failed', { room: roomId, user: name, reason: 'not-found' });
        socket.emit('error', { message: `Room "${roomId}" not found.`, retryable: true });
        return;
      }
    }

    const timerKey = `${userId}:${roomId}`;
    const isReconnect = !!room.members[userId];

    // Cancel pending removal if this user is reconnecting
    if (disconnectTimers[timerKey]) {
      clearTimeout(disconnectTimers[timerKey]);
      delete disconnectTimers[timerKey];
    }

    if (isReconnect) {
      // Update socket reference, preserve vote
      const oldSocketId = room.members[userId].socketId;
      delete socketToUser[oldSocketId];
      room.members[userId].socketId = socket.id;
      log('user-reconnected', { room: roomId, user: room.members[userId].name });
    } else {
      room.members[userId] = { name, vote: null, socketId: socket.id };
      log('user-joined', { room: roomId, user: name, members: Object.keys(room.members).length });
    }

    // Restore vote for in-progress rounds (not revealed)
    if (vote && !room.revealed && room.members[userId]) {
      room.members[userId].vote = vote;
    }

    socketToUser[socket.id] = { userId, roomId };
    socket.join(roomId);
    socket.emit('room-joined', buildRoomState(roomId));
    broadcastRoom(roomId);
  });

  socket.on('vote', ({ roomId, value }) => {
    const room = rooms[roomId];
    const userId = socketToUser[socket.id]?.userId;
    if (!room || !userId || !room.members[userId] || room.revealed) return;
    room.members[userId].vote = value;
    broadcastRoom(roomId);
    log('user-voted', { room: roomId, user: room.members[userId].name, value });
  });

  socket.on('flip-cards', ({ roomId }) => {
    const room = rooms[roomId];
    const userId = socketToUser[socket.id]?.userId;
    if (!room || room.smUserId !== userId) return;
    room.revealed = true;
    broadcastRoom(roomId);
    log('cards-flipped', { room: roomId, by: room.members[userId]?.name ?? socket.id });
  });

  socket.on('reset-room', ({ roomId }) => {
    const room = rooms[roomId];
    const userId = socketToUser[socket.id]?.userId;
    if (!room || room.smUserId !== userId) return;
    room.revealed = false;
    Object.values(room.members).forEach((m) => (m.vote = null));
    if (room.members[room.smUserId]) room.members[room.smUserId].vote = '☕';
    broadcastRoom(roomId);
    log('round-reset', { room: roomId, by: room.members[userId]?.name ?? socket.id });
  });

  socket.on('disconnecting', () => {
    const userInfo = socketToUser[socket.id];
    if (!userInfo) return;
    const { userId, roomId } = userInfo;
    delete socketToUser[socket.id];

    const room = rooms[roomId];
    if (!room || !room.members[userId]) return;

    const name = room.members[userId].name;
    const timerKey = `${userId}:${roomId}`;

    log('user-disconnected', { room: roomId, user: name, grace: `${GRACE_MS}ms` });

    disconnectTimers[timerKey] = setTimeout(() => {
      delete disconnectTimers[timerKey];
      removeMember(roomId, userId);
    }, GRACE_MS);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Planning Poker server running on port ${PORT}`));
