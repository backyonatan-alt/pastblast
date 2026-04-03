const { ALL_CARDS } = require('./questions');
const C = require('./constants');

const rooms = new Map();

// Clean alphabet (no O/I to avoid confusion with 0/1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < C.CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createRoom(hostSocketId) {
  const code = generateCode();
  const room = {
    code,
    hostSocketId,
    mode: null,
    phase: 'lobby', // lobby | playing | steal | ended
    players: [],
    deck: [],
    currentCard: null,
    currentPlayerIndex: 0,
    round: 0,
    totalRounds: 0,
    stealQueue: [],
    stealOriginalPlayerIndex: null,
    timer: null,
    timerSeconds: 0,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.hostSocketId === socketId) return room;
    if (room.players.some(p => p.id === socketId)) return room;
  }
  return null;
}

function addPlayer(room, socketId, name) {
  if (room.players.length >= C.MAX_PLAYERS) return null;
  if (room.phase !== 'lobby') return null;

  const colors = ['#ff6b6b', '#51cf66', '#339af0', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595'];
  const emojis = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '🟢', '🩷'];

  const player = {
    id: socketId,
    name: name.substring(0, 12),
    score: 0,
    timeline: [],
    streak: 0,
    bestStreak: 0,
    color: colors[room.players.length],
    emoji: emojis[room.players.length],
    connected: true,
  };
  room.players.push(player);
  return player;
}

function removePlayer(room, socketId) {
  const idx = room.players.findIndex(p => p.id === socketId);
  if (idx !== -1) {
    room.players[idx].connected = false;
  }
}

function reconnectPlayer(room, name, newSocketId) {
  const player = room.players.find(p => p.name === name && !p.connected);
  if (player) {
    player.id = newSocketId;
    player.connected = true;
    return player;
  }
  return null;
}

function startGame(room, mode) {
  room.mode = mode;
  room.phase = 'playing';
  room.round = 0;

  if (mode === 'timeline') {
    const flags = shuffle(ALL_CARDS.filter(c => c.type === 'flag'));
    const landmarks = shuffle(ALL_CARDS.filter(c => c.type === 'landmark'));
    const history = shuffle(ALL_CARDS.filter(c => c.type === 'history'));
    const n = C.TIMELINE_CARDS_PER_TYPE;
    room.deck = shuffle([
      ...flags.slice(0, n),
      ...landmarks.slice(0, n),
      ...history.slice(0, n),
    ]);

    // Give each player a starter card
    room.players.forEach(p => {
      p.score = 1;
      p.timeline = [room.deck.shift()];
    });
    room.totalRounds = room.deck.length;
  } else {
    room.deck = shuffle([...ALL_CARDS.filter(c => c.type === 'flag')]);
    room.deck = room.deck.slice(0, C.QUIZ_ROUNDS);
    room.totalRounds = room.deck.length;
    room.players.forEach(p => {
      p.score = 0;
      p.streak = 0;
      p.bestStreak = 0;
    });
  }

  // Shuffle player order
  room.players = shuffle(room.players);
  room.currentPlayerIndex = 0;
  room.stealQueue = [];
}

function nextCard(room) {
  if (room.deck.length === 0) {
    room.phase = 'ended';
    return null;
  }
  room.currentCard = room.deck.shift();
  room.round++;
  room.stealQueue = [];
  room.phase = 'playing';
  return room.currentCard;
}

function isCorrectPlacement(card, index, timeline) {
  const sorted = [...timeline].sort((a, b) => a.year - b.year);
  const before = index > 0 ? sorted[index - 1] : null;
  const after = index < sorted.length ? sorted[index] : null;
  return (!before || before.year <= card.year) && (!after || card.year <= after.year);
}

function placeCard(room, slotIndex) {
  const player = room.players[room.currentPlayerIndex];
  const card = room.currentCard;
  const correct = isCorrectPlacement(card, slotIndex, player.timeline);

  if (correct) {
    player.timeline.push(card);
    player.score = player.timeline.length;
  }
  return correct;
}

function checkQuizAnswer(room, answer) {
  const correct = answer === room.currentCard.name;
  const player = room.players[room.currentPlayerIndex];

  if (correct) {
    player.score++;
    player.streak++;
    if (player.streak > player.bestStreak) player.bestStreak = player.streak;
  } else {
    player.streak = 0;
  }
  return correct;
}

function startSteal(room) {
  room.stealOriginalPlayerIndex = room.currentPlayerIndex;
  room.stealQueue = room.players
    .map((_, i) => i)
    .filter(i => i !== room.currentPlayerIndex);
  room.phase = 'steal';
}

function nextStealer(room) {
  if (room.stealQueue.length === 0) {
    room.phase = 'playing';
    return null;
  }
  room.currentPlayerIndex = room.stealQueue[0];
  return room.players[room.currentPlayerIndex];
}

function handleStealAttempt(room, answer) {
  const player = room.players[room.currentPlayerIndex];
  let correct = false;

  if (room.mode === 'timeline') {
    correct = isCorrectPlacement(room.currentCard, answer, player.timeline);
    if (correct) {
      player.timeline.push(room.currentCard);
      player.score = player.timeline.length;
    } else {
      if (player.timeline.length > 1) {
        player.timeline.pop();
        player.score = player.timeline.length;
      }
    }
  } else {
    correct = answer === room.currentCard.name;
    if (correct) {
      player.score++;
      player.streak++;
      if (player.streak > player.bestStreak) player.bestStreak = player.streak;
    } else {
      if (player.score > 0) player.score--;
      player.streak = 0;
    }
  }

  if (correct) {
    room.stealQueue = [];
    room.phase = 'playing';
  } else {
    room.stealQueue.shift();
  }

  return correct;
}

function passStealer(room) {
  room.stealQueue.shift();
  if (room.stealQueue.length === 0) {
    room.phase = 'playing';
  }
}

function advanceTurn(room) {
  // Move to next player (round-robin from original order)
  if (room.stealOriginalPlayerIndex !== null) {
    // After steal, advance from the original player
    room.currentPlayerIndex = (room.stealOriginalPlayerIndex + 1) % room.players.length;
    room.stealOriginalPlayerIndex = null;
  } else {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  }
}

function getScores(room) {
  return room.players.map(p => ({
    name: p.name,
    score: p.score,
    color: p.color,
    emoji: p.emoji,
    streak: p.streak,
    bestStreak: p.bestStreak,
  }));
}

function getPlayerTimeline(room, playerIndex) {
  const tl = room.players[playerIndex].timeline;
  return [...tl].sort((a, b) => a.year - b.year);
}

function cleanupStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > C.ROOM_TTL) {
      if (room.timer) clearInterval(room.timer);
      rooms.delete(code);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupStaleRooms, 10 * 60 * 1000);

module.exports = {
  createRoom,
  getRoom,
  getRoomBySocket,
  addPlayer,
  removePlayer,
  reconnectPlayer,
  startGame,
  nextCard,
  placeCard,
  checkQuizAnswer,
  startSteal,
  nextStealer,
  handleStealAttempt,
  passStealer,
  advanceTurn,
  getScores,
  getPlayerTimeline,
  formatYear: (y) => y < 0 ? `${Math.abs(y)} BCE` : `${y}`,
};
