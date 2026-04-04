const socket = io();

// Client-side HTML escaping (defense-in-depth — server also sanitizes)
function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

const params = new URLSearchParams(window.location.search);
const roomCode = params.get('code');
const playerName = params.get('name');
let currentMode = '';
let timerMax = 30;
let allCountryNames = [];
let resultLock = false; // prevent wait screen from overriding result
let submitLock = false; // prevent double-submit on rapid tap

// Load country names for autocomplete
fetch('/countries')
    .then(r => r.json())
    .then(names => { allCountryNames = names; })
    .catch(() => {});

let hasJoined = false;

// Show player name
document.getElementById('my-name').textContent = playerName;

// Join the room (wait for connection first)
function joinRoom() {
    socket.emit('join_room', { code: roomCode, name: playerName }, (response) => {
        hasJoined = true;
        if (response.error) {
            trackEvent('join_error', { error_type: response.error, room_code: roomCode });
            document.getElementById('waiting').innerHTML = `
                <div class="wait-emoji">😕</div>
                <div class="wait-msg">${esc(response.error)}</div>
                <a href="/" class="btn" style="max-width:200px;margin-top:20px;display:inline-block;">Back</a>
            `;
        } else {
            trackEvent('player_joined', { room_code: roomCode });
        }
    });
}

if (socket.connected) {
    joinRoom();
} else {
    socket.on('connect', function onFirstConnect() {
        socket.off('connect', onFirstConnect);
        joinRoom();
    });
}

function showScreen(id) {
    document.querySelectorAll('.p-screen').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'flex';
}

function formatYear(y) {
    return y < 0 ? `${Math.abs(y)} BCE` : `${y}`;
}

// --- GAME STARTED ---
socket.on('game_started', ({ mode }) => {
    currentMode = mode;
    showScreen('wait-screen');
    document.getElementById('wait-msg').textContent = 'Game starting...';
    // Warn before leaving mid-game
    window.addEventListener('beforeunload', (e) => { e.preventDefault(); });
});

// --- YOUR TURN ---
socket.on('your_turn', ({ card, timeline, mode, timeLimit }) => {
    function doTurn() {
        submitLock = false;
        timerMax = timeLimit;
        currentMode = mode;
        if (mode === 'timeline') {
            showScreen('turn-timeline');
            renderPlayerCard('tl-card', card);
            renderPlayerTimeline(timeline);
        } else {
            showScreen('turn-quiz');
            renderPlayerCard('quiz-card', card);
            resetQuizInput();
        }
    }
    if (resultLock) {
        setTimeout(doTurn, 4000);
    } else {
        doTurn();
    }
});

// --- WAIT ---
socket.on('wait', ({ activePlayerName, scores }) => {
    function doWait() {
        showScreen('wait-screen');
        document.getElementById('wait-msg').textContent = `${activePlayerName} is playing...`;
        renderWaitScores(scores);
    }
    if (resultLock) {
        setTimeout(doWait, 4000);
    } else {
        doWait();
    }
});

// --- TIMER ---
socket.on('timer_tick', ({ secondsLeft }) => {
    const pct = (secondsLeft / timerMax) * 100;
    document.querySelectorAll('.p-timer-fill').forEach(fill => {
        fill.style.width = pct + '%';
        fill.className = 'p-timer-fill' + (secondsLeft <= 5 ? ' urgent' : '');
    });
});

// --- ROUND RESULT ---
socket.on('round_result', ({ correct, card, playerName: pName, reveal, scores }) => {
    resultLock = true;
    showScreen('result-screen');
    if (reveal && card) {
        document.getElementById('result-icon').textContent = correct ? '✅' : '❌';
        document.getElementById('result-text').innerHTML = `${card.emoji} ${card.name}<br>${formatYear(card.year)}`;
    } else if (pName) {
        document.getElementById('result-icon').textContent = '❌';
        document.getElementById('result-text').textContent = `${pName} got it wrong...`;
    }
    // Hold result screen for 2.5s before allowing other screens
    setTimeout(() => { resultLock = false; }, 4000);
});

// --- STEAL TURN (you can steal) ---
socket.on('steal_turn', ({ card, timeline, mode, timeLimit }) => {
    submitLock = false;
    timerMax = timeLimit;
    showScreen('steal-screen');
    renderPlayerCard('steal-card', card);

    const inputArea = document.getElementById('steal-input-area');
    if (mode === 'timeline') {
        inputArea.innerHTML = '<div class="p-instruction">Tap where it belongs!</div><div class="p-timeline" id="steal-timeline"></div>';
        renderStealTimeline(timeline, card);
    } else {
        inputArea.innerHTML = `
            <div class="p-input-wrap">
                <input type="text" class="p-input" id="steal-quiz-input" placeholder="Type country name..." autocomplete="off">
                <div class="p-autocomplete" id="steal-autocomplete"></div>
            </div>`;
        setupAutocomplete('steal-quiz-input', 'steal-autocomplete', true);
    }
});

