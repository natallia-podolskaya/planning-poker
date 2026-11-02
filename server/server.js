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

// ── Team rooms ───────────────────────────────────────────────────────────────
// Fixed room IDs that are created on demand by whoever joins first and never
// need a "create" step. The Scrum Master is elected by name: the first prefix
// in `smPriority` that matches a present member's name wins. Prefixes are
// matched case-insensitively against the trimmed name. If no prefix matches,
// the current SM keeps the role, or the earliest member takes it.
const TEAM_ROOMS = {
  MOJITO: { smPriority: ['las', 'jul'] },
};

function isTeamRoom(roomId) {
  return Object.prototype.hasOwnProperty.call(TEAM_ROOMS, roomId);
}

function log(event, details) {
  const ts = new Date().toISOString();
  const parts = Object.entries(details).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`[${ts}] ${event} ${parts}`);
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Returns the userId that should hold the SM role given current membership.
function electSM(roomId) {
  const room = rooms[roomId];
  const memberIds = Object.keys(room.members);
  if (isTeamRoom(roomId)) {
    for (const prefix of TEAM_ROOMS[roomId].smPriority) {
      const match = memberIds.find((id) =>
        room.members[id].name.trim().toLowerCase().startsWith(prefix)
      );
      if (match) return match;
    }
  }
  if (room.members[room.smUserId]) return room.smUserId;
  return memberIds[0];
}

// Re-run the election after any membership change; logs if the role moved.
function reassignSM(roomId, removedName) {
  const room = rooms[roomId];
  if (!room) return;
  const previous = room.smUserId;
  room.smUserId = electSM(roomId);
  if (room.smUserId !== previous) {
    log('sm-reassigned', {
      room: roomId,
      from: room.members[previous]?.name ?? removedName ?? previous,
      to: room.members[room.smUserId].name,
    });
  }
}

function buildRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;
  return {
    roomId,
    smUserId: room.smUserId,
    revealed: room.revealed,
    isTeamRoom: isTeamRoom(roomId),
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
  delete room.members[userId];

  if (Object.keys(room.members).length === 0) {
    delete rooms[roomId];
    log('room-closed', { room: roomId, reason: 'empty' });
  } else {
    reassignSM(roomId, name);
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
      if (isTeamRoom(roomId)) {
        // Team room — created on demand by whoever arrives first (also after a restart)
        rooms[roomId] = {
          smUserId: userId,
          members: {},
          revealed: revealed ?? false,
        };
        room = rooms[roomId];
        log('team-room-opened', { room: roomId, by: name });
      } else if (isSM) {
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

    reassignSM(roomId);

    // A freshly joined member who takes the SM role starts with ☕, like on create-room
    if (!isReconnect && room.smUserId === userId && !room.revealed && room.members[userId].vote === null) {
      room.members[userId].vote = '☕';
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
