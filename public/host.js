const socket = io();
let roomCode = '';
let selectedMode = 'timeline';
let timerMax = 30;

// --- CREATE ROOM ---
socket.emit('create_room', (response) => {
    roomCode = response.code;
    document.getElementById('room-code').textContent = roomCode;

    const baseUrl = response.serverUrl || window.location.origin;
    const joinUrl = `${baseUrl}/?code=${roomCode}`;
    document.getElementById('join-url').textContent = baseUrl;

    // Generate QR code
    generateQR(joinUrl);
});

function generateQR(url) {
    const qrBox = document.getElementById('qr-code');
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&bgcolor=1b1464&color=ffffff`;
    img.width = 180;
    img.height = 180;
    img.alt = 'QR code to join the game';
    img.style.borderRadius = '12px';
    qrBox.appendChild(img);
}

function selectMode(mode) {
    selectedMode = mode;
    document.getElementById('mode-timeline').classList.toggle('active', mode === 'timeline');
    document.getElementById('mode-quiz').classList.toggle('active', mode === 'quiz');
}

function startGame() {
    socket.emit('start_game', { mode: selectedMode });
}

function playAgain() {
    socket.emit('play_again');
    // Fallback: if server doesn't respond in 2s, force back to lobby
    setTimeout(() => {
        if (document.getElementById('end-screen').style.display !== 'none') {
            document.getElementById('game-screen').style.display = 'none';
            document.getElementById('end-screen').style.display = 'none';
            document.getElementById('lobby').style.display = 'flex';
            document.getElementById('score-chart').innerHTML = '';
        }
    }, 2000);
}

// --- LOBBY EVENTS ---
socket.on('player_joined', ({ players }) => {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    players.forEach(p => {
        const chip = document.createElement('div');
        chip.className = `player-chip ${p.connected ? '' : 'disconnected'}`;
        chip.style.background = p.color;
        chip.textContent = `${p.emoji} ${p.name}`;
        list.appendChild(chip);
    });
    document.getElementById('start-btn').disabled = players.length === 0;
});

// --- GAME START ---
socket.on('game_started', ({ mode, scores }) => {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('end-screen').style.display = 'none';
    if (scores) renderScores(scores);
});

// --- NEW ROUND ---
socket.on('new_round', ({ card, round, activePlayerName, activePlayerEmoji, scores, mode, deckLeft }) => {
    document.getElementById('steal-bar').style.display = 'none';
    document.getElementById('turn-label').innerHTML = `${activePlayerEmoji} ${activePlayerName}'s turn`;
    document.getElementById('round-label').textContent = `${deckLeft} cards left`;

    renderCard(card, mode);
    renderScores(scores, activePlayerName);
    timerMax = 30;
});

function renderCard(card, mode) {
    const area = document.getElementById('card-area');
    if (card.type === 'flag' && mode === 'timeline') {
        // Flag in timeline mode: show only emoji + hint
        area.innerHTML = `
            <div class="host-card">
                <div class="card-emoji">${card.emoji}</div>
                <div class="card-desc">When was this country founded?</div>
            </div>`;
    } else if (card.type === 'flag') {
        // Flag in quiz mode: just the flag
        area.innerHTML = `
            <div class="host-card">
                <div class="card-emoji">${card.emoji}</div>
            </div>`;
    } else {
        const label = card.type === 'landmark' ? 'Landmark' : 'History';
        area.innerHTML = `
            <div class="host-card">
                <div class="card-category">${label}</div>
                <div class="card-emoji">${card.emoji}</div>
                <div class="card-title">${card.name}</div>
                <div class="card-desc">${card.desc || ''}</div>
            </div>`;
    }
}

// --- TIMER ---
socket.on('timer_tick', ({ secondsLeft }) => {
    const pct = (secondsLeft / timerMax) * 100;
    const fill = document.getElementById('timer-fill');
    fill.style.width = pct + '%';
    fill.className = 'timer-bar-fill' + (secondsLeft <= 5 ? ' urgent' : '');

    const num = document.getElementById('timer-number');
    num.textContent = secondsLeft;
    num.className = 'timer-number' + (secondsLeft <= 5 ? ' urgent' : '');
});