// --- STEAL WAIT (someone else is stealing) ---
socket.on('steal_wait', ({ stealerName }) => {
    showScreen('steal-wait-screen');
    document.getElementById('steal-wait-msg').textContent = `${stealerName} is trying to steal...`;
});

socket.on('steal_result', ({ correct, stealerName, scores }) => {
    // Just stay on current screen, host handles display
});

// --- GAME OVER ---
socket.on('game_over', ({ scores, winner }) => {
    window.onbeforeunload = null; // Allow leaving after game ends
    showScreen('end-screen');
    const myScore = scores.find(s => s.name === playerName);
    const myRank = myScore ? scores.indexOf(myScore) + 1 : scores.length;
    const medals = ['🥇', '🥈', '🥉'];
    const isWinner = winner && winner.name === playerName;

    let html = '';
    if (isWinner) {
        html += `<div class="end-rank">🏆</div>`;
        html += `<div style="font-size:1.6rem;font-weight:700;color:#ffd43b;margin-bottom:8px;">YOU WON!</div>`;
    } else {
        html += `<div class="end-rank">${medals[myRank - 1] || '#' + myRank}</div>`;
    }
    html += `<div style="font-size:1.2rem;margin-bottom:4px;">${esc(playerName)}</div>`;
    html += `<div class="end-score">${myScore ? myScore.score : 0} points</div>`;

    // Leaderboard
    html += `<div style="margin-top:20px;width:100%;max-width:280px;">`;
    scores.forEach((s, i) => {
        const me = s.name === playerName;
        html += `<div style="display:flex;justify-content:space-between;padding:6px 12px;border-radius:10px;margin:4px 0;background:${me ? 'rgba(255,212,59,0.15)' : 'rgba(255,255,255,0.05)'};font-weight:${me ? '700' : '400'};">
            <span>${medals[i] || '#' + (i + 1)} ${esc(s.name)}</span>
            <span style="color:#ffd43b;">${s.score}</span>
        </div>`;
    });
    html += `</div>`;

    document.getElementById('end-screen').innerHTML = `
        <h1 class="p-logo">GAME OVER</h1>
        ${html}
    `;

    spawnConfetti();
});

