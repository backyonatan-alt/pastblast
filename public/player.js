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

// Load country names for autocomplete (with Hebrew support)
let countryData = []; // [{name, name_he}]
function loadCountries() {
    const lang = typeof getLang === 'function' ? getLang() : 'en';
    fetch(`/countries?lang=he`)
        .then(r => r.json())
        .then(data => {
            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                countryData = data;
                allCountryNames = data.map(c => c.name).sort();
            } else {
                allCountryNames = data;
            }
        })
        .catch(() => {});
}
loadCountries();

function getCountryDisplayName(englishName) {
    if (typeof isRTL === 'function' && isRTL()) {
        const entry = countryData.find(c => c.name === englishName);
        return entry && entry.name_he ? entry.name_he : englishName;
    }
    return englishName;
}

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
    // Also hide map screen (it's not a .p-screen)
    document.getElementById('map-screen').style.display = 'none';

    const el = document.getElementById(id);
    el.style.display = 'flex';

    if (id === 'map-screen' && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 200);
    }
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
        const yearPart = currentMode === 'timeline' ? `<br>${formatYear(card.year)}` : '';
        document.getElementById('result-text').innerHTML = `${card.emoji} ${cardName(card)}${yearPart}`;
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
        html += `<div style="font-size:1.6rem;font-weight:700;color:#ffd43b;margin-bottom:8px;">${t('you_won')}</div>`;
    } else {
        html += `<div class="end-rank">${medals[myRank - 1] || '#' + myRank}</div>`;
    }
    html += `<div style="font-size:1.2rem;margin-bottom:4px;">${esc(playerName)}</div>`;
    html += `<div class="end-score">${myScore ? myScore.score : 0} ${t('points')}</div>`;

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

// --- MAP GAME ---
let mapInstance = null;
let mapLocked = false;

socket.on('map_round', ({ wiki, emoji, round, totalRounds, timeLimit }) => {
    showScreen('map-screen');
    mapLocked = false;
    document.getElementById('map-round-info').textContent = `Round ${round} / ${totalRounds}`;
    document.getElementById('map-lock-btn').disabled = false;
    document.getElementById('map-lock-btn').textContent = 'LOCK IN';
    document.getElementById('map-crosshair').style.display = 'block';
    document.getElementById('map-dot').style.display = 'block';
    document.getElementById('map-timer-fill').style.width = '100%';
    document.getElementById('map-timer-fill').classList.remove('urgent');

    // Load photo
    const photo = document.getElementById('map-photo');
    photo.src = '';
    if (wiki) {
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wiki}`)
            .then(r => r.json())
            .then(data => {
                if (data.thumbnail) photo.src = data.thumbnail.source.replace(/\/\d+px-/, '/500px-');
            }).catch(() => {});
    }

    // Init map if not yet
    if (!mapInstance) {
        mapInstance = L.map('map-container', {
            center: [25, 10], zoom: 2, minZoom: 2, maxZoom: 18,
            zoomControl: false, attributionControl: false,
        });
        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {}).addTo(mapInstance);
    } else {
        mapInstance.setView([25, 10], 2);
        // Remove old markers
        mapInstance.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline) mapInstance.removeLayer(l); });
    }

    setTimeout(() => mapInstance.invalidateSize(), 100);
});

socket.on('map_result', ({ card, results }) => {
    mapLocked = true;
    document.getElementById('map-crosshair').style.display = 'none';
    document.getElementById('map-dot').style.display = 'none';

    const me = results.find(r => r.name === playerName) || results[0];
    let emoji = me.distPoints >= 900 ? '🎯' : me.distPoints >= 600 ? '🔥' : me.distPoints >= 300 ? '👍' : '😅';

    const cName = (typeof isRTL === 'function' && isRTL() && card.name_he) ? card.name_he : card.name;

    document.getElementById('map-result-card').innerHTML = `
        <div style="font-size:3rem;">${emoji}</div>
        <div style="font-size:1.2rem;font-weight:700;color:#ffd43b;">${card.emoji} ${esc(cName)}</div>
        <div style="font-size:0.95rem;color:rgba(255,255,255,0.6);margin:4px 0;">${me.dist} km</div>
        <div style="font-size:2.5rem;font-weight:900;color:#ffd43b;text-shadow:2px 2px 0 #e8590c;">+${me.roundScore}</div>
        <div style="font-size:0.8rem;color:rgba(255,255,255,0.4);line-height:1.8;">
            Distance: +${me.distPoints}
            ${me.speedBonus > 0 ? '<br><span style="color:#51cf66">Speed: +' + me.speedBonus + '</span>' : ''}
            ${me.countryBonus > 0 ? '<br><span style="color:#51cf66">Country: +' + me.countryBonus + '</span>' : ''}
        </div>
        <div style="margin-top:10px;font-size:0.9rem;color:rgba(255,255,255,0.5);">Total: ${me.totalScore}</div>
    `;
    showScreen('map-result-screen');
});

function mapLockIn() {
    if (mapLocked || !mapInstance) return;
    mapLocked = true;
    const center = mapInstance.getCenter();
    socket.emit('map_guess', { lat: center.lat, lng: center.lng });
    document.getElementById('map-lock-btn').disabled = true;
    document.getElementById('map-lock-btn').textContent = '✓ LOCKED';
    document.getElementById('map-crosshair').style.display = 'none';
    document.getElementById('map-dot').style.display = 'none';
}

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
function cardName(card) {
    return (typeof isRTL === 'function' && isRTL() && card.name_he) ? card.name_he : card.name;
}
function cardDesc(card) {
    return (typeof isRTL === 'function' && isRTL() && card.desc_he) ? card.desc_he : (card.desc || '');
}

function renderPlayerCard(containerId, card) {
    const el = document.getElementById(containerId);
    if (card.type === 'flag' && currentMode === 'timeline') {
        el.innerHTML = `<div class="card-emoji">${card.emoji}</div><div class="card-desc">${t('when_founded')}</div>`;
    } else if (card.type === 'flag') {
        el.innerHTML = `<div class="card-emoji">${card.emoji}</div>`;
    } else {
        const label = card.type === 'landmark' ? t('landmark') : t('history');
        el.innerHTML = `
            <div class="card-category">${label}</div>
            <div class="card-emoji">${card.emoji}</div>
            <div class="card-title">${cardName(card)}</div>
            <div class="card-desc">${cardDesc(card)}</div>`;
    }
}

function renderPlayerTimeline(timeline) {
    const el = document.getElementById('tl-timeline');
    el.innerHTML = '';
    const sorted = [...timeline].sort((a, b) => a.year - b.year);

    // Direction label at top
    el.innerHTML = `<div class="tl-direction-label">${t('earlier')}</div>`;

    for (let i = 0; i <= sorted.length; i++) {
        const drop = document.createElement('div');
        drop.className = 'tl-slot';
        const dropBtn = document.createElement('div');
        dropBtn.className = 'tl-drop';
        dropBtn.textContent = t('place_here');
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
                        <div class="tl-name">${cardName(card)}</div>
                        <div class="tl-year">${formatYear(card.year)}</div>
                    </div>
                </div>`;
            el.appendChild(cardEl);
        }
    }

    // Direction label at bottom
    const laterLabel = document.createElement('div');
    laterLabel.className = 'tl-direction-label';
    laterLabel.textContent = t('later');
    el.appendChild(laterLabel);
}

