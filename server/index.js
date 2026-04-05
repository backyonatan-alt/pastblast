const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const C = require('./constants');
const game = require('./gameState');

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = process.env.PUBLIC_URL
  ? [process.env.PUBLIC_URL, 'http://localhost:3000']
  : true; // Allow all origins when PUBLIC_URL not set (Railway auto-deploys)

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  pingInterval: 5000,
  pingTimeout: 10000,
  maxHttpBufferSize: 10240, // 10KB max per message
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com; connect-src 'self' wss: ws: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://en.wikipedia.org; font-src 'self' fonts.gstatic.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com https://unpkg.com; img-src 'self' api.qrserver.com data: https://*.google-analytics.com https://*.googletagmanager.com https://*.tile.openstreetmap.org https://tiles.stadiamaps.com https://server.arcgisonline.com https://upload.wikimedia.org");
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple rate limiter for HTTP endpoints
const httpRateLimit = {};
app.use('/check-room', (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!httpRateLimit[ip]) httpRateLimit[ip] = [];
  httpRateLimit[ip] = httpRateLimit[ip].filter(t => now - t < 60000);
  if (httpRateLimit[ip].length >= 30) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  httpRateLimit[ip].push(now);
  next();
});

// API
const { ALL_CARDS } = require('./questions');
const countryNames = ALL_CARDS.filter(c => c.type === 'flag').map(c => c.name).sort();
app.get('/countries', (req, res) => {
  const lang = req.query.lang;
  if (lang === 'he') {
    const heNames = ALL_CARDS.filter(c => c.type === 'flag').map(c => ({
      name: c.name,
      name_he: c.name_he || c.name,
    })).sort((a, b) => a.name.localeCompare(b.name));
    return res.json(heNames);
  }
  res.json(countryNames);
});
app.get('/check-room/:code', (req, res) => {
  const room = game.getRoom(req.params.code.toUpperCase());
  res.json({ exists: !!room });
});

// Analytics — structured JSON logs (pipe to PostHog/Mixpanel later)
function track(event, props = {}) {
  console.log(JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    ...props,
  }));
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});
app.get('/host', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'host.html'));
});
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'player.html'));
});