function spawnConfetti() {
    const emojis = ['🎉', '🎊', '⭐', '🏆', '✨', '🎈', '🇺🇸', '🇫🇷', '🇧🇷', '🇩🇪', '🇯🇵'];
    for (let i = 0; i < 25; i++) {
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

socket.on('back_to_lobby', () => {
    window.onbeforeunload = null;
    showScreen('waiting');
});

socket.on('host_left', () => {
    showScreen('host-left');
});

// Detect disconnect faster
socket.on('disconnect', () => {
    // If we lose connection, show a reconnecting state
    document.getElementById('wait-msg').textContent = 'Reconnecting…';
});

socket.on('connect', () => {
    // Only rejoin on REconnect (not initial connect)
    if (hasJoined && roomCode && playerName) {
        socket.emit('join_room', { code: roomCode, name: playerName }, (response) => {
            if (response.error && response.error !== 'Game already started') {
                showScreen('host-left');
            }
        });
    }
});

// --- RENDER HELPERS ---
function renderPlayerCard(containerId, card) {
    const el = document.getElementById(containerId);
    if (card.type === 'flag' && currentMode === 'timeline') {
        el.innerHTML = `<div class="card-emoji">${card.emoji}</div><div class="card-desc">When was this country founded?</div>`;
    } else if (card.type === 'flag') {
        el.innerHTML = `<div class="card-emoji">${card.emoji}</div>`;
    } else {
        const label = card.type === 'landmark' ? 'Landmark' : 'History';
        el.innerHTML = `
            <div class="card-category">${label}</div>
            <div class="card-emoji">${card.emoji}</div>
            <div class="card-title">${card.name}</div>
            <div class="card-desc">${card.desc || ''}</div>`;
    }
}

function renderPlayerTimeline(timeline) {
    const el = document.getElementById('tl-timeline');
    el.innerHTML = '';
    const sorted = [...timeline].sort((a, b) => a.year - b.year);

    // Direction label at top
    el.innerHTML = '<div class="tl-direction-label">Earlier</div>';

    for (let i = 0; i <= sorted.length; i++) {
        // Build button label with context
        let label;
        if (sorted.length === 0) {
            label = 'Tap to place here';
        } else if (i === 0) {
            label = `Before ${formatYear(sorted[0].year)}`;
        } else if (i === sorted.length) {
            label = `After ${formatYear(sorted[sorted.length - 1].year)}`;
        } else {
            label = `Between ${formatYear(sorted[i - 1].year)} and ${formatYear(sorted[i].year)}`;
        }

        const drop = document.createElement('div');
        drop.className = 'tl-slot';
        const dropBtn = document.createElement('div');
        dropBtn.className = 'tl-drop';
        dropBtn.textContent = label;
        dropBtn.addEventListener('click', () => {
            if (submitLock) return;
            submitLock = true;
            socket.emit('place_card', { slotIndex: i });
            showScreen('wait-screen');
            document.getElementById('wait-msg').textContent = 'Placing…';
        });
        drop.appendChild(dropBtn);
        el.appendChild(drop);

        if (i < sorted.length) {
            const card = sorted[i];
            const cardEl = document.createElement('div');
            cardEl.className = 'tl-slot';
            cardEl.innerHTML = `
                <div class="tl-card">
                    <div class="tl-emoji">${card.emoji}</div>
                    <div class="tl-info">
                        <div class="tl-name">${card.name}</div>
                        <div class="tl-year">${formatYear(card.year)}</div>
                    </div>
                </div>`;
            el.appendChild(cardEl);
        }
    }

    // Direction label at bottom
    const laterLabel = document.createElement('div');
    laterLabel.className = 'tl-direction-label';
    laterLabel.textContent = 'Later';
    el.appendChild(laterLabel);
}

function renderStealTimeline(timeline, card) {
    const el = document.getElementById('steal-timeline');
    if (!el) return;
    el.innerHTML = '<div class="tl-direction-label">Earlier</div>';
    el.className = 'p-timeline';
    const sorted = [...timeline].sort((a, b) => a.year - b.year);

    for (let i = 0; i <= sorted.length; i++) {
        let label;
        if (sorted.length === 0) { label = 'Tap to place here'; }
        else if (i === 0) { label = `Before ${formatYear(sorted[0].year)}`; }
        else if (i === sorted.length) { label = `After ${formatYear(sorted[sorted.length - 1].year)}`; }
        else { label = `Between ${formatYear(sorted[i - 1].year)} and ${formatYear(sorted[i].year)}`; }

        const drop = document.createElement('div');
        drop.className = 'tl-slot';
        const dropBtn = document.createElement('div');
        dropBtn.className = 'tl-drop';
        dropBtn.textContent = label;
        dropBtn.addEventListener('click', () => {
            if (submitLock) return;
            submitLock = true;
            socket.emit('place_card', { slotIndex: i });
            showScreen('wait-screen');
            document.getElementById('wait-msg').textContent = 'Stealing…';
        });
        drop.appendChild(dropBtn);
        el.appendChild(drop);

        if (i < sorted.length) {
            const c = sorted[i];
            const cardEl = document.createElement('div');
            cardEl.className = 'tl-slot';
            cardEl.innerHTML = `
                <div class="tl-card">
                    <div class="tl-emoji">${c.emoji}</div>
                    <div class="tl-info">
                        <div class="tl-name">${c.name}</div>
                        <div class="tl-year">${formatYear(c.year)}</div>
                    </div>
                </div>`;
            el.appendChild(cardEl);
        }
    }
}

function passSteal() {
    trackEvent('steal_passed', { room_code: roomCode, game_mode: currentMode });
    socket.emit('pass_steal');
    showScreen('wait-screen');
    document.getElementById('wait-msg').textContent = 'Passed...';
}

function renderWaitScores(scores) {
    if (!scores) return;
    const el = document.getElementById('wait-scores');
    el.innerHTML = scores.map(s => `${s.emoji} ${esc(s.name)}: ${s.score}`).join(' &nbsp; ');
}

// --- QUIZ AUTOCOMPLETE ---
function resetQuizInput() {
    const input = document.getElementById('quiz-input');
    input.value = '';
    input.focus();
    document.getElementById('quiz-autocomplete').style.display = 'none';
    setupAutocomplete('quiz-input', 'quiz-autocomplete', false);
}

function setupAutocomplete(inputId, listId, isSteal) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;

    // Remove old listeners by cloning
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', () => {
        const val = newInput.value.trim().toLowerCase();
        list.innerHTML = '';
        if (!val) { list.style.display = 'none'; return; }

        const matches = allCountryNames.filter(n => n.toLowerCase().includes(val));
        if (matches.length === 0) { list.style.display = 'none'; return; }

        // Sort: prefix matches first, then by length (shorter = better), then contains
        matches.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(val) ? 0 : 1;
            const bStarts = b.toLowerCase().startsWith(val) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            if (aStarts === 0) return a.length - b.length; // shorter prefix match first
            return a.localeCompare(b);
        });

        list.style.display = 'block';
        matches.slice(0, 8).forEach(name => {
            const item = document.createElement('div');
            item.className = 'ac-item';
            const idx = name.toLowerCase().indexOf(val);
            item.innerHTML = name.substring(0, idx) +
                '<span class="match">' + name.substring(idx, idx + val.length) + '</span>' +
                name.substring(idx + val.length);
            item.addEventListener('click', () => {
                if (submitLock) return;
                submitLock = true;
                newInput.value = name;
                list.style.display = 'none';
                if (isSteal) {
                    socket.emit('submit_answer', { answer: name });
                    showScreen('wait-screen');
                    document.getElementById('wait-msg').textContent = 'Stealing…';
                } else {
                    socket.emit('submit_answer', { answer: name });
                    showScreen('wait-screen');
                    document.getElementById('wait-msg').textContent = 'Submitted!';
                }
            });
            list.appendChild(item);
        });
    });

    newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const items = list.querySelectorAll('.ac-item');
            if (items.length === 1) {
                items[0].click();
            }
        }
    });

    newInput.focus();
}