function renderStealTimeline(timeline, card) {
    const el = document.getElementById('steal-timeline');
    if (!el) return;
    el.innerHTML = `<div class="tl-direction-label">${t('earlier')}</div>`;
    el.className = 'p-timeline';
    const sorted = [...timeline].sort((a, b) => a.year - b.year);

    for (let i = 0; i <= sorted.length; i++) {
        const drop = document.createElement('div');
        drop.className = 'tl-slot';
        const dropBtn = document.createElement('div');
        dropBtn.className = 'tl-drop';
        dropBtn.textContent = t('place_here');
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
                        <div class="tl-name">${cardName(c)}</div>
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

        // Search both English and Hebrew names
        let matches;
        if (countryData.length > 0) {
            matches = countryData.filter(c =>
                c.name.toLowerCase().includes(val) ||
                (c.name_he && c.name_he.includes(val))
            ).map(c => c.name);
        } else {
            matches = allCountryNames.filter(n => n.toLowerCase().includes(val));
        }
        if (matches.length === 0) { list.style.display = 'none'; return; }

        // Sort: prefix matches first, then by length
        matches.sort((a, b) => {
            const aStarts = a.toLowerCase().startsWith(val) ? 0 : 1;
            const bStarts = b.toLowerCase().startsWith(val) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            if (aStarts === 0) return a.length - b.length;
            return a.localeCompare(b);
        });

        list.style.display = 'block';
        matches.slice(0, 8).forEach(name => {
            const displayName = getCountryDisplayName(name);
            const item = document.createElement('div');
            item.className = 'ac-item';
            // Show display name (Hebrew if RTL, English otherwise)
            const searchName = displayName.toLowerCase();
            const idx = searchName.indexOf(val);
            if (idx >= 0) {
                item.innerHTML = esc(displayName.substring(0, idx)) +
                    '<span class="match">' + esc(displayName.substring(idx, idx + val.length)) + '</span>' +
                    esc(displayName.substring(idx + val.length));
            } else {
                item.textContent = displayName;
            }
            item.addEventListener('click', () => {
                if (submitLock) return;
                submitLock = true;
                newInput.value = displayName;
                list.style.display = 'none';
                // Always submit English name to server
                socket.emit('submit_answer', { answer: name });
                showScreen('wait-screen');
                document.getElementById('wait-msg').textContent = isSteal ? t('stealing') : t('submitted');
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
