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

function sanitize(str) {
  return str.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

function addPlayer(room, socketId, name) {
  if (room.players.length >= C.MAX_PLAYERS) return null;
  if (room.phase !== 'lobby') return null;
  if (!name || typeof name !== 'string') return null;

  const cleanName = sanitize(name.trim().substring(0, 12));
  if (cleanName.length === 0) return null;

  // Prevent duplicate names — only allow reuse if disconnected
  const existing = room.players.find(p => p.name === cleanName);
  if (existing) {
    if (existing.connected) return 'NAME_TAKEN';
    existing.id = socketId;
    existing.connected = true;
    return existing;
  }

  const colors = ['#ff6b6b', '#51cf66', '#339af0', '#fcc419', '#cc5de8', '#ff922b', '#20c997', '#f06595'];
  const emojis = ['🔴', '🟢', '🔵', '🟡', '🟣', '🟠', '🟢', '🩷'];

  const player = {
    id: socketId,
    name: cleanName,
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

function startGame(room, mode, difficulty, length) {
  room.mode = mode;
  room.phase = 'playing';
  room.round = 0;

  // Determine round count from length
  const roundCounts = { short: 10, medium: 20, long: 30 };
  const targetRounds = roundCounts[length] || 20;

  // Difficulty filter: easy=1 only, medium=1+2, hard=1+2+3
  const maxDiff = difficulty || 2;
  const diffFilter = (c) => !c.difficulty || c.difficulty <= maxDiff;

  if (mode === 'timeline') {
    // Timeline mode: landmarks + history only (no flags)
    const landmarks = shuffle(ALL_CARDS.filter(c => c.type === 'landmark' && diffFilter(c)));
    const history = shuffle(ALL_CARDS.filter(c => c.type === 'history' && diffFilter(c)));
    room.deck = shuffle([...landmarks, ...history]).slice(0, targetRounds + room.players.length);

    // Give each player a starter card
    room.players.forEach(p => {
      p.score = 1;
      p.timeline = [room.deck.shift()];
    });
    room.totalRounds = room.deck.length;
  } else if (mode === 'map') {
    // Map mode: landmarks + cities + nature with coordinates
    const mapCards = shuffle(ALL_CARDS.filter(c =>
      (c.type === 'landmark' || c.type === 'city' || c.type === 'nature') &&
      c.lat && c.lng && diffFilter(c)
    ));
    const mapRounds = C.MAP_ROUNDS[length] || 10;
    room.deck = mapCards.slice(0, mapRounds);
    room.totalRounds = room.deck.length;
    room.mapGuesses = {}; // { socketId: { lat, lng, time } }
    room.difficulty = difficulty;
    room.mapTimeLimit = C.MAP_TIME[difficulty] || 30;
    room.players.forEach(p => {
      p.score = 0;
    });
  } else {
    // Flag quiz
    room.deck = shuffle(ALL_CARDS.filter(c => c.type === 'flag'));
    room.deck = room.deck.slice(0, targetRounds);
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

// Haversine distance in km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function submitMapGuess(room, socketId, lat, lng) {
  const timeLimit = room.mapTimeLimit || 30;
  const timeUsed = timeLimit - (room.timerSeconds || 0);
  room.mapGuesses[socketId] = { lat, lng, timeUsed };
}

function calculateMapScores(room) {
  const card = room.currentCard;
  const results = [];

  room.players.forEach(p => {
    const guess = room.mapGuesses[p.id];
    let dist, distPoints, speedBonus, countryBonus, roundScore;

    if (guess) {
      dist = haversine(guess.lat, guess.lng, card.lat, card.lng);
      const timeLimit = room.mapTimeLimit || 30;

      // Tiered distance scoring
      if (dist < 50) {
        distPoints = 1000;
      } else if (dist < 300) {
        distPoints = Math.round(600 + 400 * (1 - (dist - 50) / 250));
      } else if (dist < 1000) {
        distPoints = Math.round(200 + 400 * (1 - (dist - 300) / 700));
      } else if (dist < 2000) {
        distPoints = Math.round(50 + 150 * (1 - (dist - 1000) / 1000));
      } else if (dist < 4000) {
        distPoints = Math.round(10 + 40 * (1 - (dist - 2000) / 2000));
      } else {
        distPoints = 0;
      }

      // Speed bonus: full if <1000km, half if 1000-2000km, none if >2000km
      const rawSpeed = Math.max(0, Math.round(500 * (1 - guess.timeUsed / timeLimit)));
      if (dist < 1000) {
        speedBonus = rawSpeed;
      } else if (dist < 2000) {
        speedBonus = Math.round(rawSpeed * 0.5);
      } else {
        speedBonus = 0;
      }

      // Nearby bonus: within 300km
      countryBonus = dist < 300 ? 200 : 0;
      roundScore = distPoints + speedBonus + countryBonus;
    } else {
      dist = 20000;
      distPoints = 0;
      speedBonus = 0;
      countryBonus = 0;
      roundScore = 0;
    }

    p.score += roundScore;

    results.push({
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      guessLat: guess ? guess.lat : null,
      guessLng: guess ? guess.lng : null,
      dist: Math.round(dist),
      distPoints,
      speedBonus,
      countryBonus,
      roundScore,
      totalScore: p.score,
    });
  });

  // Reset guesses for next round
  room.mapGuesses = {};

  return results;
}

function allMapGuessesIn(room) {
  const connected = room.players.filter(p => p.connected);
  return connected.every(p => room.mapGuesses[p.id]);
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

function deleteRoom(code) {
  const room = rooms.get(code);
  if (room && room.timer) clearInterval(room.timer);
  rooms.delete(code);
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
  deleteRoom,
  getRoomCount: () => rooms.size,
  submitMapGuess,
  calculateMapScores,
  allMapGuessesIn,
  haversine,
  formatYear: (y) => y < 0 ? `${Math.abs(y)} BCE` : `${y}`,
};
