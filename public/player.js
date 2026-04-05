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
        setTimeout(() => { mapInstance.invalidateSize(); alignCrosshair(); }, 200);
    }
}

function formatYear(y) {
    return y < 0 ? `${Math.abs(y)} BCE` : `${y}`;
}

// --- GAME STARTED ---
socket.on('game_started', ({ mode }) => {
    currentMode = mode;
    mapHistory = [];
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
    // Update seconds counter for map mode
    const timerNum = document.getElementById('map-timer-number');
    if (timerNum && currentMode === 'map') {
        timerNum.textContent = secondsLeft;
        timerNum.className = 'map-timer-number' + (secondsLeft <= 10 ? ' big' : '') + (secondsLeft <= 5 ? ' urgent' : '');
        if (secondsLeft <= 5 && secondsLeft > 0 && !mapLocked) { haptic([50, 30, 50]); playTick(); }
    }
    // Auto-submit map guess at 1 second if not locked
    if (secondsLeft <= 1 && currentMode === 'map' && !mapLocked && mapInstance) {
        mapLockIn();
    }
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

    // Post-game world map summary (map mode only)
    let summaryMapHtml = '';
    if (currentMode === 'map' && mapHistory.length > 0) {
        summaryMapHtml = `<div id="summary-map" style="width:100%;max-width:340px;height:200px;border-radius:14px;overflow:hidden;margin-top:16px;"></div>`;
    }

    document.getElementById('end-screen').innerHTML = `
        <h1 class="p-logo">GAME OVER</h1>
        ${html}
        ${summaryMapHtml}
    `;

    // Build summary map
    if (currentMode === 'map' && mapHistory.length > 0) {
        setTimeout(() => {
            const sMap = L.map('summary-map', {
                zoomControl: false, attributionControl: false,
            });
            L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {}).addTo(sMap);
            const bounds = [];
            mapHistory.forEach(h => {
                const score = h.me.roundScore;
                const color = score >= 800 ? '#51cf66' : score >= 400 ? '#ffd43b' : '#ff6b6b';
                const icon = L.divIcon({
                    html: `<div style="width:12px;height:12px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
                    iconSize: [12, 12], iconAnchor: [6, 6], className: ''
                });
                L.marker([h.card.lat, h.card.lng], { icon }).addTo(sMap);
                bounds.push([h.card.lat, h.card.lng]);
            });
            if (bounds.length > 0) sMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 6 });
        }, 200);
    }

    spawnConfetti();
    playFanfare();
});

// --- MAP GAME ---
let mapInstance = null;
let mapLocked = false;
let mapHistory = []; // accumulate round data for post-game summary

// Position crosshair + dot at exact pixel center of Leaflet map container
function alignCrosshair() {
    const container = document.getElementById('map-container');
    const crosshair = document.getElementById('map-crosshair');
    const dot = document.getElementById('map-dot');
    if (!container || !crosshair || !dot) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Pin tip at center: SVG is 32x42, tip is at bottom-center
    crosshair.style.left = (cx - 16) + 'px';
    crosshair.style.top = (cy - 42) + 'px';
    // Dot exactly at center
    dot.style.left = (cx - 5) + 'px';
    dot.style.top = (cy - 5) + 'px';
}
window.addEventListener('resize', alignCrosshair);

socket.on('map_round', ({ wiki, emoji, type, round, totalRounds, timeLimit }) => {
    showScreen('map-screen');
    mapLocked = false;
    document.getElementById('map-round-info').textContent = `Round ${round} / ${totalRounds}`;
    document.getElementById('map-lock-btn').disabled = false;
    document.getElementById('map-lock-btn').textContent = 'LOCK IN';
    document.getElementById('map-crosshair').style.display = 'block';
    document.getElementById('map-dot').style.display = 'block';
    document.getElementById('map-timer-fill').style.width = '100%';
    document.getElementById('map-timer-fill').classList.remove('urgent');

    // Vary prompt by type
    const promptKey = type === 'landmark' ? 'where_landmark' : type === 'city' ? 'where_city' : type === 'nature' ? 'where_nature' : 'where_is_this';
    const promptEl = document.getElementById('map-prompt');
    if (promptEl) promptEl.textContent = t(promptKey) || t('where_is_this');

    // Load photo with smart fallback
    const photo = document.getElementById('map-photo');
    photo.src = '';
    photo.style.display = 'block';
    const fallback = document.getElementById('map-photo-fallback');
    if (fallback) fallback.style.display = 'none';
    if (wiki) {
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wiki}`)
            .then(r => r.json())
            .then(data => {
                if (data.thumbnail) {
                    photo.src = data.thumbnail.source.replace(/\/\d+px-/, '/500px-');
                } else {
                    showPhotoFallback(emoji, type);
                }
            }).catch(() => showPhotoFallback(emoji, type));
    } else {
        showPhotoFallback(emoji, type);
    }

    // Hide lock overlay and reset counter
    document.getElementById('map-lock-overlay').style.display = 'none';
    document.getElementById('map-lock-counter').textContent = '';

    // Init map if not yet
    if (!mapInstance) {
        mapInstance = L.map('map-container', {
            center: [25, 10], zoom: 3, minZoom: 2, maxZoom: 18,
            zoomControl: false, attributionControl: false,
        });
        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {}).addTo(mapInstance);
    } else {
        mapInstance.setView([25, 10], 3);
        // Remove old markers
        mapInstance.eachLayer(l => { if (l instanceof L.Marker || l instanceof L.Polyline) mapInstance.removeLayer(l); });
        // Re-enable controls after lock-in disabled them
        mapInstance.dragging.enable();
        mapInstance.touchZoom.enable();
        mapInstance.scrollWheelZoom.enable();
    }

    setTimeout(() => { mapInstance.invalidateSize(); alignCrosshair(); }, 100);
    setTimeout(alignCrosshair, 300); // extra alignment after layout settles

    // Show onboarding hint for first-time players
    showOnboardingIfNeeded();
});

let playerResultMap = null;

socket.on('map_result', ({ card, results, scores }) => {
    mapLocked = true;
    document.getElementById('map-crosshair').style.display = 'none';
    document.getElementById('map-dot').style.display = 'none';
    document.getElementById('map-lock-overlay').style.display = 'none';

    const me = results.find(r => r.name === playerName) || results[0];
    let emoji = me.distPoints >= 900 ? '🎯' : me.distPoints >= 600 ? '🔥' : me.distPoints >= 300 ? '👍' : '😅';

    const cName = (typeof isRTL === 'function' && isRTL() && card.name_he) ? card.name_he : card.name;

    // Find player position in standings
    const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);
    const myRank = sorted.findIndex(r => r.name === playerName) + 1;
    const medals = ['🥇', '🥈', '🥉'];
    const posText = myRank > 0 ? (medals[myRank - 1] || '#' + myRank) : '';

    document.getElementById('map-result-card').innerHTML = `
        <div id="map-result-map" style="height:200px;border-radius:14px;overflow:hidden;margin-bottom:12px;"></div>
        <div style="font-size:3rem;">${emoji}</div>
        <div style="font-size:1.2rem;font-weight:700;color:#ffd43b;">${card.emoji} ${esc(cName)}</div>
        <div style="font-size:0.95rem;color:rgba(255,255,255,0.6);margin:4px 0;">${me.dist} km</div>
        <div style="font-size:2.5rem;font-weight:900;color:#ffd43b;text-shadow:2px 2px 0 #e8590c;">+${me.roundScore}</div>
        <div style="font-size:0.8rem;color:rgba(255,255,255,0.4);line-height:1.8;">
            ${t('score_distance') || 'Distance'}: +${me.distPoints}
            ${me.speedBonus > 0 ? '<br><span style="color:#51cf66">' + (t('score_speed') || 'Speed') + ': +' + me.speedBonus + '</span>' : ''}
            ${me.countryBonus > 0 ? '<br><span style="color:#51cf66">' + (t('score_nearby') || 'Nearby') + ': +' + me.countryBonus + '</span>' : ''}
        </div>
        <div style="margin-top:10px;font-size:0.9rem;color:rgba(255,255,255,0.5);">Total: ${me.totalScore} ${posText}</div>
    `;
    // Save to history for post-game summary
    mapHistory.push({ card, me, results });

    // Player comparison — show other players' scores
    const othersHtml = results
        .filter(r => r.name !== playerName)
        .sort((a, b) => b.roundScore - a.roundScore)
        .map(r => `<span style="margin:0 6px;">${r.emoji} +${r.roundScore}</span>`)
        .join('');
    if (othersHtml) {
        document.getElementById('map-result-card').innerHTML += `
            <div style="margin-top:8px;font-size:0.75rem;color:rgba(255,255,255,0.35);border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
                ${othersHtml}
            </div>`;
    }

    showScreen('map-result-screen');
    if (me.distPoints >= 600) playResultGood(); else playResultBad();

    // Build result map with guess vs answer
    if (playerResultMap) { playerResultMap.remove(); playerResultMap = null; }
    setTimeout(() => {
        playerResultMap = L.map('map-result-map', {
            zoomControl: false, attributionControl: false,
            dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false,
        });
        L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {}).addTo(playerResultMap);

        // Correct answer marker (green)
        const correctIcon = L.divIcon({ html: '<div style="font-size:1.6rem;text-align:center;">✅</div>', iconSize: [26, 26], iconAnchor: [13, 26], className: '' });
        L.marker([card.lat, card.lng], { icon: correctIcon }).addTo(playerResultMap);

        // Player guess marker (red)
        if (me.guessLat != null) {
            const guessIcon = L.divIcon({ html: '<div style="font-size:1.6rem;text-align:center;">📍</div>', iconSize: [26, 26], iconAnchor: [13, 26], className: '' });
            L.marker([me.guessLat, me.guessLng], { icon: guessIcon }).addTo(playerResultMap);

            // Dashed line between guess and answer
            L.polyline([[me.guessLat, me.guessLng], [card.lat, card.lng]], {
                color: '#ff6b6b', weight: 2, dashArray: '8,6', opacity: 0.8
            }).addTo(playerResultMap);

            // Distance label at midpoint
            const midLat = (me.guessLat + card.lat) / 2;
            const midLng = (me.guessLng + card.lng) / 2;
            const distLabel = L.divIcon({
                html: `<div style="background:rgba(27,20,100,0.85);color:#ffd43b;padding:2px 8px;border-radius:8px;font-size:0.75rem;font-weight:700;white-space:nowrap;font-family:Fredoka,sans-serif;">${me.dist} km</div>`,
                iconSize: [80, 20], iconAnchor: [40, 10], className: ''
            });
            L.marker([midLat, midLng], { icon: distLabel }).addTo(playerResultMap);

            // Fit both points
            playerResultMap.fitBounds([[me.guessLat, me.guessLng], [card.lat, card.lng]], { padding: [30, 30], maxZoom: 8 });
        } else {
            playerResultMap.setView([card.lat, card.lng], 4);
        }
    }, 150);
});

function mapLockIn() {
    if (mapLocked || !mapInstance) return;
    mapLocked = true;
    const center = mapInstance.getCenter();
    socket.emit('map_guess', { lat: center.lat, lng: center.lng });
    haptic(50);
    playLockIn();
    document.getElementById('map-lock-btn').disabled = true;
    document.getElementById('map-lock-btn').textContent = '✓ LOCKED';
    document.getElementById('map-crosshair').style.display = 'none';
    document.getElementById('map-dot').style.display = 'none';

    // Show marker at guess location
    const guessIcon = L.divIcon({
        html: '<div style="font-size:1.8rem;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">📍</div>',
        iconSize: [30, 30], iconAnchor: [15, 30], className: ''
    });
    L.marker([center.lat, center.lng], { icon: guessIcon }).addTo(mapInstance);
    mapInstance.dragging.disable();
    mapInstance.touchZoom.disable();
    mapInstance.scrollWheelZoom.disable();

    // Show waiting overlay
    document.getElementById('map-lock-overlay').style.display = 'flex';
}

// Listen for lock-in progress from other players
socket.on('map_player_locked', ({ lockedCount, totalPlayers }) => {
    const counter = document.getElementById('map-lock-counter');
    if (counter) counter.textContent = `${lockedCount}/${totalPlayers} locked in`;
});

// --- PHOTO FALLBACK ---
function showPhotoFallback(emoji, type) {
    document.getElementById('map-photo').style.display = 'none';
    const fb = document.getElementById('map-photo-fallback');
    if (fb) {
        const label = type === 'landmark' ? t('landmark') : type === 'city' ? 'City' : type === 'nature' ? 'Nature' : '?';
        fb.innerHTML = `<div style="font-size:3rem;">${emoji}</div><div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:4px;">${label}</div>`;
        fb.style.display = 'flex';
    }
}

// --- PHOTO EXPAND ---
function togglePhotoExpand() {
    const overlay = document.getElementById('photo-overlay');
    if (overlay.style.display === 'flex') {
        overlay.style.display = 'none';
    } else {
        document.getElementById('photo-overlay-img').src = document.getElementById('map-photo').src;
        overlay.style.display = 'flex';
    }
}

// --- ONBOARDING ---
function showOnboardingIfNeeded() {
    if (!localStorage.getItem('pb_map_onboarded')) {
        document.getElementById('map-onboarding').style.display = 'flex';
    }
}
function dismissOnboarding() {
    document.getElementById('map-onboarding').style.display = 'none';
    localStorage.setItem('pb_map_onboarded', '1');
}

// --- HAPTIC ---
function haptic(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }

// --- SOUND EFFECTS (Web Audio API) ---
let audioCtx = null;
let soundMuted = localStorage.getItem('pb_muted') === '1';

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playTone(freq, duration, type = 'sine', vol = 0.3) {
    if (soundMuted) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = vol;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {}
}

function playLockIn() { playTone(800, 0.1, 'square', 0.2); setTimeout(() => playTone(1200, 0.15, 'square', 0.15), 80); }
function playTick() { playTone(600, 0.05, 'square', 0.1); }
function playResultGood() { playTone(523, 0.15); setTimeout(() => playTone(659, 0.15), 120); setTimeout(() => playTone(784, 0.25), 240); }
function playResultBad() { playTone(400, 0.2, 'sawtooth', 0.15); setTimeout(() => playTone(300, 0.3, 'sawtooth', 0.15), 200); }
function playFanfare() { [523,659,784,1047].forEach((f,i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.2), i * 150)); }

function toggleMute() {
    soundMuted = !soundMuted;
    localStorage.setItem('pb_muted', soundMuted ? '1' : '0');
    const btn = document.getElementById('mute-btn');
    if (btn) btn.textContent = soundMuted ? '🔇' : '🔊';
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