// Live stats endpoint
let totalGamesStarted = 0;
let totalGamesCompleted = 0;
let totalPlayersJoined = 0;
app.get('/stats', (req, res) => {
  const { ALL_CARDS } = require('./questions');
  const activeRooms = game.getRoomCount ? game.getRoomCount() : '?';
  res.json({
    activeRooms,
    totalGamesStarted,
    totalGamesCompleted,
    totalPlayersJoined,
    totalCards: ALL_CARDS.length,
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// Timer management
function startTimer(room, seconds, onTick, onExpire) {
  clearTimer(room);
  room.timerSeconds = seconds;
  onTick(seconds);

  room.timer = setInterval(() => {
    room.timerSeconds--;
    onTick(room.timerSeconds);
    if (room.timerSeconds <= 0) {
      clearTimer(room);
      onExpire();
    }
  }, 1000);
}

function clearTimer(room) {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

// Send the current round state to everyone
function sendRound(room) {
  const card = room.currentCard;
  const activePlayer = room.players[room.currentPlayerIndex];
  const scores = game.getScores(room);

  // Host gets full info
  io.to(room.hostSocketId).emit('new_round', {
    card: card.type === 'flag' && room.mode === 'timeline'
      ? { emoji: card.emoji, type: card.type }
      : card,
    round: room.round,
    totalRounds: room.totalRounds + room.round, // total cards played + remaining
    activePlayerName: activePlayer.name,
    activePlayerEmoji: activePlayer.emoji,
    scores,
    mode: room.mode,
    deckLeft: room.deck.length,
  });

  // Each player gets their own view
  room.players.forEach((p, i) => {
    if (i === room.currentPlayerIndex) {
      io.to(p.id).emit('your_turn', {
        card: card.type === 'flag' && room.mode === 'timeline'
          ? { emoji: card.emoji, type: card.type }
          : card,
        timeline: room.mode === 'timeline' ? game.getPlayerTimeline(room, i) : null,
        mode: room.mode,
        timeLimit: C.TURN_TIME,
      });
    } else {
      io.to(p.id).emit('wait', {
        activePlayerName: activePlayer.name,
        scores,
      });
    }
  });

  // Start timer
  startTimer(room, C.TURN_TIME,
    (sec) => {
      io.to(room.code).emit('timer_tick', { secondsLeft: sec });
      io.to(room.hostSocketId).emit('timer_tick', { secondsLeft: sec });
    },
    () => handleTimeout(room)
  );
}

function handleTimeout(room) {
  // Time's up = wrong answer
  const activePlayer = room.players[room.currentPlayerIndex];
  const card = room.currentCard;

  if (room.phase === 'steal') {
    // Steal timeout = pass
    game.passStealer(room);
    if (room.stealQueue.length > 0) {
      sendStealRound(room);
    } else {
      // Nobody stole, reveal and advance
      broadcastResult(room, false, card, activePlayer.name);
      game.advanceTurn(room);
      setTimeout(() => nextRoundOrEnd(room), 3500);
    }
  } else {
    // Normal timeout = wrong, start steal if multiplayer
    if (room.players.length > 1) {
      game.startSteal(room);
      // Don't reveal answer yet
      broadcastWrongNoReveal(room, activePlayer.name);
      setTimeout(() => sendStealRound(room), 1000);
    } else {
      broadcastResult(room, false, card, activePlayer.name);
      game.advanceTurn(room);
      setTimeout(() => nextRoundOrEnd(room), 3500);
    }
  }
}

function broadcastResult(room, correct, card, playerName) {
  const data = {
    correct,
    card,
    playerName,
    reveal: true,
    scores: game.getScores(room),
  };
  // Send to host
  io.to(room.hostSocketId).emit('round_result', data);
  // Send directly to EACH player (not just room broadcast — ensures delivery)
  room.players.forEach(p => {
    if (p.connected) io.to(p.id).emit('round_result', data);
  });
}

// Non-revealing result (wrong, steal incoming) — same direct delivery
function broadcastWrongNoReveal(room, playerName) {
  const data = {
    correct: false,
    playerName,
    reveal: false,
    scores: game.getScores(room),
  };
  io.to(room.hostSocketId).emit('round_result', data);
  room.players.forEach(p => {
    if (p.connected) io.to(p.id).emit('round_result', data);
  });
}

function sendStealRound(room) {
  const stealer = game.nextStealer(room);
  if (!stealer) {
    // No more stealers
    broadcastResult(room, false, room.currentCard, '');
    game.advanceTurn(room);
    setTimeout(() => nextRoundOrEnd(room), 3500);
    return;
  }

  const card = room.currentCard;

  // Notify host
  io.to(room.hostSocketId).emit('steal_start', {
    stealerName: stealer.name,
    stealerEmoji: stealer.emoji,
    card: card.type === 'flag' && room.mode === 'timeline'
      ? { emoji: card.emoji, type: card.type }
      : card,
    scores: game.getScores(room),
  });

  // Notify stealer
  const stealerIndex = room.players.indexOf(stealer);
  io.to(stealer.id).emit('steal_turn', {
    card: card.type === 'flag' && room.mode === 'timeline'
      ? { emoji: card.emoji, type: card.type }
      : card,
    timeline: room.mode === 'timeline' ? game.getPlayerTimeline(room, stealerIndex) : null,
    mode: room.mode,
    timeLimit: C.STEAL_TIME,
  });

  // Others wait
  room.players.forEach(p => {
    if (p.id !== stealer.id) {
      io.to(p.id).emit('steal_wait', {
        stealerName: stealer.name,
      });
    }
  });

  // Start steal timer
  startTimer(room, C.STEAL_TIME,
    (sec) => {
      io.to(room.code).emit('timer_tick', { secondsLeft: sec });
      io.to(room.hostSocketId).emit('timer_tick', { secondsLeft: sec });
    },
    () => handleTimeout(room)
  );
}

// --- MAP GAME ---
function sendMapRound(room) {
  const card = room.currentCard;
  room.mapGuesses = {};

  // Fetch Wikipedia thumbnail URL
  const wikiUrl = card.wiki ? `https://en.wikipedia.org/api/rest_v1/page/summary/${card.wiki}` : null;

  // Send to host: photo info + round info (no lat/lng yet!)
  io.to(room.hostSocketId).emit('map_round', {
    wiki: card.wiki,
    emoji: card.emoji,
    round: room.round,
    totalRounds: room.totalRounds,
    deckLeft: room.deck.length,
    scores: game.getScores(room),
    timeLimit: C.MAP_TIME,
  });

  // Send to ALL players simultaneously: wiki for photo (no lat/lng!)
  room.players.forEach(p => {
    if (p.connected) {
      io.to(p.id).emit('map_round', {
        wiki: card.wiki,
        emoji: card.emoji,
        round: room.round,
        totalRounds: room.totalRounds,
        timeLimit: C.MAP_TIME,
      });
    }
  });

  // Start timer
  startTimer(room, C.MAP_TIME,
    (sec) => {
      io.to(room.code).emit('timer_tick', { secondsLeft: sec });
      io.to(room.hostSocketId).emit('timer_tick', { secondsLeft: sec });
    },
    () => resolveMapRound(room)
  );
}

function resolveMapRound(room) {
  clearTimer(room);
  const card = room.currentCard;
  const results = game.calculateMapScores(room);

  // Send results to everyone with correct location
  const data = {
    card: { name: card.name, name_he: card.name_he, emoji: card.emoji, lat: card.lat, lng: card.lng, wiki: card.wiki },
    results,
    scores: game.getScores(room),
  };
  io.to(room.hostSocketId).emit('map_result', data);
  room.players.forEach(p => {
    if (p.connected) io.to(p.id).emit('map_result', data);
  });

  // Next round after delay
  setTimeout(() => nextRoundOrEnd(room), 5000);
}

function nextRoundOrEnd(room) {
  const card = game.nextCard(room);
  if (!card) {
    // Game over
    const scores = game.getScores(room);
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const data = { scores: sorted, winner: sorted[0], mode: room.mode };
    totalGamesCompleted++;
    track('game_completed', {
      room: room.code,
      mode: room.mode,
      players: room.players.length,
      rounds: room.round,
      winner: sorted[0] ? sorted[0].name : null,
      topScore: sorted[0] ? sorted[0].score : 0,
      scores: sorted.map(s => ({ name: s.name, score: s.score })),
    });
    io.to(room.code).emit('game_over', data);
    io.to(room.hostSocketId).emit('game_over', data);
    clearTimer(room);
    return;
  }
  if (room.mode === 'map') {
    sendMapRound(room);
  } else {
    sendRound(room);
  }
}

// Socket.IO connection handling
// Per-socket rate limiter
io.use((socket, next) => {
  socket._eventCount = 0;
  socket._eventReset = setInterval(() => { socket._eventCount = 0; }, 1000);
  socket.on('disconnect', () => clearInterval(socket._eventReset));
  next();
});

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Rate limit: max 20 events per second per socket
  socket.use((packet, next) => {
    socket._eventCount++;
    if (socket._eventCount > 20) return next(new Error('Rate limited'));
    next();
  });

  // HOST creates a room
  socket.on('create_room', (callback) => {
    if (typeof callback !== 'function') return;
    const room = game.createRoom(socket.id);
    socket.join(room.code);
    track('room_created', { code: room.code });
    // Send server URL if configured, otherwise client uses window.location.origin
    callback({ code: room.code, serverUrl: process.env.PUBLIC_URL || null });
  });

  // PLAYER joins a room
  socket.on('join_room', (data, callback) => {
    if (!data || typeof data.code !== 'string' || typeof data.name !== 'string') return callback({ error: 'Invalid input' });
    if (typeof callback !== 'function') return;
    const { code, name } = data;
    const room = game.getRoom(code);
    if (!room) return callback({ error: 'Room not found' });
    if (room.phase !== 'lobby') {
      // Try reconnect
      const reconnected = game.reconnectPlayer(room, name, socket.id);
      if (reconnected) {
        socket.join(code);
        io.to(room.hostSocketId).emit('player_joined', {
          players: room.players.map(p => ({ name: p.name, color: p.color, emoji: p.emoji, connected: p.connected })),
        });
        // Send current game state so player can rejoin mid-game
        const playerIndex = room.players.findIndex(p => p.name === name);
        if (room.phase === 'ended') {
          socket.emit('game_over', { scores: game.getScores(room), winner: game.getScores(room).sort((a, b) => b.score - a.score)[0] });
        } else if (playerIndex === room.currentPlayerIndex) {
          socket.emit('game_started', { mode: room.mode });
          socket.emit('your_turn', {
            card: room.currentCard,
            timeline: room.mode === 'timeline' ? game.getPlayerTimeline(room, playerIndex) : null,
            mode: room.mode,
            timeLimit: room.timerSeconds || 30,
          });
        } else {
          socket.emit('game_started', { mode: room.mode });
          const activePlayer = room.players[room.currentPlayerIndex];
          socket.emit('wait', { activePlayerName: activePlayer ? activePlayer.name : '...', scores: game.getScores(room) });
        }
        return callback({ success: true, reconnected: true });
      }
      return callback({ error: 'Game already started' });
    }

    const player = game.addPlayer(room, socket.id, name);
    if (player === 'NAME_TAKEN') return callback({ error: 'Name already taken' });
    if (!player) return callback({ error: 'Room is full' });

    socket.join(code);
    totalPlayersJoined++;
    track('player_joined', { room: code, name: player.name, playerCount: room.players.length });

    // Notify host and all players
    io.to(room.hostSocketId).emit('player_joined', {
      players: room.players.map(p => ({ name: p.name, color: p.color, emoji: p.emoji, connected: p.connected })),
    });

    callback({ success: true, player: { name: player.name, color: player.color, emoji: player.emoji } });
  });

  // HOST starts the game
  socket.on('start_game', (data) => {
    if (!data || !['timeline', 'quiz', 'map'].includes(data.mode)) return;
    const { mode } = data;
    const difficulty = [1, 2, 3].includes(data.difficulty) ? data.difficulty : 2;
    const length = ['short', 'medium', 'long'].includes(data.length) ? data.length : 'medium';
    const room = game.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.players.length === 0) return;

    game.startGame(room, mode, difficulty, length);
    totalGamesStarted++;
    track('game_started', { room: room.code, mode, players: room.players.length, rounds: room.totalRounds });
    const startData = { mode, totalRounds: room.totalRounds, scores: game.getScores(room) };
    io.to(room.code).emit('game_started', startData);
    io.to(room.hostSocketId).emit('game_started', startData);

    // Send first card
    game.nextCard(room);
    if (room.mode === 'map') {
      sendMapRound(room);
    } else {
      sendRound(room);
    }
  });

  // PLAYER places a card (timeline mode)
  socket.on('place_card', (data) => {
    if (!data || typeof data.slotIndex !== 'number' || !Number.isInteger(data.slotIndex)) return;
    const { slotIndex } = data;
    const room = game.getRoomBySocket(socket.id);
    if (!room) return;
    const activePlayer = room.players[room.currentPlayerIndex];
    if (activePlayer.id !== socket.id) return;
    clearTimer(room);

    if (room.phase === 'steal') {
      // Steal attempt
      const correct = game.handleStealAttempt(room, slotIndex);
      if (correct) {
        broadcastResult(room, true, room.currentCard, activePlayer.name);
        game.advanceTurn(room);
        setTimeout(() => nextRoundOrEnd(room), 3500);
      } else {
        // Wrong steal — notify without revealing
        io.to(room.code).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        io.to(room.hostSocketId).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        if (room.stealQueue.length > 0) {
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, '');
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 3500);
        }
      }
    } else {
      const correct = game.placeCard(room, slotIndex);
      if (correct) {
        broadcastResult(room, true, room.currentCard, activePlayer.name);
        game.advanceTurn(room);
        setTimeout(() => nextRoundOrEnd(room), 3500);
      } else {
        if (room.players.length > 1) {
          game.startSteal(room);
          broadcastWrongNoReveal(room, activePlayer.name);
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, activePlayer.name);
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 3500);
        }
      }
    }
  });

  // PLAYER submits quiz answer
  socket.on('submit_answer', (data) => {
    if (!data || typeof data.answer !== 'string') return;
    const { answer } = data;
    const room = game.getRoomBySocket(socket.id);
    if (!room) return;
    const activePlayer = room.players[room.currentPlayerIndex];
    if (activePlayer.id !== socket.id) return;
    clearTimer(room);

    if (room.phase === 'steal') {
      const correct = game.handleStealAttempt(room, answer);
      if (correct) {
        broadcastResult(room, true, room.currentCard, activePlayer.name);
        game.advanceTurn(room);
        setTimeout(() => nextRoundOrEnd(room), 3500);
      } else {
        io.to(room.code).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        io.to(room.hostSocketId).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        if (room.stealQueue.length > 0) {
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, '');
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 3500);
        }
      }
    } else {
      const correct = game.checkQuizAnswer(room, answer);
      if (correct) {
        broadcastResult(room, true, room.currentCard, activePlayer.name);
        game.advanceTurn(room);
        setTimeout(() => nextRoundOrEnd(room), 3500);
      } else {
        if (room.players.length > 1) {
          game.startSteal(room);
          broadcastWrongNoReveal(room, activePlayer.name);
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, activePlayer.name);
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 3500);
        }
      }
    }
  });

  // PLAYER passes on steal
  socket.on('pass_steal', () => {
    const room = game.getRoomBySocket(socket.id);
    if (!room || room.phase !== 'steal') return;
    const activePlayer = room.players[room.currentPlayerIndex];
    if (activePlayer.id !== socket.id) return;
    clearTimer(room);

    game.passStealer(room);
    if (room.stealQueue.length > 0) {
      sendStealRound(room);
    } else {
      broadcastResult(room, false, room.currentCard, '');
      game.advanceTurn(room);
      setTimeout(() => nextRoundOrEnd(room), 3500);
    }
  });

  // MAP GUESS (all players submit simultaneously)
  socket.on('map_guess', (data) => {
    if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') return;
    const room = game.getRoomBySocket(socket.id);
    if (!room || room.mode !== 'map') return;

    game.submitMapGuess(room, socket.id, data.lat, data.lng);

    // Notify host that this player locked in
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      io.to(room.hostSocketId).emit('map_player_locked', {
        name: player.name, emoji: player.emoji,
        lockedCount: Object.keys(room.mapGuesses).length,
        totalPlayers: room.players.filter(p => p.connected).length,
      });
    }

    // If all players have guessed, resolve immediately
    if (game.allMapGuessesIn(room)) {
      resolveMapRound(room);
    }
  });

  // HOST restarts game
  socket.on('play_again', () => {
    const room = game.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'lobby';
    clearTimer(room);
    io.to(room.code).emit('back_to_lobby');
    io.to(room.hostSocketId).emit('back_to_lobby');
  });

  // Disconnect
  socket.on('disconnect', () => {
    const room = game.getRoomBySocket(socket.id);
    if (!room) return;
    if (room.hostSocketId === socket.id) {
      // Host left — end the room and clean up
      clearTimer(room);
      io.to(room.code).emit('host_left');
      game.deleteRoom(room.code);
    } else {
      game.removePlayer(room, socket.id);
      io.to(room.hostSocketId).emit('player_joined', {
        players: room.players.map(p => ({ name: p.name, color: p.color, emoji: p.emoji, connected: p.connected })),
      });
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`PastBlast server running on port ${PORT}`);
});
// PastBlast v1.0

// map prototype