// --- ROUND RESULT ---
socket.on('round_result', ({ correct, card, playerName, reveal, scores }) => {
    if (reveal && card) {
        showFeedback(correct, card);
    } else if (!correct && playerName) {
        // Wrong but no reveal (steal incoming)
        document.getElementById('turn-label').innerHTML = `${playerName} got it wrong...`;
    }
    if (scores) renderScores(scores);
});

// --- STEAL ---
socket.on('steal_start', ({ stealerName, stealerEmoji, card, scores }) => {
    document.getElementById('steal-bar').style.display = 'flex';
    document.getElementById('steal-info').innerHTML = `${stealerEmoji} <b>${stealerName}</b> can steal!`;
    document.getElementById('turn-label').innerHTML = `${stealerEmoji} ${stealerName}'s steal`;
    timerMax = 15;
    if (scores) renderScores(scores, stealerName);
});

socket.on('steal_result', ({ correct, stealerName, scores }) => {
    if (!correct) {
        document.getElementById('turn-label').innerHTML = `${stealerName} missed!`;
    }
    if (scores) renderScores(scores);
});

// --- GAME OVER ---
socket.on('game_over', ({ scores, winner }) => {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'flex';

    document.getElementById('winner-banner').innerHTML = `${winner.emoji} ${winner.name} wins with ${winner.score}!`;

    const sb = document.getElementById('scoreboard');
    sb.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'sb-card';
        card.style.background = p.color;
        card.innerHTML = `
            <div class="sb-rank">${medals[i] || '#' + (i + 1)}</div>
            <div class="sb-name">${p.name}</div>
            <div class="sb-score">${p.score}</div>
        `;
        sb.appendChild(card);
    });

    spawnConfetti();
});

socket.on('back_to_lobby', () => {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('lobby').style.display = 'flex';
    document.getElementById('score-chart').innerHTML = '';
});

// --- HELPERS ---
function renderScores(scores, activeName) {
    const chart = document.getElementById('score-chart');
    const max = Math.max(...scores.map(s => s.score), 1);
    const maxH = 160;

    chart.innerHTML = '';
    scores.forEach(p => {
        const barH = Math.max(6, (p.score / max) * maxH);
        const isActive = p.name === activeName;
        const col = document.createElement('div');
        col.className = 'score-chart-col';
        col.innerHTML = `
            <div class="score-chart-score">${p.score}</div>
            <div class="score-chart-bar ${isActive ? 'active' : ''}" style="height:${barH}px;background:${p.color};"></div>
            <div class="score-chart-emoji">${p.emoji}</div>
            <div class="score-chart-name">${p.name}</div>
        `;
        chart.appendChild(col);
    });
}

function showFeedback(correct, card) {
    const fb = document.createElement('div');
    fb.className = `feedback ${correct ? 'correct' : 'wrong'}`;
    const yearText = card.year < 0 ? `${Math.abs(card.year)} BCE` : `${card.year}`;
    fb.innerHTML = `
        <div class="fb-flag">${card.emoji}</div>
        <div class="fb-name">${correct ? '✅' : '❌'} ${card.name}</div>
        <div class="fb-year">${yearText}</div>
    `;
    document.body.appendChild(fb);
    setTimeout(() => fb.remove(), 1500);
}

function spawnConfetti() {
    const emojis = ['🎉', '🎊', '⭐', '🏆', '🥇', '✨', '🎈', '🇺🇸', '🇫🇷', '🇧🇷', '🇩🇪', '🇯🇵', '🇮🇱', '🇮🇳', '🇬🇧'];
    for (let i = 0; i < 30; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        c.style.left = Math.random() * 100 + 'vw';
        c.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        c.style.animationDelay = (Math.random() * 1) + 's';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4000);
    }
}
