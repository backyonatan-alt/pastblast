const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const C = require('./constants');
const game = require('./gameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API
const { ALL_CARDS } = require('./questions');
const countryNames = ALL_CARDS.filter(c => c.type === 'flag').map(c => c.name).sort();
app.get('/countries', (req, res) => res.json(countryNames));
app.get('/check-room/:code', (req, res) => {
  const room = game.getRoom(req.params.code.toUpperCase());
  res.json({ exists: !!room });
});

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
      setTimeout(() => nextRoundOrEnd(room), 2000);
    }
  } else {
    // Normal timeout = wrong, start steal if multiplayer
    if (room.players.length > 1) {
      game.startSteal(room);
      // Don't reveal answer yet
      io.to(room.code).emit('round_result', {
        correct: false,
        playerName: activePlayer.name,
        reveal: false,
        scores: game.getScores(room),
      });
      io.to(room.hostSocketId).emit('round_result', {
        correct: false,
        playerName: activePlayer.name,
        reveal: false,
        scores: game.getScores(room),
      });
      setTimeout(() => sendStealRound(room), 1000);
    } else {
      broadcastResult(room, false, card, activePlayer.name);
      game.advanceTurn(room);
      setTimeout(() => nextRoundOrEnd(room), 2000);
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
  io.to(room.code).emit('round_result', data);
  io.to(room.hostSocketId).emit('round_result', data);
}

function sendStealRound(room) {
  const stealer = game.nextStealer(room);
  if (!stealer) {
    // No more stealers
    broadcastResult(room, false, room.currentCard, '');
    game.advanceTurn(room);
    setTimeout(() => nextRoundOrEnd(room), 2000);
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

function nextRoundOrEnd(room) {
  const card = game.nextCard(room);
  if (!card) {
    // Game over
    const scores = game.getScores(room);
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const data = { scores: sorted, winner: sorted[0], mode: room.mode };
    io.to(room.code).emit('game_over', data);
    io.to(room.hostSocketId).emit('game_over', data);
    clearTimer(room);
    return;
  }
  sendRound(room);
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // HOST creates a room
  socket.on('create_room', (callback) => {
    const room = game.createRoom(socket.id);
    socket.join(room.code);
    console.log(`Room created: ${room.code} by ${socket.id}`);
    callback({ code: room.code });
  });

  // PLAYER joins a room
  socket.on('join_room', ({ code, name }, callback) => {
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
        return callback({ success: true, reconnected: true });
      }
      return callback({ error: 'Game already started' });
    }

    const player = game.addPlayer(room, socket.id, name);
    if (!player) return callback({ error: 'Room is full' });

    socket.join(code);
    console.log(`${name} joined room ${code}`);

    // Notify host and all players
    io.to(room.hostSocketId).emit('player_joined', {
      players: room.players.map(p => ({ name: p.name, color: p.color, emoji: p.emoji, connected: p.connected })),
    });

    callback({ success: true, player: { name: player.name, color: player.color, emoji: player.emoji } });
  });

  // HOST starts the game
  socket.on('start_game', ({ mode }) => {
    const room = game.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.players.length === 0) return;

    game.startGame(room, mode);
    io.to(room.code).emit('game_started', { mode, totalRounds: room.totalRounds });
    io.to(room.hostSocketId).emit('game_started', { mode, totalRounds: room.totalRounds });

    // Send first card
    game.nextCard(room);
    sendRound(room);
  });

  // PLAYER places a card (timeline mode)
  socket.on('place_card', ({ slotIndex }) => {
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
        setTimeout(() => nextRoundOrEnd(room), 2000);
      } else {
        // Wrong steal — notify without revealing
        io.to(room.code).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        io.to(room.hostSocketId).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        if (room.stealQueue.length > 0) {
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, '');
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 2000);
        }
      }
    } else {
      const correct = game.placeCard(room, slotIndex);
      if (correct) {
        broadcastResult(room, true, room.currentCard, activePlayer.name);
        game.advanceTurn(room);
        setTimeout(() => nextRoundOrEnd(room), 2000);
      } else {
        if (room.players.length > 1) {
          game.startSteal(room);
          io.to(room.code).emit('round_result', { correct: false, playerName: activePlayer.name, reveal: false, scores: game.getScores(room) });
          io.to(room.hostSocketId).emit('round_result', { correct: false, playerName: activePlayer.name, reveal: false, scores: game.getScores(room) });
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, activePlayer.name);
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 2000);
        }
      }
    }
  });

  // PLAYER submits quiz answer
  socket.on('submit_answer', ({ answer }) => {
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
        setTimeout(() => nextRoundOrEnd(room), 2000);
      } else {
        io.to(room.code).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        io.to(room.hostSocketId).emit('steal_result', { correct: false, stealerName: activePlayer.name, scores: game.getScores(room) });
        if (room.stealQueue.length > 0) {
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, '');
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 2000);
        }
      }
    } else {
      const correct = game.checkQuizAnswer(room, answer);
      if (correct) {
        broadcastResult(room, true, room.currentCard, activePlayer.name);
        game.advanceTurn(room);
        setTimeout(() => nextRoundOrEnd(room), 2000);
      } else {
        if (room.players.length > 1) {
          game.startSteal(room);
          io.to(room.code).emit('round_result', { correct: false, playerName: activePlayer.name, reveal: false, scores: game.getScores(room) });
          io.to(room.hostSocketId).emit('round_result', { correct: false, playerName: activePlayer.name, reveal: false, scores: game.getScores(room) });
          setTimeout(() => sendStealRound(room), 1500);
        } else {
          broadcastResult(room, false, room.currentCard, activePlayer.name);
          game.advanceTurn(room);
          setTimeout(() => nextRoundOrEnd(room), 2000);
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
      setTimeout(() => nextRoundOrEnd(room), 2000);
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
      // Host left — end the room
      clearTimer(room);
      io.to(room.code).emit('host_left');
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
