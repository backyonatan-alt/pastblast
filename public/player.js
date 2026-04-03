const socket = io();

const params = new URLSearchParams(window.location.search);
const roomCode = params.get('code');
const playerName = params.get('name');
let currentMode = '';
let timerMax = 30;
let allCountryNames = [];

// Load country names for autocomplete
fetch('/countries')
    .then(r => r.json())
    .then(names => { allCountryNames = names; })
    .catch(() => {});

// Show player name
document.getElementById('my-name').textContent = playerName;

// Join the room
socket.emit('join_room', { code: roomCode, name: playerName }, (response) => {
    if (response.error) {
        document.getElementById('waiting').innerHTML = `
            <div class="wait-emoji">😕</div>
            <div class="wait-msg">${response.error}</div>
            <a href="/" class="btn" style="max-width:200px;margin-top:20px;display:inline-block;">Back</a>
        `;
    }
});

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
});

// --- YOUR TURN ---
socket.on('your_turn', ({ card, timeline, mode, timeLimit }) => {
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
});

// --- WAIT ---
socket.on('wait', ({ activePlayerName, scores }) => {
    showScreen('wait-screen');
    document.getElementById('wait-msg').textContent = `${activePlayerName} is playing...`;
    renderWaitScores(scores);
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
socket.on('round_result', ({ correct, card, playerName, reveal, scores }) => {
    if (reveal && card) {
        showScreen('result-screen');
        document.getElementById('result-icon').textContent = correct ? '✅' : '❌';
        document.getElementById('result-text').innerHTML = `${card.emoji} ${card.name}<br>${formatYear(card.year)}`;
    }
});

// --- STEAL TURN (you can steal) ---
socket.on('steal_turn', ({ card, timeline, mode, timeLimit }) => {
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
    showScreen('end-screen');
    const myScore = scores.find(s => s.name === playerName);
    const myRank = scores.indexOf(myScore) + 1;
    const medals = ['🥇', '🥈', '🥉'];
    document.getElementById('end-rank').textContent = medals[myRank - 1] || `#${myRank}`;
    document.getElementById('end-score').textContent = myScore ? `${myScore.score} points` : '';
});

socket.on('back_to_lobby', () => {
    showScreen('waiting');
});

socket.on('host_left', () => {
    showScreen('host-left');
});

// --- RENDER HELPERS ---
function renderPlayerCard(containerId, card) {
    const el = document.getElementById(containerId);
    if (card.type === 'flag' && currentMode === 'timeline') {
        el.innerHTML = `<div class="card-category">Flag</div><div class="card-emoji">${card.emoji}</div>`;
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

    for (let i = 0; i <= sorted.length; i++) {
        // Drop zone
        const drop = document.createElement('div');
        drop.className = 'tl-slot';
        const dropBtn = document.createElement('div');
        dropBtn.className = 'tl-drop';
        dropBtn.textContent = i === 0 ? '👆 Before' : i === sorted.length ? '👇 After' : '👉 Here';
        dropBtn.addEventListener('click', () => {
            socket.emit('place_card', { slotIndex: i });
            showScreen('wait-screen');
            document.getElementById('wait-msg').textContent = 'Placing...';
        });
        drop.appendChild(dropBtn);
        el.appendChild(drop);

        // Card
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
}

function renderStealTimeline(timeline, card) {
    const el = document.getElementById('steal-timeline');
    if (!el) return;
    el.innerHTML = '';
    el.className = 'p-timeline';
    const sorted = [...timeline].sort((a, b) => a.year - b.year);

    for (let i = 0; i <= sorted.length; i++) {
        const drop = document.createElement('div');
        drop.className = 'tl-slot';
        const dropBtn = document.createElement('div');
        dropBtn.className = 'tl-drop';
        dropBtn.textContent = i === 0 ? '👆 Before' : i === sorted.length ? '👇 After' : '👉 Here';
        dropBtn.addEventListener('click', () => {
            socket.emit('place_card', { slotIndex: i });
            showScreen('wait-screen');
            document.getElementById('wait-msg').textContent = 'Stealing...';
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
    socket.emit('pass_steal');
    showScreen('wait-screen');
    document.getElementById('wait-msg').textContent = 'Passed...';
}

function renderWaitScores(scores) {
    if (!scores) return;
    const el = document.getElementById('wait-scores');
    el.innerHTML = scores.map(s => `${s.emoji} ${s.name}: ${s.score}`).join(' &nbsp; ');
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

        list.style.display = 'block';
        matches.slice(0, 8).forEach(name => {
            const item = document.createElement('div');
            item.className = 'ac-item';
            const idx = name.toLowerCase().indexOf(val);
            item.innerHTML = name.substring(0, idx) +
                '<span class="match">' + name.substring(idx, idx + val.length) + '</span>' +
                name.substring(idx + val.length);
            item.addEventListener('click', () => {
                newInput.value = name;
                list.style.display = 'none';
                if (isSteal) {
                    socket.emit('submit_answer', { answer: name });
                    showScreen('wait-screen');
                    document.getElementById('wait-msg').textContent = 'Stealing...';
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
