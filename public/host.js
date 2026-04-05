const socket = io();
let roomCode = '';
let selectedMode = 'timeline';
let selectedDifficulty = 2;
let selectedLength = 'medium';
let timerMax = 30;
let currentMode = 'timeline';

function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// --- CREATE ROOM (wait for connection first) ---
function createRoom() {
    socket.emit('create_room', (response) => {
    roomCode = response.code;
    trackEvent('room_created', { room_code: roomCode });
    document.getElementById('room-code').textContent = roomCode;

    const baseUrl = response.serverUrl || window.location.origin;
    const joinUrl = `${baseUrl}/?code=${roomCode}`;
    document.getElementById('join-url').textContent = baseUrl;

    // Generate QR code
    generateQR(joinUrl);
    });
}

// Wait for socket to connect before creating room
if (socket.connected) {
    createRoom();
} else {
    socket.on('connect', createRoom);
}

function generateQR(url) {
    const qrBox = document.getElementById('qr-code');
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=10`;
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
    document.getElementById('mode-map').classList.toggle('active', mode === 'map');
}

function selectDifficulty(level) {
    selectedDifficulty = level;
    [1, 2, 3].forEach(l => document.getElementById('diff-' + l).classList.toggle('active', l === level));
}

function selectLength(len) {
    selectedLength = len;
    ['short', 'medium', 'long'].forEach(l => document.getElementById('len-' + l).classList.toggle('active', l === len));
}

function startGame() {
    socket.emit('start_game', { mode: selectedMode, difficulty: selectedDifficulty, length: selectedLength });
    trackEvent('game_started_by_host', { game_mode: selectedMode, difficulty: selectedDifficulty, length: selectedLength, room_code: roomCode });
}

function playAgain() {
    trackEvent('play_again_clicked', { room_code: roomCode });
    // Disable button immediately to prevent double-click
    const btn = document.querySelector('.play-again-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
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
    currentMode = mode;
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    document.getElementById('end-screen').style.display = 'none';
    if (scores) renderScores(scores);
});

// --- NEW ROUND ---
socket.on('new_round', ({ card, round, activePlayerName, activePlayerEmoji, scores, mode, deckLeft }) => {
    document.getElementById('steal-bar').style.display = 'none';
    document.getElementById('turn-label').innerHTML = isRTL() ? `${t('turn_suffix')} ${esc(activePlayerName)} ${activePlayerEmoji}` : `${activePlayerEmoji} ${esc(activePlayerName)}${t('turn_suffix')}`;
    document.getElementById('round-label').textContent = `${deckLeft} ${t('cards_left')}`;

    renderCard(card, mode);
    renderScores(scores, activePlayerName);
    timerMax = 30;
});

function cardName(card) {
    return (isRTL() && card.name_he) ? card.name_he : card.name;
}
function cardDesc(card) {
    return (isRTL() && card.desc_he) ? card.desc_he : (card.desc || '');
}

function renderCard(card, mode) {
    const area = document.getElementById('card-area');
    if (card.type === 'flag' && mode === 'timeline') {
        area.innerHTML = `
            <div class="host-card">
                <div class="card-emoji">${card.emoji}</div>
                <div class="card-desc">${t('when_founded')}</div>
            </div>`;
    } else if (card.type === 'flag') {
        area.innerHTML = `
            <div class="host-card">
                <div class="card-emoji">${card.emoji}</div>
            </div>`;
    } else {
        const label = card.type === 'landmark' ? t('landmark') : t('history');
        area.innerHTML = `
            <div class="host-card">
                <div class="card-category">${label}</div>
                <div class="card-emoji">${card.emoji}</div>
                <div class="card-title">${cardName(card)}</div>
                <div class="card-desc">${cardDesc(card)}</div>
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
        // Show the answer on the host card area so everyone can see
        const yearText = card.year < 0 ? `${Math.abs(card.year)} BCE` : `${card.year}`;
        const resultColor = correct ? '#51cf66' : '#ff6b6b';
        const resultIcon = correct ? '✅' : '❌';
        const showYear = currentMode === 'timeline';
        document.getElementById('card-area').innerHTML = `
            <div class="host-card" style="border-color:${resultColor};">
                <div style="font-size:1.2rem;color:${resultColor};font-weight:700;margin-bottom:8px;">${resultIcon} ${correct ? esc(playerName) + ' ' + t('got_it_right') : t('the_answer_was')}</div>
                <div class="card-emoji">${card.emoji}</div>
                <div class="card-title">${esc(cardName(card))}</div>
                ${showYear ? `<div style="font-size:2.5rem;font-weight:900;color:#ffd43b;margin-top:8px;">${yearText}</div>` : ''}
            </div>`;
        document.getElementById('turn-label').innerHTML = '';
    } else if (!correct && playerName) {
        document.getElementById('turn-label').innerHTML = `${esc(playerName)} ${t('got_it_wrong')}`;
    }
    if (scores) renderScores(scores);
});

// --- STEAL ---
socket.on('steal_start', ({ stealerName, stealerEmoji, card, scores }) => {
    document.getElementById('steal-bar').style.display = 'flex';
    document.getElementById('steal-info').innerHTML = `${stealerEmoji} <b>${esc(stealerName)}</b> ${t('can_steal')}`;
    document.getElementById('turn-label').innerHTML = isRTL() ? `${t('steal')} ${esc(stealerName)} ${stealerEmoji}` : `${stealerEmoji} ${esc(stealerName)} — ${t('steal')}`;
    timerMax = 15;
    if (scores) renderScores(scores, stealerName);
});

socket.on('steal_result', ({ correct, stealerName, scores }) => {
    if (!correct) {
        document.getElementById('turn-label').innerHTML = `${esc(stealerName)} ${t('missed')}`;
    }
    if (scores) renderScores(scores);
});

// --- MAP GAME ---
socket.on('map_round', ({ wiki, emoji, round, totalRounds, deckLeft, scores, timeLimit }) => {
    document.getElementById('steal-bar').style.display = 'none';
    document.getElementById('turn-label').textContent = `Round ${round} / ${totalRounds}`;
    document.getElementById('round-label').textContent = '';
    timerMax = timeLimit;

    // Show photo on host
    const area = document.getElementById('card-area');
    area.innerHTML = `
        <div class="host-card" style="padding:16px 24px;">
            <img src="" id="host-map-photo" style="width:100%;max-width:400px;height:250px;object-fit:contain;border-radius:12px;background:rgba(0,0,0,0.3);display:block;margin:0 auto;">
            <div style="font-size:1.1rem;color:rgba(255,255,255,0.5);margin-top:8px;">Where is this place?</div>
        </div>`;

    if (wiki) {
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wiki}`)
            .then(r => r.json())
            .then(data => {
                const img = document.getElementById('host-map-photo');
                if (img && data.thumbnail) img.src = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
            }).catch(() => {});
    }

    if (scores) renderScores(scores);
});

socket.on('map_player_locked', ({ name, emoji, lockedCount, totalPlayers }) => {
    document.getElementById('round-label').textContent = `${lockedCount}/${totalPlayers} locked in`;
});

socket.on('map_result', ({ card, results, scores }) => {
    const cName = (typeof isRTL === 'function' && isRTL() && card.name_he) ? card.name_he : card.name;

    // Show results on host: name + all player distances
    let html = `<div class="host-card" style="padding:16px 24px;">
        <div style="font-size:2rem;">${card.emoji}</div>
        <div class="card-title" style="color:#ffd43b;">${esc(cName)}</div>
        <div style="margin-top:12px;">`;

    results.sort((a, b) => b.roundScore - a.roundScore);
    results.forEach(r => {
        const emoji = r.roundScore >= 1000 ? '🎯' : r.roundScore >= 500 ? '🔥' : r.roundScore >= 200 ? '👍' : '😅';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span>${r.emoji} ${esc(r.name)}</span>
            <span>${emoji} +${r.roundScore} <span style="color:rgba(255,255,255,0.4);font-size:0.8rem;">(${r.dist}km)</span></span>
        </div>`;
    });

    html += `</div></div>`;
    document.getElementById('card-area').innerHTML = html;

    if (scores) renderScores(scores);
});

// --- GAME OVER ---
socket.on('game_over', ({ scores, winner, mode }) => {
    trackEvent('game_completed', { game_mode: mode, player_count: scores.length, winner_score: winner ? winner.score : 0 });
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'flex';

    document.getElementById('winner-banner').innerHTML = `${winner.emoji} ${esc(winner.name)} ${t('wins_with')} ${winner.score}!`;

    const sb = document.getElementById('scoreboard');
    sb.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'sb-card';
        card.style.background = p.color;
        card.innerHTML = `
            <div class="sb-rank">${medals[i] || '#' + (i + 1)}</div>
            <div class="sb-name">${esc(p.name)}</div>
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
            <div class="score-chart-name">${esc(p.name)}</div>
        `;
        chart.appendChild(col);
    });
}

function showFeedback(correct, card) {
    const fb = document.createElement('div');
    fb.className = `feedback ${correct ? 'correct' : 'wrong'}`;
    const yearText = card.year < 0 ? `${Math.abs(card.year)} BCE` : `${card.year}`;
    const showYear = currentMode === 'timeline';
    fb.innerHTML = `
        <div class="fb-flag">${card.emoji}</div>
        <div class="fb-name">${correct ? '✅' : '❌'} ${cardName(card)}</div>
        ${showYear ? `<div class="fb-year">${yearText}</div>` : ''}
    `;
    document.body.appendChild(fb);
    setTimeout(() => fb.remove(), 3200);
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
