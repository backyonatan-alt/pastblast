# PastBlast - Full Regression Test Plan
**Version:** 3.0
**Date:** 2026-04-15
**Total test cases:** 556

## Changelog
- v3.0 (2026-04-15): Added Solo Mode section (80 test cases: timeline survival, flag quiz survival, exit button, sticky card, font/flag sizing, language flicker fix, question content fix, game over, share, i18n)
- v2.1 (2026-04-05): Added tiered map scoring system (20 test cases: distance tiers, speed bonus tiers, nearby bonus, emoji tiers, local parity, max score validation)
- v2.0 (2026-04-05): Added crosshair alignment, popup centering, timeline fly animation (multiplayer + local), local Map Game, host-local integration, quiz color unification, /api/map-cards endpoint
- v1.0 (2026-04-05): Initial test plan with 293 test cases

---

## 1. Home Page & Navigation

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| HOME-001 | Hero banner image loads | Open home page. Observe hero-banner.jpg below tagline. | Image loads, max-width 420px, border-radius 16px, no broken image icon. | [ ] |
| HOME-002 | App title & tagline display | Open home page. | Title shows "PASTBLAST" in gold (#ffd43b) with orange text-shadow. Tagline reads "History, flags & landmarks party game". | [ ] |
| HOME-003 | Language switcher - English | Click "English" button. | Page stays LTR. localStorage pb_lang=en. English button has active class. All data-i18n elements show English strings. | [ ] |
| HOME-004 | Language switcher - Hebrew | Click Hebrew button. | Page switches to RTL (dir=rtl). localStorage pb_lang=he. Hebrew button has active class. All data-i18n elements show Hebrew strings. | [ ] |
| HOME-005 | Language persistence on reload | Switch to Hebrew. Reload page. | Hebrew is still selected. RTL layout persists. | [ ] |
| HOME-006 | Game code input - uppercase transform | Type "abcd" in game code field. | Displays as "ABCD". Letter-spacing 8px. Max 4 chars enforced. | [ ] |
| HOME-007 | Game code pre-fill from URL | Navigate to /?code=XYZW. | Code field pre-filled with "XYZW". Name input auto-focused. | [ ] |
| HOME-008 | Enter key on code field focuses name | Type code, press Enter. | Focus moves to name input field. | [ ] |
| HOME-009 | Enter key on name field submits | Type code+name, press Enter on name. | joinGame() is called. Validation runs. | [ ] |
| HOME-010 | Join validation - missing code | Leave code empty, click JOIN GAME. | Error: "Enter a 4-letter code" (or Hebrew equivalent). | [ ] |
| HOME-011 | Join validation - missing name | Enter code, leave name empty, click JOIN. | Error: "Enter your name" (or Hebrew equivalent). | [ ] |
| HOME-012 | Join validation - room not found | Enter invalid code "ZZZZ" + name, click JOIN. | Fetch /check-room/ZZZZ returns exists:false. Error: "Room not found". | [ ] |
| HOME-013 | Join success - redirect to player page | Enter valid code + name, click JOIN. | Redirects to /play?code=CODE&name=NAME. | [ ] |
| HOME-014 | Host button navigation | Click "HOST A NEW GAME". | Navigates to /host. | [ ] |
| HOME-015 | How to play link | Click "How to play?" link. | Navigates to /how-to-play.html. Link styled as muted text. | [ ] |
| HOME-016 | Analytics loaded | Open DevTools Network tab, load home page. | analytics.js loaded. gtag configured with GA_ID. Page view sent. | [ ] |
| HOME-017 | i18n.js loaded and initialized | Open DevTools console, load home page. | i18n.js loads. initI18n() runs. Language file fetched (/lang/en.json or /lang/he.json). | [ ] |

## 2. Host Lobby

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| HOST-001 | Room creation on connect | Open /host page. | Socket connects. create_room emitted. Room code (4 uppercase letters, no O/I) displayed in .code-display. | [ ] |
| HOST-002 | Join URL display | Observe join info after room created. | Shows server URL (or window.location.origin). Correct format displayed. | [ ] |
| HOST-003 | QR code generation | Observe QR code area. | QR image loads from api.qrserver.com with join URL embedded. 180x180px, border-radius 12px. | [ ] |
| HOST-004 | Player join - chip appears | Have a player join the room. | Player chip appears in players-list with color, emoji, and name. Start button becomes enabled. | [ ] |
| HOST-005 | Multiple players join | Have 3 players join. | Three player chips shown. Each has unique color and emoji from the palette. | [ ] |
| HOST-006 | Max players limit | Try to add 9th player (max=8). | Server returns error. 9th player cannot join. | [ ] |
| HOST-007 | Player disconnect - chip grayed | Player disconnects (close tab). | Player chip gets "disconnected" class. Player remains in list. | [ ] |
| HOST-008 | Player reconnect | Disconnected player rejoins with same name. | Player chip returns to connected state. Same color/emoji preserved. | [ ] |
| HOST-009 | Duplicate name blocked | Connected player tries to join with existing name. | Server returns NAME_TAKEN error. | [ ] |
| HOST-010 | Game mode selection - Timeline | Click Timeline mode card. | Timeline card gets "active" class. Other cards lose it. selectedMode="timeline". | [ ] |
| HOST-011 | Game mode selection - Flag Quiz | Click Flag Quiz mode card. | Quiz card gets "active" class. selectedMode="quiz". | [ ] |
| HOST-012 | Game mode selection - Map Game | Click Map Game mode card. | Map card gets "active" class. selectedMode="map". | [ ] |
| HOST-013 | Mode card images load | Observe all 3 mode cards. | mode-timeline.jpg, mode-flags.jpg, mode-map.jpg all load correctly. | [ ] |
| HOST-014 | Difficulty selection | Click Easy, then Medium, then Hard. | Corresponding button gets "active" class. Only one active at a time. Default: Medium. | [ ] |
| HOST-015 | Length selection | Click Short, Medium, Long. | Corresponding button gets "active" class. Only one active at a time. Default: Medium. | [ ] |
| HOST-016 | Start button disabled when no players | Load host page before anyone joins. | Start button is disabled (disabled attribute). | [ ] |
| HOST-017 | Start button enabled with players | Have a player join. | Start button becomes enabled. | [ ] |
| HOST-018 | Start game emits correct data | Click START GAME. | socket.emit(start_game, {mode, difficulty, length}) sent. Analytics event game_started_by_host tracked. | [ ] |
| HOST-019 | Local play link | Click "PLAY LOCALLY (no phones)". | Navigates to /local.html. | [ ] |
| HOST-020 | Lobby i18n - Hebrew | Switch to Hebrew before hosting. | All lobby labels (Difficulty, Game Length, Start Game, mode names) show Hebrew translations. | [ ] |

## 3. Timeline Mode (Host + Player)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TL-001 | Game starts - screens switch | Host starts Timeline game. | Host: lobby hides, game-screen shows. Players: waiting screen then first player gets your_turn. | [ ] |
| TL-002 | Host card display - landmark type | New round with landmark card. | Host shows: category label "Landmark", emoji, card name (localized), description. | [ ] |
| TL-003 | Host card display - history type | New round with history card. | Host shows: category label "History", emoji, card name, description. | [ ] |
| TL-004 | Host card display - flag in timeline | New round with flag card. | Host shows: emoji only + "When was this country founded?" No name revealed (prevent cheating). | [ ] |
| TL-005 | Host turn label display | New round starts. | Turn label shows "[emoji] [name]'s turn". In Hebrew: RTL order with turn_suffix prefix. | [ ] |
| TL-006 | Host round label - cards left | Observe round label. | Shows "[N] cards left" with correct count from deckLeft. | [ ] |
| TL-007 | Player timeline - starter card | Game starts. Check first player timeline. | Player has 1 starter card on their timeline. Score starts at 1. | [ ] |
| TL-008 | Player timeline rendering | Active player gets their turn. | Timeline shows: "Earlier" label at top, existing cards sorted by year, "Place here" buttons between each card, "Later" label at bottom. | [ ] |
| TL-009 | Player card placement - correct | Place card in correct chronological position. | Card added to timeline. Score increases by 1. Host shows green checkmark + year reveal. | [ ] |
| TL-010 | Player card placement - wrong | Place card in wrong position. | Card discarded. Score unchanged. Host shows red X + year reveal. Steal begins. | [ ] |
| TL-011 | Timer - 30 second turn | Observe timer during turn. | Timer bar fills from 100% to 0% over 30 seconds. timer_tick events every second. | [ ] |
| TL-012 | Timer - urgent styling at 5s | Wait until 5 seconds remain. | Timer bar turns red (urgent class). Timer number turns red. | [ ] |
| TL-013 | Timer - timeout = wrong answer | Let timer expire without placing. | Treated as wrong answer. Steal begins (if multiplayer). | [ ] |
| TL-014 | Host result reveal - correct | Player places correctly. | Host card area updates: green border, checkmark, "[name] got it right!", emoji, name, year. | [ ] |
| TL-015 | Host result reveal - wrong | Player places incorrectly. | Host shows "[name] got it wrong..." then steal bar appears. | [ ] |
| TL-016 | Host feedback popup | Round result received. | Feedback popup animates (popIn 3s). Shows flag/emoji, name, year. Correct=green, wrong=red. | [ ] |
| TL-017 | Score chart updates | After each round. | Score chart bar heights update proportionally. Active player bar has white border glow. | [ ] |
| TL-018 | Steal - turn order | Player A gets wrong answer (3 players). | Steal offered to Player B, then Player C (round-robin, skip original player). | [ ] |
| TL-019 | Steal - timer 15 seconds | Observe steal timer. | Timer resets to 15 seconds (STEAL_TIME constant). | [ ] |
| TL-020 | Steal - correct steal | Stealer places card correctly. | Card added to stealer timeline. Stealer score+1. Steal queue cleared. Answer revealed. | [ ] |
| TL-021 | Steal - wrong steal = -1 point | Stealer places card incorrectly. | Stealer loses 1 card from timeline (pop). Score decreases. Next stealer gets turn. | [ ] |
| TL-022 | Steal - pass button | Click PASS during steal. | Stealer passes safely. No point change. Next stealer gets turn (or reveal if last). | [ ] |
| TL-023 | Steal - host display | Steal starts. | Host steal bar appears (red). Shows "[emoji] [name] can steal!". Turn label updates. | [ ] |
| TL-024 | Steal - player waiting screen | Non-stealing player during steal. | Shows "[stealerName] is trying to steal..." message. | [ ] |
| TL-025 | Player wait screen - scores | Non-active player during normal turn. | Wait screen shows "[name] is playing..." and current scores. | [ ] |
| TL-026 | Result lock - prevents screen flash | Result received then immediate next event. | resultLock=true for 4 seconds. Next screen change deferred to prevent flash. | [ ] |
| TL-027 | Submit lock - prevents double tap | Tap "Place here" rapidly. | submitLock prevents second emission. Only one place_card event sent. | [ ] |
| TL-028 | Year display - BCE dates | Card with negative year (e.g., -500). | Displays as "500 BCE" on both host and player. | [ ] |
| TL-029 | Game over - winner display | All cards exhausted. | Host: end-screen shows "GAME OVER!", winner banner, scoreboard with medals. Confetti spawns. | [ ] |
| TL-030 | Game over - player view | All cards exhausted. | Player: shows rank (medal or #N), score, full leaderboard with highlighting for self. | [ ] |
| TL-031 | Play again | Host clicks PLAY AGAIN. | play_again emitted. back_to_lobby received. Both host and players return to lobby. Scores reset. | [ ] |
| TL-032 | Card name localization | Switch to Hebrew, play Timeline. | Card names use card.name_he when available. Falls back to card.name. | [ ] |

## 4. Flag Quiz Mode (Host + Player)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| FQ-001 | Game starts in quiz mode | Host selects Flag Quiz, clicks START. | Host and players receive game_started with mode=quiz. All player scores start at 0. | [ ] |
| FQ-002 | Host flag display | New round in quiz mode. | Host shows large flag emoji only (no country name). No year/description shown. | [ ] |
| FQ-003 | Player flag + input display | Active player gets turn. | Flag emoji shown large. Text input with placeholder "Type country name...". Autocomplete dropdown area ready. | [ ] |
| FQ-004 | Autocomplete - English search | Type "uni" in quiz input. | Dropdown shows matching countries (United States, United Kingdom, etc.). Matching text highlighted in gold. | [ ] |
| FQ-005 | Autocomplete - Hebrew search | Switch to Hebrew, type Hebrew text. | Searches both name and name_he fields. Hebrew country names shown when RTL. | [ ] |
| FQ-006 | Autocomplete - selection submits | Tap/click autocomplete item. | Answer submitted immediately via socket. Input disabled. Shows "Submitted!" state. | [ ] |
| FQ-007 | Correct answer - score +1 | Submit correct country name. | Player score increases by 1. Streak incremented. Host shows green result. | [ ] |
| FQ-008 | Wrong answer - score unchanged | Submit wrong country name. | Score unchanged. Streak reset to 0. Steal begins. | [ ] |
| FQ-009 | Timer 30s per flag | Observe timer. | Timer runs 30 seconds. Urgent at 5s. Timeout = wrong answer. | [ ] |
| FQ-010 | Steal mechanic - quiz mode | Player gets wrong answer. | Other players get steal_turn with flag emoji + text input. 15s timer. | [ ] |
| FQ-011 | Steal correct - quiz | Stealer types correct answer. | Stealer score+1. Steal queue cleared. Answer revealed on host. | [ ] |
| FQ-012 | Steal wrong - quiz = -1 | Stealer types wrong answer. | Stealer score decreases by 1 (min 0). Next stealer gets turn. | [ ] |
| FQ-013 | Steal pass - quiz | Click PASS during quiz steal. | Safe pass. No score change. Next stealer or reveal. | [ ] |
| FQ-014 | Host round result - flag quiz | Round ends. | Host shows answer: emoji + country name. No year shown (not timeline mode). | [ ] |
| FQ-015 | Deck uses flag-type cards only | Start quiz mode game. | Deck filtered to type=flag cards only. Shuffled. | [ ] |
| FQ-016 | Round count by length | Set Short/Medium/Long. | Short=10, Medium=20, Long=30 rounds. Deck sliced accordingly. | [ ] |
| FQ-017 | Game over - quiz mode | All rounds complete. | Game over screen shows. Highest score wins. Analytics: game_completed event. | [ ] |
| FQ-018 | Country data loading | Page loads /countries?lang=he endpoint. | Returns array of {name, name_he} objects. Used for autocomplete. | [ ] |
| FQ-019 | Input focus on turn | Player gets their quiz turn. | Input field focused and cleared. Ready for typing. | [ ] |

## 5. Map Game Mode - Existing Features

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| MAP-001 | Photo loading from Wikipedia | Map round starts with wiki field. | Fetches https://en.wikipedia.org/api/rest_v1/page/summary/{wiki}. Uses originalimage.source or thumbnail scaled to 1200px (host) / 500px (player). | [ ] |
| MAP-002 | Host photo display | Map round on host. | Photo shows max-width 700px, height 400px, object-fit contain, border-radius 16px. "Where is this place?" label below. | [ ] |
| MAP-003 | Player map display - Leaflet | Map round on player. | Leaflet map initializes in map-container. Watercolor tiles from Stadia Maps. Center [25,10]. | [ ] |
| MAP-004 | Watercolor tile layer | Observe map tiles. | Tiles load from tiles.stadiamaps.com/tiles/stamen_watercolor. Artistic watercolor style. | [ ] |
| MAP-005 | Map pan/zoom controls | Drag map, pinch zoom. | Map responds to drag and zoom. No zoom control widget (zoomControl:false). No attribution. | [ ] |
| MAP-006 | Lock-in button | Tap LOCK IN button. | Emits map_guess with lat/lng from map.getCenter(). Button disables, text changes to "LOCKED". | [ ] |
| MAP-007 | All-players-simultaneous play | Start map round with 3 players. | All players receive map_round at same time. All can guess independently. No turn order. | [ ] |
| MAP-008 | Timer bar display | Observe timer during map round. | Timer bar fills from 100% to 0%. Updates every second via timer_tick. | [ ] |
| MAP-009 | Auto-submit at 1 second | Let timer reach 1 second without locking in. | mapLockIn() called automatically. Guess submitted with current map center. | [ ] |
| MAP-010 | Host lock-in counter | Players lock in one by one. | Host round-label updates: "X/Y locked in" (e.g. "2/3 locked in"). | [ ] |
| MAP-011 | Host result map - correct location | Map round resolves. | Host result map centered on card lat/lng. Green checkmark marker at correct location. | [ ] |
| MAP-012 | Host result map - player pins | Map result with guesses. | Each player pin: emoji in colored circle (28px). Dashed line to correct location. Colors match player. | [ ] |
| MAP-013 | Host scoreboard on result | Map result displayed. | Right-side scoreboard: sorted by roundScore. Shows emoji, name, roundScore, distance in km. | [ ] |
| MAP-014 | Distance scoring | Player guesses at various distances. | distPoints = max(0, round(1000 * exp(-dist/1500))). Close=high, far=low. Max 1000 points. | [ ] |
| MAP-015 | Speed bonus | Lock in quickly vs slowly. | speedBonus = max(0, round(500 * (1 - timeUsed/timeLimit))). Instant lock=500, last second=~0. | [ ] |
| MAP-016 | Nearby bonus | Guess within 300km. | countryBonus = 200 if dist < 300km, else 0. | [ ] |
| MAP-017 | Map resets between rounds | New map round starts. | Map view resets to [25,10] zoom 3. Old markers/polylines removed. Controls re-enabled. | [ ] |
| MAP-018 | No lat/lng sent to clients | Inspect map_round event data. | wiki, emoji, type, round, totalRounds, timeLimit sent. NO lat/lng (anti-cheat). | [ ] |
| MAP-019 | Map rounds by length | Set Short/Medium/Long for map game. | Short=5, Medium=10, Long=15 rounds (MAP_ROUNDS constant). | [ ] |
| MAP-020 | Game over - map mode | All rounds complete. | game_over event with sorted scores. Winner determined by highest total. | [ ] |

## 6. Map Game Mode - New UX Features

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| MAP-NEW-001 | Crosshair alignment - SVG pin tip | Start map round. Observe crosshair position. | SVG pin (32x42px) tip aligns with exact center of Leaflet container. Uses getBoundingClientRect() for pixel-perfect alignment. | [ ] |
| MAP-NEW-002 | Crosshair - dot at center | Observe red dot under pin. | 6px red dot (#ff6b6b) with white border positioned at exact map center. Matches getCenter() coordinates. | [ ] |
| MAP-NEW-003 | Crosshair alignment on resize | Rotate device / resize window. | window resize event triggers alignCrosshair(). Pin and dot re-centered. | [ ] |
| MAP-NEW-004 | Bigger photo - 160px height | Start map round on player. | Photo element: height 160px (was 120px). max-width 260px. object-fit contain. | [ ] |
| MAP-NEW-005 | Tap-to-expand photo | Tap the photo on player screen. | Full-screen overlay (#photo-overlay) appears. Shows large photo (max-width 90%, max-height 80vh). Dark background (rgba(0,0,0,0.85)). | [ ] |
| MAP-NEW-006 | Dismiss expanded photo | Tap anywhere on expanded overlay. | Overlay hides (display:none). Returns to map view. | [ ] |
| MAP-NEW-007 | Photo fallback - wiki fails | Map round where wiki fetch fails (network error). | Photo hidden. Fallback div shows: large emoji (3rem) + type label (Landmark/City/Nature). Background rgba(0,0,0,0.3). | [ ] |
| MAP-NEW-008 | Photo fallback - no thumbnail | Wiki fetch succeeds but no thumbnail in response. | showPhotoFallback() called. Same emoji+label display. | [ ] |
| MAP-NEW-009 | Photo fallback - no wiki field | Card has no wiki property. | showPhotoFallback() called immediately without fetch attempt. | [ ] |
| MAP-NEW-010 | Varied prompts - landmark | Card type = landmark. | Prompt shows "Where is this landmark?" (where_landmark key). | [ ] |
| MAP-NEW-011 | Varied prompts - city | Card type = city. | Prompt shows "Where is this city?" (where_city key). | [ ] |
| MAP-NEW-012 | Varied prompts - nature | Card type = nature. | Prompt shows "Where is this natural wonder?" (where_nature key). | [ ] |
| MAP-NEW-013 | Varied prompts - fallback | Card type has no specific prompt key. | Falls back to "Where is this place?" (where_is_this key). | [ ] |
| MAP-NEW-014 | Seconds counter display | Observe timer area during map round. | Numerical countdown (#map-timer-number) shows next to timer bar. Updates every second. | [ ] |
| MAP-NEW-015 | Seconds counter - big at 10s | Timer reaches 10 seconds. | Counter gets "big" class: font-size 1.1rem, color #ffd43b (gold). | [ ] |
| MAP-NEW-016 | Seconds counter - pulse at 5s | Timer reaches 5 seconds. | Counter gets "urgent" class: font-size 1.3rem, color #ff6b6b (red), timerPulse animation (scale 1 to 1.15). | [ ] |
| MAP-NEW-017 | Starting zoom level 3 | New map round initializes. | Map starts at zoom level 3 (was 2). Shows more of the world initially. | [ ] |
| MAP-NEW-018 | First-time onboarding overlay | Clear localStorage pb_map_onboarded. Start first map round. | Onboarding overlay appears: dark background, centered card with pin emoji, "Drag the map!" title (gold), instruction text. | [ ] |
| MAP-NEW-019 | Onboarding dismiss on tap | Tap anywhere on onboarding overlay. | Overlay hides. localStorage pb_map_onboarded set to "1". | [ ] |
| MAP-NEW-020 | Onboarding not shown again | Start second map round (same session or new). | Onboarding does NOT appear. pb_map_onboarded="1" in localStorage. | [ ] |
| MAP-NEW-021 | Post-lock-in pin marker | Lock in a guess. | Red pin emoji (1.8rem) marker placed at guess coordinates. Drop shadow filter. | [ ] |
| MAP-NEW-022 | Post-lock-in controls disabled | After locking in. | Map dragging disabled. Touch zoom disabled. Scroll wheel zoom disabled. Cannot move map. | [ ] |
| MAP-NEW-023 | Post-lock-in waiting overlay | After locking in (others still playing). | Overlay appears at bottom: "Waiting for other players..." text + lock counter (X/Y locked in). Dark background with gold border. | [ ] |
| MAP-NEW-024 | Live lock-in counter on player | Other players lock in. | map_player_locked event updates counter text in real-time: "2/3 locked in", "3/3 locked in". | [ ] |
| MAP-NEW-025 | Player result map reveal | Map round resolves. | Leaflet map (200px height) in result card. Shows guess pin + correct checkmark + dashed red line. | [ ] |
| MAP-NEW-026 | Player result - distance label | Observe result map. | Distance label at midpoint between guess and answer: "[N] km" in gold on dark background. Rounded corners. | [ ] |
| MAP-NEW-027 | Player result - score breakdown | Observe result card below map. | Shows: reaction emoji, place name (localized), distance, total round score (+N), breakdown: Distance/Speed/Nearby bonus. | [ ] |
| MAP-NEW-028 | Standings position on result | Observe result card. | Total score + position indicator (medal emoji or #N rank based on sorted results). | [ ] |
| MAP-NEW-029 | Player comparison on result | Observe bottom of result card (multiplayer). | Other players round scores shown: "[emoji] +[score]" for each. Sorted by roundScore descending. | [ ] |
| MAP-NEW-030 | Host staggered pin reveal | Observe host result map after round. | Player pins appear one-by-one with 400ms delay between each. Map fits bounds first, then pins animate in. | [ ] |
| MAP-NEW-031 | Host pulsing lock counter | Players lock in during round. | Lock counter text has animation: pulse 1s infinite (opacity 1 to 0.5 and back). | [ ] |
| MAP-NEW-032 | Sound - lock-in click | Tap LOCK IN (unmuted). | Two-tone click: 800Hz square wave (0.1s) + 1200Hz square wave (0.15s) after 80ms delay. | [ ] |
| MAP-NEW-033 | Sound - timer tick at 5s | Timer reaches 5, 4, 3, 2, 1 seconds (unmuted). | Tick sound: 600Hz square wave (0.05s, vol 0.1) plays each second when <= 5s and not locked. | [ ] |
| MAP-NEW-034 | Sound - result ding (good) | Get good result (distPoints >= 600). | Ascending three-tone: 523Hz, 659Hz, 784Hz (sine waves). Plays playResultGood(). | [ ] |
| MAP-NEW-035 | Sound - result buzz (bad) | Get bad result (distPoints < 600). | Descending two-tone: 400Hz, 300Hz (sawtooth). Plays playResultBad(). | [ ] |
| MAP-NEW-036 | Sound - game over fanfare | Game ends. | Four-tone ascending: 523, 659, 784, 1047 Hz at 150ms intervals. playFanfare() called. | [ ] |
| MAP-NEW-037 | Mute toggle button | Tap speaker icon in map header. | Icon toggles between muted and unmuted. soundMuted boolean flipped. localStorage pb_muted updated. | [ ] |
| MAP-NEW-038 | Mute persistence | Mute, close tab, reopen. | soundMuted loaded from localStorage pb_muted on page load. Muted state persists. | [ ] |
| MAP-NEW-039 | Sounds respect mute | Enable mute, trigger any sound. | playTone() returns early when soundMuted=true. No audio output. | [ ] |
| MAP-NEW-040 | Haptic - lock-in vibration | Lock in on mobile device. | navigator.vibrate(50) called. Short vibration on lock-in. | [ ] |
| MAP-NEW-041 | Haptic - timer 5s vibration | Timer reaches <= 5s (not locked). | navigator.vibrate([50,30,50]) called. Pattern vibration each second. | [ ] |
| MAP-NEW-042 | Haptic - no crash on desktop | Play on desktop (no vibrate API). | haptic() checks navigator.vibrate exists. No error thrown. | [ ] |
| MAP-NEW-043 | i18n score labels - Distance | Play map game in Hebrew. | Score breakdown shows Hebrew "Distance" label (t("score_distance") = "מרחק"). | [ ] |
| MAP-NEW-044 | i18n score labels - Speed | Play map game in Hebrew. | Speed bonus label shows Hebrew (t("score_speed") = "מהירות"). | [ ] |
| MAP-NEW-045 | i18n score labels - Nearby | Play map game in Hebrew. | Nearby bonus label shows Hebrew (t("score_nearby") = "בונוס קרבה"). | [ ] |
| MAP-NEW-046 | Difficulty-adjusted timer - Easy | Start map game on Easy difficulty. | Timer starts at 40 seconds (MAP_TIME[1]=40). | [ ] |
| MAP-NEW-047 | Difficulty-adjusted timer - Medium | Start map game on Medium difficulty. | Timer starts at 30 seconds (MAP_TIME[2]=30). | [ ] |
| MAP-NEW-048 | Difficulty-adjusted timer - Hard | Start map game on Hard difficulty. | Timer starts at 20 seconds (MAP_TIME[3]=20). | [ ] |
| MAP-NEW-049 | Post-game world map summary | Complete map game. Check player end screen. | Summary map (340x200px) shows all locations plotted. Colored dots: green (score>=800), yellow (>=400), red (<400). Fits bounds. | [ ] |
| MAP-NEW-050 | Summary map - no summary for other modes | Complete timeline or quiz game. | No summary map div rendered. mapHistory empty or mode !== map. | [ ] |
| MAP-NEW-051 | Loading skeleton | Start map round. Observe map container before tiles load. | Background: pulsing watercolor gradient (mapSkeleton animation: opacity 0.7 to 1.0 over 2s). Colors: blue/tan. | [ ] |
| MAP-NEW-052 | Crosshair hides on lock-in | Lock in guess. | Both crosshair SVG and dot hidden (display:none). Only guess pin marker visible. | [ ] |
| MAP-NEW-053 | Crosshair hides on result | Round resolves to result. | Crosshair and dot hidden. Lock overlay hidden. Result screen takes over. | [ ] |
| MAP-NEW-054 | Audio context lazy init | First sound trigger. | AudioContext created only on first playTone() call. No autoplay policy violation. | [ ] |
| MAP-NEW-055 | Player result map - no guess | Player did not submit guess (disconnected). | Result map shows only correct location marker. setView at zoom 4 on card location. No line drawn. | [ ] |

## 7. How-to-Play Page

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| HTP-001 | Page loads and renders | Navigate to /how-to-play.html. | Page loads with title "How to Play", subtitle, all sections rendered. | [ ] |
| HTP-002 | Back link | Click "Back to PastBlast" link. | Navigates to / (home page). | [ ] |
| HTP-003 | Timeline mode documented | Read Timeline section. | Card describes: place events chronologically, builds own timeline, correct=+1, wrong=discard. | [ ] |
| HTP-004 | Flag Quiz mode documented | Read Flag Quiz section. | Card describes: identify country by flag, type name, autocomplete, 30s per flag. | [ ] |
| HTP-005 | Map Game mode documented | Read Map Game section. | Card describes: find on map, drag pin, lock in, distance+speed+nearby scoring, result map reveal. | [ ] |
| HTP-006 | Map Game scoring explanation | Read Map Game tip box. | Shows: up to 1000 distance + 500 speed + 200 nearby = max 1700. Timer varies by difficulty (40/30/20s). | [ ] |
| HTP-007 | Game length table - Map rounds | Read game length table. | Table has columns: Length, Timeline/Quiz, Map Game, Best for. Map: 5/10/15 rounds. | [ ] |
| HTP-008 | Difficulty table | Read difficulty table. | Easy: post-1900. Medium: post-1500. Hard: everything including ancient. | [ ] |
| HTP-009 | Stealing section | Read stealing section. | Describes: wrong -> steal -> 15s -> correct=+1, wrong=-1, pass=safe. Ordered list. | [ ] |
| HTP-010 | Local play section | Read local play section. | Describes: click "Play Locally", 1-6 players, same screen. | [ ] |
| HTP-011 | CTA button | Click "Start a Game" button at bottom. | Navigates to / (home page). | [ ] |
| HTP-012 | Analytics loaded | Check network tab on how-to-play.html. | analytics.js script tag present. Page view tracked. | [ ] |

## 8. Local Play Mode

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| LOCAL-001 | Page loads | Navigate to /local.html. | Page renders with PastBlast header, setup form. | [ ] |
| LOCAL-002 | Analytics loaded | Check page source / network tab. | analytics.js is included and loads successfully. | [ ] |
| LOCAL-003 | Player setup (1-6) | Select number of players. | Options for 1-6 players. Player color assignments match server palette. | [ ] |
| LOCAL-004 | Game flow - single device | Start local game, play through rounds. | Turns alternate between players on same screen. Timeline/quiz modes work. | [ ] |
| LOCAL-005 | Score tracking | Play through multiple rounds. | Scores tracked per player. Score chart displays correctly. | [ ] |
| LOCAL-006 | Game completion | Finish all rounds. | Game over screen shows winner and scores. | [ ] |

## 9. Cross-Game Experience Parity

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| PARITY-001 | Timer display - Timeline | Play Timeline round. | Timer bar at top of host (game-header) and player (fixed top). Yellow fill, red at 5s. | [ ] |
| PARITY-002 | Timer display - Flag Quiz | Play Flag Quiz round. | Same timer bar behavior. Same urgent styling at 5s. Same 30s duration. | [ ] |
| PARITY-003 | Timer display - Map Game | Play Map round. | Timer bar in header area + numerical countdown. Difficulty-based duration. Urgent at 5s. | [ ] |
| PARITY-004 | Score display - Timeline | Observe scores during Timeline. | Score chart with colored bars, emojis, names. Score = timeline length. | [ ] |
| PARITY-005 | Score display - Flag Quiz | Observe scores during Flag Quiz. | Same score chart component. Score = correct answers. | [ ] |
| PARITY-006 | Score display - Map Game | Observe scores during Map Game. | Same score chart on host. Player sees score in result card + standings. | [ ] |
| PARITY-007 | Result reveal - Timeline | Round ends in Timeline. | Host: card with year revealed, green/red border. Player: result screen with emoji+name+year. | [ ] |
| PARITY-008 | Result reveal - Flag Quiz | Round ends in Flag Quiz. | Host: flag+country name revealed. Player: result screen with emoji+name. No year. | [ ] |
| PARITY-009 | Result reveal - Map Game | Round ends in Map. | Host: result map with all pins + scoreboard. Player: result map with guess vs answer + score breakdown. Richer than TL/FQ. | [ ] |
| PARITY-010 | Host engagement - Timeline | Watch host during Timeline. | Host shows current card, turn label, score chart. Active card area. | [ ] |
| PARITY-011 | Host engagement - Flag Quiz | Watch host during Flag Quiz. | Host shows flag, turn label, score chart. Similar engagement to Timeline. | [ ] |
| PARITY-012 | Host engagement - Map Game | Watch host during Map Game. | Host shows large photo, lock counter (pulsing), result map with staggered pins. Highest engagement. | [ ] |
| PARITY-013 | Game over - all 3 modes | Complete game in each mode. | Same game_over screen structure: title, winner banner, scoreboard with medals, confetti. Play Again button. | [ ] |
| PARITY-014 | Play again flow - all modes | Click PLAY AGAIN after each mode. | All modes: returns to lobby. Scores reset. Can select different mode. | [ ] |
| PARITY-015 | i18n - Timeline Hebrew | Play Timeline in Hebrew. | Turn labels, card names, place_here, earlier/later, results all in Hebrew. | [ ] |
| PARITY-016 | i18n - Flag Quiz Hebrew | Play Flag Quiz in Hebrew. | Country names in Hebrew (name_he), steal labels, results all in Hebrew. | [ ] |
| PARITY-017 | i18n - Map Game Hebrew | Play Map Game in Hebrew. | Prompts (where_landmark/city/nature), onboarding, score labels, place names all in Hebrew. | [ ] |
| PARITY-018 | RTL layout - all 3 modes | Switch to Hebrew, play each mode. | All text right-aligned. Turn labels use RTL order. Buttons/inputs aligned correctly. | [ ] |

## 10. i18n & RTL

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| I18N-001 | EN language file complete | Review /lang/en.json. | All keys present: app_name through hebrew. No missing translations. | [ ] |
| I18N-002 | HE language file complete | Review /lang/he.json. | All keys match en.json. All values are Hebrew translations. Same key count. | [ ] |
| I18N-003 | New map strings in EN | Check en.json for map keys. | Keys present: waiting_for_players, score_distance, score_speed, score_nearby, map_onboarding_title, map_onboarding_text, where_landmark, where_city, where_nature. | [ ] |
| I18N-004 | New map strings in HE | Check he.json for map keys. | Same keys present with Hebrew values: מרחק, מהירות, בונוס קרבה, etc. | [ ] |
| I18N-005 | RTL direction switch | Call setLanguage("he"). | document.documentElement.dir="rtl", lang="he". | [ ] |
| I18N-006 | LTR direction switch | Call setLanguage("en"). | document.documentElement.dir="ltr", lang="en". | [ ] |
| I18N-007 | data-i18n attribute translation | Switch language. Inspect elements with data-i18n. | All elements with data-i18n have textContent updated. Inputs have placeholder updated. | [ ] |
| I18N-008 | t() function with fallback | Call t("nonexistent_key"). | Returns the key itself as fallback. No error thrown. | [ ] |
| I18N-009 | Card name_he fallback | Card with name_he=null in Hebrew mode. | Falls back to card.name (English). No blank display. | [ ] |
| I18N-010 | Turn label RTL order | Play in Hebrew. Observe turn label. | Hebrew: "התור של [name] [emoji]" (suffix first). English: "[emoji] [name]'s turn". | [ ] |
| I18N-011 | Score labels use t() with fallback | Play map game. Check score breakdown. | Uses t("score_distance") \|\| "Distance" pattern. Falls back to English if key missing. | [ ] |
| I18N-012 | RTL layout - home page | Open home in Hebrew. | Inputs right-aligned. Labels right-aligned. Join section mirrors correctly. | [ ] |
| I18N-013 | RTL layout - player timeline | Play Timeline in Hebrew. | Earlier/Later labels have RTL arrows. "Place here" buttons aligned. Cards readable RTL. | [ ] |
| I18N-014 | RTL layout - map UI | Play Map in Hebrew. | Timer, prompt, lock-in button, result card all RTL-aware. Mute button position correct. | [ ] |
| I18N-015 | Language fallback on file load error | Corrupt language file scenario. | setLanguage catches error. If non-EN fails, falls back to en.json. | [ ] |
| I18N-016 | i18n-cloak on solo.html | Set pb_lang=he. Load /solo.html. View source. | Sync script in head creates #i18n-cloak style with [data-i18n] { visibility: hidden }. Removed after setLanguage(). | [ ] |
| I18N-017 | i18n-cloak on index.html | Set pb_lang=he. Load /index.html. View source. | Same sync cloak script. No English flash during load. | [ ] |
| I18N-018 | i18n-cloak not injected for English | Set pb_lang=en. Load any page. | No #i18n-cloak element created. Elements visible immediately. | [ ] |
| I18N-019 | exit key in en.json | Check /lang/en.json. | "exit": "✕" present. | [ ] |
| I18N-020 | exit key in he.json | Check /lang/he.json. | "exit": "✕" present. | [ ] |
| I18N-021 | confirm_exit key in en.json | Check /lang/en.json. | "confirm_exit": "Leave the game? Your progress will be lost." present. | [ ] |
| I18N-022 | confirm_exit key in he.json | Check /lang/he.json. | "confirm_exit": "לעזוב את המשחק? ההתקדמות תאבד." present. | [ ] |

## 11. Cross-Browser & Mobile

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| BROWSER-001 | Desktop Chrome | Open PastBlast in Chrome (latest). Test all 3 modes. | All features work. Leaflet map responsive. WebAudio sounds play. No console errors. | [ ] |
| BROWSER-002 | Desktop Safari | Open PastBlast in Safari (latest). Test all 3 modes. | All features work. webkitAudioContext fallback used. Map tiles load. CSS animations work. | [ ] |
| BROWSER-003 | Desktop Firefox | Open PastBlast in Firefox (latest). Test all 3 modes. | All features work. Socket.IO connects. No CSS issues. | [ ] |
| BROWSER-004 | iOS Safari - player | Open player page on iPhone Safari. Play all 3 modes. | Touch events work. Map draggable. Lock-in tappable. Safe area inset for notch. Haptic vibrates. | [ ] |
| BROWSER-005 | Android Chrome - player | Open player page on Android Chrome. Play all 3 modes. | Touch events work. Map draggable. Haptic vibrates. Autocomplete dropdown scrollable. | [ ] |
| BROWSER-006 | Responsive - wide desktop | Open at >1200px width. | Content centered. Max-widths respected. Host result map + scoreboard side by side. | [ ] |
| BROWSER-007 | Responsive - tablet | Open at ~768px width. | Layout adapts. Mode cards may stack. Map fills available space. | [ ] |
| BROWSER-008 | Responsive - mobile | Open at ~375px width. | All elements fit. No horizontal scroll. Map fullscreen (100vw/100dvh). Buttons tappable (min 44px). | [ ] |
| BROWSER-009 | Touch - map drag on mobile | Drag map on phone. | Map pans smoothly. touch-action:none on map container (Leaflet handles). No page scroll. | [ ] |
| BROWSER-010 | Touch - photo tap expand | Tap photo on player phone. | Photo overlay opens. Tap again dismisses. No delay. | [ ] |
| BROWSER-011 | Touch - lock-in button | Tap LOCK IN on phone. | Button responds immediately. -webkit-tap-highlight-color handled. No double-tap zoom. | [ ] |
| BROWSER-012 | Safe area insets | Test on iPhone with notch. | Lock-in button has padding-bottom: max(10px, env(safe-area-inset-bottom)). Timer bar at env(safe-area-inset-top). | [ ] |
| BROWSER-013 | Map fullscreen height | Open map on mobile. | Map screen uses 100dvh (dynamic viewport height). No address bar overlap. | [ ] |
| BROWSER-014 | Reduced motion preference | Enable prefers-reduced-motion in OS/browser. | Feedback popup: no animation, static. Confetti: hidden. Timer/btn transitions: none. | [ ] |

## 12. Socket.IO & Real-Time

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOCK-001 | Socket connection | Open any page with socket.io. | Socket connects. "Connected: [id]" in server logs. | [ ] |
| SOCK-002 | create_room event | Host opens /host. | Room created. Callback returns {code, serverUrl}. Room stored in Map. | [ ] |
| SOCK-003 | join_room event - success | Player joins with valid code+name. | Player added. Callback: {success:true}. Host gets player_joined with player list. | [ ] |
| SOCK-004 | join_room - invalid input | Send join_room with missing fields. | Callback: {error:"Invalid input"}. No crash. | [ ] |
| SOCK-005 | start_game - mode validation | Emit start_game with mode="invalid". | Server ignores. Only "timeline", "quiz", "map" accepted. | [ ] |
| SOCK-006 | start_game - difficulty validation | Emit start_game with difficulty=99. | Server defaults to 2. Only 1,2,3 accepted. | [ ] |
| SOCK-007 | place_card event | Player emits place_card with slotIndex. | Server validates slot, checks placement, returns round_result. | [ ] |
| SOCK-008 | quiz_answer event | Player emits quiz_answer with answer string. | Server compares to currentCard.name. Returns round_result. | [ ] |
| SOCK-009 | map_guess event | Player emits map_guess with lat/lng. | Server stores guess with timeUsed. Emits map_player_locked to all. | [ ] |
| SOCK-010 | All map guesses trigger resolve | All connected players lock in. | allMapGuessesIn() returns true. resolveMapRound() called immediately. Timer cleared. | [ ] |
| SOCK-011 | steal_answer event | Stealer emits steal_answer. | Server calls handleStealAttempt. Returns steal_result. | [ ] |
| SOCK-012 | pass_steal event | Player emits pass_steal. | Server calls passStealer. Next stealer or reveal. | [ ] |
| SOCK-013 | play_again event | Host emits play_again. | Room phase reset to lobby. back_to_lobby emitted to all. Scores cleared. | [ ] |
| SOCK-014 | Reconnection mid-game - Timeline | Player disconnects, reconnects with same name during Timeline. | reconnectPlayer() finds player. Socket re-joined to room. If their turn: your_turn sent. If not: wait sent. | [ ] |
| SOCK-015 | Reconnection mid-game - Flag Quiz | Player disconnects, reconnects during Quiz. | Same reconnection flow. Current turn state restored. | [ ] |
| SOCK-016 | Reconnection mid-game - Map | Player disconnects, reconnects during Map. | Player receives map_round with current card wiki/emoji/type. Can still guess. | [ ] |
| SOCK-017 | Host disconnect | Host closes browser during game. | Players receive host_left event. Shows "Host disconnected" screen with Back Home link. | [ ] |
| SOCK-018 | Rate limiting - WebSocket | Send >20 events per second from one socket. | Server middleware rejects: "Rate limited" error. Socket not crashed. | [ ] |
| SOCK-019 | Rate limiting - HTTP | Send >30 requests/min to /check-room. | Returns 429 status: {error:"Too many requests"}. | [ ] |
| SOCK-020 | Multiple players simultaneous | Run 4 players + 1 host simultaneously. | All events delivered correctly. No race conditions. Scores consistent. | [ ] |
| SOCK-021 | Room cleanup - stale rooms | Room exists for >2 hours (ROOM_TTL). | cleanupStaleRooms() removes room. Timer cleared. | [ ] |
| SOCK-022 | Ping/pong keep-alive | Observe socket over time. | pingInterval: 5000ms. pingTimeout: 10000ms. Connection stays alive. | [ ] |
| SOCK-023 | Max HTTP buffer size | Send message >10KB. | Rejected by maxHttpBufferSize: 10240 setting. | [ ] |

## 13. Security & Privacy

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SEC-001 | XSS - client esc() function | Inject "<script>alert(1)</script>" as player name. | Name displayed with HTML entities escaped. No script execution. | [ ] |
| SEC-002 | XSS - server sanitize() | Send name with HTML chars via socket. | Server sanitizes: < > & " ' all replaced with entities. Stored clean. | [ ] |
| SEC-003 | Input validation - join_room | Send join_room with non-string code/name. | Server checks types. Returns {error:"Invalid input"} for bad data. | [ ] |
| SEC-004 | Input validation - name length | Send name longer than 12 chars. | Server truncates to 12 chars via substring(0,12). | [ ] |
| SEC-005 | Input validation - empty name | Send empty/whitespace-only name. | Server rejects: cleanName.length === 0 check. | [ ] |
| SEC-006 | Input validation - start_game | Non-host tries to start game. | Server checks room.hostSocketId === socket.id. Ignores non-host. | [ ] |
| SEC-007 | Input validation - callback check | Send create_room without callback function. | Server checks typeof callback !== "function". Returns silently. | [ ] |
| SEC-008 | CSP headers | Check response headers. | Content-Security-Policy set: default-src self, script-src with gtag/leaflet, connect-src with ws/wss/wiki, img-src with tiles/qr/wiki. | [ ] |
| SEC-009 | X-Frame-Options | Check response headers. | X-Frame-Options: DENY. Cannot be iframed. | [ ] |
| SEC-010 | X-Content-Type-Options | Check response headers. | X-Content-Type-Options: nosniff. | [ ] |
| SEC-011 | Referrer-Policy | Check response headers. | Referrer-Policy: strict-origin-when-cross-origin. | [ ] |
| SEC-012 | No PII in server logs | Review server console output during game. | track() logs event name, timestamps, room codes, player counts. No player names logged. | [ ] |
| SEC-013 | Map anti-cheat - no lat/lng to clients | Inspect map_round socket event payload. | Only wiki, emoji, type, round, totalRounds, timeLimit sent. lat/lng NOT included until map_result. | [ ] |
| SEC-014 | Room code excludes confusing chars | Generate many room codes. | ALPHABET excludes O and I (avoid confusion with 0 and 1). | [ ] |
| SEC-015 | CORS configuration | Check Socket.IO cors setting. | Origin: PUBLIC_URL + localhost, or true when not set. credentials: true. | [ ] |

## 14. Analytics

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| ANA-001 | analytics.js on index.html | View source of home page. | analytics.js script tag present. Loads gtag. | [ ] |
| ANA-002 | analytics.js on host.html | View source of host page. | analytics.js script tag present. | [ ] |
| ANA-003 | analytics.js on player.html | View source of player page. | analytics.js script tag present. | [ ] |
| ANA-004 | analytics.js on how-to-play.html | View source of how-to-play page. | analytics.js script tag present. | [ ] |
| ANA-005 | analytics.js on local.html | View source of local play page. | analytics.js script tag present and loads. | [ ] |
| ANA-006 | Page view tracking | Load any page. Check GA network requests. | gtag("config", GA_ID, {send_page_view:true}) fires. Page view event sent. | [ ] |
| ANA-007 | Return visit detection | Visit twice. Check events. | return_visit event with days_since_last_visit and total_visits. Uses localStorage pb_last_visit/pb_visit_count. | [ ] |
| ANA-008 | room_created event | Host creates room. Check trackEvent calls. | trackEvent("room_created", {room_code}) called. | [ ] |
| ANA-009 | player_joined event | Player joins room. | trackEvent("player_joined", {room_code}) called. | [ ] |
| ANA-010 | game_started_by_host event | Host starts game. | trackEvent("game_started_by_host", {game_mode, difficulty, length, room_code}) called. | [ ] |
| ANA-011 | game_completed event | Game finishes. | trackEvent("game_completed", {game_mode, player_count, winner_score}) called on host. | [ ] |
| ANA-012 | play_again_clicked event | Host clicks Play Again. | trackEvent("play_again_clicked", {room_code}) called. | [ ] |
| ANA-013 | join_error event | Player gets join error. | trackEvent("join_error", {error_type, room_code}) called. | [ ] |
| ANA-014 | No PII in analytics | Review all trackEvent calls. | No player names, IPs, or personal data in event parameters. Only room codes, modes, scores. | [ ] |
| ANA-015 | GA cookie flags | Check gtag config. | cookie_flags: "SameSite=None;Secure" set. | [ ] |

## 15. Performance

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| PERF-001 | Optimized mode card images | Check /img/mode-*.jpg file sizes. | Images are JPGs (not PNGs). Reasonable file size (<100KB each after optimization). | [ ] |
| PERF-002 | Hero banner optimized | Check /img/hero-banner.jpg file size. | JPG format. Reasonable size. Loads quickly on mobile. | [ ] |
| PERF-003 | Map tile loading performance | Start map round on slow connection (throttle). | Loading skeleton visible while tiles load. Map becomes interactive once tiles arrive. | [ ] |
| PERF-004 | Wikipedia API failure handling | Block en.wikipedia.org. Start map round. | Fetch catch triggers showPhotoFallback(). No infinite loading. Game continues. | [ ] |
| PERF-005 | Wikipedia API timeout | Throttle to very slow connection. | Photo eventually loads or falls back. Timer not blocked by API. | [ ] |
| PERF-006 | Audio context initialization | First interaction on page. | AudioContext created lazily (not on page load). Avoids autoplay policy warnings. | [ ] |
| PERF-007 | Leaflet map reuse | Play multiple map rounds. | Map instance reused between rounds (not destroyed/recreated). Only markers cleared. | [ ] |
| PERF-008 | Result map cleanup | Play many map rounds. | hostResultMap.remove() called before creating new one. No memory leak from stacked maps. | [ ] |
| PERF-009 | Confetti cleanup | Game over with confetti. | Confetti elements removed after 4 seconds (setTimeout). No DOM buildup. | [ ] |
| PERF-010 | Timer cleanup | Game ends or room deleted. | clearTimer() called. No orphaned intervals. | [ ] |
| PERF-011 | Font loading | Check font load on first visit. | Fredoka font via Google Fonts with display=swap. Text visible during load. | [ ] |
| PERF-012 | Socket event rate limit efficiency | Monitor server under load. | Per-socket counter resets every 1s via setInterval. Interval cleared on disconnect. | [ ] |

## 16. Crosshair Alignment Fix (MAP-ALIGN)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| MAP-ALIGN-001 | Crosshair uses getBoundingClientRect() | Start a map round (host or local). Inspect crosshair positioning logic in DevTools. | alignCrosshair() reads container via getBoundingClientRect(), calculates cx/cy as rect center. SVG pin left = cx-16, top = cy-42. Dot left = cx-5, top = cy-5. | [ ] |
| MAP-ALIGN-002 | Crosshair called on map init | Start map game. Observe crosshair immediately after map renders. | alignCrosshair() called after map.invalidateSize() in setTimeout. Crosshair visible at exact center of map container from first frame. | [ ] |
| MAP-ALIGN-003 | Crosshair re-aligned on resize | Start map round. Resize browser window. | Window resize event triggers alignCrosshair(). Crosshair stays at exact center of map container after resize. | [ ] |
| MAP-ALIGN-004 | Crosshair re-aligned on invalidateSize | Start map round. Trigger invalidateSize (e.g., tab switch). | invalidateSize followed by alignCrosshair(). Pin tip remains at map center. | [ ] |
| MAP-ALIGN-005 | Pin tip matches getCenter() coordinates | Start map round. Lock in without moving. Compare getCenter() lat/lng with crosshair visual position. | The lat/lng from map.getCenter() corresponds exactly to where the pin tip points. No offset between visual crosshair and actual coordinate read. | [ ] |
| MAP-ALIGN-006 | Crosshair on mobile portrait | Open map game on mobile in portrait orientation. | Crosshair centered in map container. Pin tip at exact center. No overflow or clipping. | [ ] |
| MAP-ALIGN-007 | Crosshair on mobile landscape | Rotate device to landscape during map round. | Resize event fires. Crosshair re-centers correctly in wider viewport. | [ ] |
| MAP-ALIGN-008 | Crosshair on tablet | Open map game on tablet (iPad or similar). | Crosshair properly centered. Larger viewport does not cause misalignment. | [ ] |
| MAP-ALIGN-009 | Crosshair hidden after lock-in | Lock in a guess during map round. | crosshair.style.display = "none" and dot.style.display = "none". Crosshair disappears on lock-in. | [ ] |
| MAP-ALIGN-010 | Crosshair restored on next round | Complete a round, advance to next. | Crosshair display set back to "block". Visible and re-aligned for next round. | [ ] |

## 17. Feedback Popup Centering (POPUP)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| POPUP-001 | Host feedback uses .feedback-wrapper | Play a round on host. Inspect feedback popup in DevTools. | showFeedback() creates div.feedback-wrapper with div.feedback inside. Wrapper appended to document.body. | [ ] |
| POPUP-002 | Wrapper CSS: position fixed, inset 0 | Inspect .feedback-wrapper computed styles. | position:fixed; inset:0 (top/right/bottom/left all 0). Covers entire viewport. | [ ] |
| POPUP-003 | Wrapper CSS: flexbox centering | Inspect .feedback-wrapper computed styles. | display:flex; align-items:center; justify-content:center. Child feedback div centered both axes. | [ ] |
| POPUP-004 | z-index:9000 above all content | Trigger feedback while map/timeline is visible. | Feedback wrapper z-index:9000. Appears above map (z-index 100), game content, score chart. | [ ] |
| POPUP-005 | Box shadow for visual clarity | Observe feedback popup appearance. | .feedback has box-shadow: 0 8px 40px rgba(0,0,0,0.5). Gives floating depth effect. | [ ] |
| POPUP-006 | popIn animation without translate | Trigger feedback. Observe animation in DevTools. | @keyframes popIn uses scale(0) -> scale(1.15) -> scale(1). No translate() used — centering handled by flexbox. | [ ] |
| POPUP-007 | Correct feedback green styling | Answer correctly in any mode. | .feedback.correct: background #51cf66, color #fff, border 4px solid #fff. | [ ] |
| POPUP-008 | Wrong feedback red styling | Answer incorrectly in any mode. | .feedback.wrong: background #ff6b6b, color #fff, border 4px solid #fff. | [ ] |
| POPUP-009 | Feedback on host during Timeline | Play Timeline on host. Get a result. | Feedback popup appears centered on host screen. Shows emoji, card name, year. Removes after 3.2s. | [ ] |
| POPUP-010 | Feedback on host during Flag Quiz | Play Flag Quiz on host. Get a result. | Feedback popup centered. Shows emoji and card name (no year for quiz mode). Removes after 3.2s. | [ ] |
| POPUP-011 | Feedback on local play Timeline | Play local Timeline. Place a card. | Feedback popup appears centered. Same .feedback-wrapper approach as host. | [ ] |
| POPUP-012 | Feedback on local play Flag Quiz | Play local Flag Quiz. Submit answer. | Feedback popup centered on screen. Correct green or wrong red styling. | [ ] |
| POPUP-013 | Feedback pointer-events:none | Trigger feedback popup. Try to click through it. | wrapper and .feedback both have pointer-events:none. Does not block interaction with game underneath. | [ ] |
| POPUP-014 | Feedback auto-removes after 3.2s | Trigger feedback. Wait. | setTimeout removes wrapper after 3200ms. No stale popups left in DOM. | [ ] |
| POPUP-015 | Feedback min-width responsive | Trigger feedback on narrow mobile screen. | .feedback min-width: min(260px, 85vw). On narrow screens, does not overflow viewport. | [ ] |

## 18. Timeline Card Fly Animation - Multiplayer (TL-ANIM)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TL-ANIM-001 | Fly animation triggers on correct placement | Player places card correctly in multiplayer Timeline. | showTimelineAnimation(true, card) called. Flyer div created and appended to body. Flies from big card to target position. | [ ] |
| TL-ANIM-002 | Fly animation triggers on wrong placement | Player places card incorrectly in multiplayer Timeline. | showTimelineAnimation(false, card) called. Flyer created, flies to where card would go, then fades out. | [ ] |
| TL-ANIM-003 | Card inserted in correct DOM position | Observe timeline DOM during animation. | newSlot inserted in chronological order by comparing card.year with existing .tl-year values. Correct position in DOM. | [ ] |
| TL-ANIM-004 | Target slot initially invisible | Observe target slot during flight. | newSlot.style.opacity = "0". Target position reserved but not visible while flyer is in transit. | [ ] |
| TL-ANIM-005 | getBoundingClientRect for exact target | Inspect animation logic. | After inserting newSlot, getBoundingClientRect() called to get exact pixel position. Used as flyer destination. | [ ] |
| TL-ANIM-006 | Flyer starts at big card position | Observe flyer initial position. | Flyer positioned at bigRect.left, bigRect.top, bigRect.width from bigCard.getBoundingClientRect(). | [ ] |
| TL-ANIM-007 | Flyer transition 0.7s cubic-bezier | Observe flyer CSS transition. | transition: all 0.7s cubic-bezier(0.25,1,0.5,1). Smooth ease-out curve. | [ ] |
| TL-ANIM-008 | Correct: green glow after landing | Place card correctly. Wait for landing. | At 800ms: borderColor #51cf66, boxShadow "0 0 20px rgba(81,207,102,0.6)". Green glow visible. | [ ] |
| TL-ANIM-009 | Correct: year fades in | Place card correctly. Observe year display. | At 800ms: .tl-year opacity transitions from 0 to 1 over 0.4s. Year becomes visible. | [ ] |
| TL-ANIM-010 | Correct: flyer replaced by real card at 1.8s | Place card correctly. Wait 1.8s. | At 1800ms: newSlot.style.opacity = "1", flyer.remove(). Real card visible in timeline, flyer gone. | [ ] |
| TL-ANIM-011 | Wrong: red glow | Place card incorrectly. Observe flyer after landing. | At 700ms: borderColor #ff6b6b, boxShadow "0 0 20px rgba(255,107,107,0.6)". Red glow visible. | [ ] |
| TL-ANIM-012 | Wrong: year shows then card fades | Place card incorrectly. Observe animation sequence. | At 700ms: year fades in. At 1200ms: flyer opacity transitions to 0. At 1700ms: flyer and newSlot removed. | [ ] |
| TL-ANIM-013 | Animation only for active player | Two players in game. Player A places card. | showTimelineAnimation only called when pName === playerName. Other players see result screen directly. | [ ] |
| TL-ANIM-014 | Big card hidden during flight | Observe big card during animation. | bigCard.style.opacity = "0" immediately when flyer created. Big card invisible during flight. | [ ] |
| TL-ANIM-015 | Big card restored after animation | Wait for animation to complete (correct path). | bigCard.style.opacity restored (not explicitly reset in correct path but screen changes). No visual artifact. | [ ] |
| TL-ANIM-016 | Result screen shown after correct animation | Place card correctly. | setTimeout shows result-screen at 1800ms. Result icon checkmark, card name and year displayed. | [ ] |
| TL-ANIM-017 | Result screen shown after wrong animation | Place card incorrectly. | setTimeout shows result-screen at 1200ms. Result icon X, card name and year displayed. | [ ] |
| TL-ANIM-018 | Drop zones removed before animation | Observe timeline DOM at animation start. | el.querySelectorAll(".tl-drop").forEach removes all drop zone elements. Direction labels also removed. | [ ] |
| TL-ANIM-019 | Flyer z-index above everything | Observe flyer stacking. | Flyer has z-index:9999. Appears above timeline, header, all game elements during flight. | [ ] |
| TL-ANIM-020 | Flyer pointer-events:none | Try to interact with flyer during flight. | pointer-events:none on flyer. Cannot accidentally tap/click the flying card. | [ ] |

## 19. Timeline Card Fly Animation - Local Play (TL-ANIM-LOCAL)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| TL-ANIM-LOCAL-001 | animateTimelineCard function exists | Inspect local.html script. Search for animateTimelineCard. | Function animateTimelineCard(card, correct, player) defined. Handles fly animation for local horizontal timeline. | [ ] |
| TL-ANIM-LOCAL-002 | Timeline re-rendered with card for positioning | Place card in local Timeline. Inspect DOM. | Timeline innerHTML cleared. Cards re-rendered in sorted order including new card. Target card has data-target="true" and opacity:0. | [ ] |
| TL-ANIM-LOCAL-003 | Flyer flies from .current-card to target | Observe animation visually. | Flyer starts at bigCard (current-card) getBoundingClientRect(). Transitions to targetRect over 0.7s. | [ ] |
| TL-ANIM-LOCAL-004 | Correct: green glow + year appears | Place card correctly in local Timeline. | At 800ms: green border (#51cf66), green box-shadow. Year element opacity transitions to 1. | [ ] |
| TL-ANIM-LOCAL-005 | Correct: card stays in timeline | Place card correctly. Wait for animation to finish. | At ~1.8s (setTimeout): target slot opacity set to 1. Flyer removed. Card permanently visible in timeline. | [ ] |
| TL-ANIM-LOCAL-006 | Wrong: red glow + year appears | Place card incorrectly in local Timeline. | Red border (#ff6b6b), red box-shadow. Year fades in to show correct answer. | [ ] |
| TL-ANIM-LOCAL-007 | Wrong: card fades out and removed | Place card incorrectly. Observe fade. | Wrong card flyer fades, then card is removed from timeline. renderTimeline() called to clean up. | [ ] |
| TL-ANIM-LOCAL-008 | Works in single player local | Start local Timeline with 1 player. Place a card. | Animation plays: fly from current-card to timeline position. Green/red glow. Normal flow. | [ ] |
| TL-ANIM-LOCAL-009 | Works in multiplayer local | Start local Timeline with 3 players. Each player places a card. | Animation plays for each player's turn. Correct cards stay, wrong cards fade out. Turn advances after animation. | [ ] |
| TL-ANIM-LOCAL-010 | Big card hidden during flight | Observe current-card element during animation. | bigCard.style.opacity = "0" while flyer is in transit. No duplicate card visible. | [ ] |
| TL-ANIM-LOCAL-011 | Big card restored after flight | Wait for animation to complete. Next card appears. | bigCard opacity restored to 1. Next card displayed normally. | [ ] |
| TL-ANIM-LOCAL-012 | Horizontal timeline scroll during animation | Place card that should appear far in timeline. | Timeline container may scroll. Target position calculated after DOM insertion. Flyer lands at correct visible position. | [ ] |
| TL-ANIM-LOCAL-013 | Flyer visual matches placed-card style | Inspect flyer HTML. | Flyer contains .placed-card with card-emoji, card-name, card-year (initially opacity:0). Matches timeline card style. | [ ] |
| TL-ANIM-LOCAL-014 | Year formatted correctly (BCE) | Place card with negative year (e.g., -500). | Year displayed as "500 BCE" using formatYear(). Both in flyer and in timeline. | [ ] |
| TL-ANIM-LOCAL-015 | Steal phase after wrong (multiplayer) | Place card wrong in multiplayer local. | After animation completes (~1.2s), steal phase initiates if multiple players. stealQueue populated. | [ ] |

## 20. Local Play - Map Game Mode (LOCAL-MAP)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| LOCAL-MAP-001 | Map Game tab in header | Open local.html. Inspect header tabs. | Three tabs: "Timeline Game", "Flag Quiz", "Map Game". Map Game button calls switchMode("map"). | [ ] |
| LOCAL-MAP-002 | switchMode("map") shows map start screen | Click Map Game tab. | map-start screen displayed. Title "Map Game", description, player select buttons visible. | [ ] |
| LOCAL-MAP-003 | Fetch cards from /api/map-cards | Start map game. Observe network requests. | GET /api/map-cards?difficulty=N sent. Response is JSON array of card objects. | [ ] |
| LOCAL-MAP-004 | Error handling if server unreachable | Disconnect server. Start map game. | fetch() catch block fires. Alert "Could not load map cards. Make sure the server is running." displayed. Game does not start. | [ ] |
| LOCAL-MAP-005 | Player selection 1-6 players | Click each player count button (1 through 6). | mapLocalSelectedPlayers updates. Button gets "selected" class. Previous selection deselected. | [ ] |
| LOCAL-MAP-006 | Default 1 player selected | Open Map Game start screen. | Button "1" has "selected" class. mapLocalSelectedPlayers = 1. | [ ] |
| LOCAL-MAP-007 | Leaflet map with watercolor tiles | Start map game. Inspect map tiles. | L.map created with center [25,10], zoom 3. Tile layer from tiles.stadiamaps.com/tiles/stamen_watercolor. | [ ] |
| LOCAL-MAP-008 | SVG crosshair aligned via JS | Start map round. Inspect crosshair positioning. | alignMapLocalCrosshair() called. Uses getBoundingClientRect() on map container. Crosshair at exact center. | [ ] |
| LOCAL-MAP-009 | Photo loading from Wikipedia API | Start round with card that has wiki field. | Fetches Wikipedia summary API. Uses thumbnail.source with /500px- replacement. Photo displayed. | [ ] |
| LOCAL-MAP-010 | Photo fallback on fetch error | Start round where Wikipedia fetch fails. | catch(() => {}) silently handles error. Photo src remains empty. Game continues. | [ ] |
| LOCAL-MAP-011 | Varied prompts by card type - landmark | Start round with type="landmark" card. | Prompt text: "Where is this landmark?" | [ ] |
| LOCAL-MAP-012 | Varied prompts by card type - city | Start round with type="city" card. | Prompt text: "Where is this city?" | [ ] |
| LOCAL-MAP-013 | Varied prompts by card type - other | Start round with other card type. | Prompt text: "Where is this place?" | [ ] |
| LOCAL-MAP-014 | Timer Easy difficulty = 40s | Start map game with difficulty=1 (Easy). | mapLocalTimeLeft = 40. Timer starts at 40 and counts down. | [ ] |
| LOCAL-MAP-015 | Timer Medium difficulty = 30s | Start map game with difficulty=2 (Medium). | mapLocalTimeLeft = 30. Timer starts at 30. | [ ] |
| LOCAL-MAP-016 | Timer Hard difficulty = 20s | Start map game with difficulty=3 (Hard). | mapLocalTimeLeft = 20. Timer starts at 20. | [ ] |
| LOCAL-MAP-017 | Timer bar visual - yellow normally | Observe timer during round. | Timer fill background #ffd43b (yellow). Width decreases each second. | [ ] |
| LOCAL-MAP-018 | Timer bar visual - red at 5s | Let timer reach 5 seconds. | Timer fill changes to #ff6b6b (red) when secondsLeft <= 5. | [ ] |
| LOCAL-MAP-019 | Lock-in button | Click LOCK IN button during round. | mapLocalLockIn() called. Button disabled, text changes to "checkmark LOCKED". Crosshair hidden. | [ ] |
| LOCAL-MAP-020 | Auto-submit at 1s remaining | Let timer reach 1 second without locking in. | mapLocalLockIn() auto-called when secondsLeft <= 1 and not already locked. | [ ] |
| LOCAL-MAP-021 | Lock-in prevents double submission | Try clicking LOCK IN twice rapidly. | Second call returns immediately (if mapLocalLocked \|\| !mapLocalInstance). Only one submission processed. | [ ] |
| LOCAL-MAP-022 | Haversine distance calculation | Lock in a guess. Check distance in result. | haversine(lat1, lon1, lat2, lon2) computes great-circle distance using R=6371km. Result in km matches expected. | [ ] |
| LOCAL-MAP-023 | Distance points scoring formula | Lock in guess at known distance. | distPoints = max(0, round(1000 * exp(-dist/1500))). Close guesses score ~1000, far guesses approach 0. | [ ] |
| LOCAL-MAP-024 | Speed bonus formula | Lock in quickly vs slowly. | speedBonus = max(0, round(500 * (1 - timeUsed/timeLimit))). Fast lock-in = up to 500 bonus. | [ ] |
| LOCAL-MAP-025 | Nearby bonus (<300km) | Lock in within 300km of answer. | countryBonus = 200 when dist < 300. Added to round score. | [ ] |
| LOCAL-MAP-026 | No nearby bonus (>=300km) | Lock in more than 300km from answer. | countryBonus = 0. Only distPoints + speedBonus. | [ ] |
| LOCAL-MAP-027 | Result screen shows score breakdown | Complete a round. View result. | Result shows emoji rating, card name, distance in km, +roundScore, breakdown of distance/speed/nearby points. | [ ] |
| LOCAL-MAP-028 | Result emoji rating tiers | Score different amounts across rounds. | >= 900: target emoji, >= 600: fire emoji, >= 300: thumbs up, < 300: sweat smile. | [ ] |
| LOCAL-MAP-029 | Result map with guess vs answer | Complete a round. Inspect result map. | Leaflet map shows checkmark at card.lat/lng (correct), pin at guess lat/lng. Dashed red polyline connects them. | [ ] |
| LOCAL-MAP-030 | Result map fitBounds | Complete round with distant guess. | Map fitBounds with padding [30,30] and maxZoom 8. Both markers visible. | [ ] |
| LOCAL-MAP-031 | Multi-player turn-taking | Start 3-player game. Complete rounds. | Players rotate: index = (current + 1) % count. Each player name/emoji shown in header during their turn. | [ ] |
| LOCAL-MAP-032 | Score chart sidebar visible | Start multiplayer map game. | score-chart displayed with flex. Shows bar for each player with score, emoji, name. | [ ] |
| LOCAL-MAP-033 | Map reset between rounds | Complete one round, observe next. | Map reset to [25,10] zoom 3. Old markers/polylines removed. Dragging/zoom re-enabled. | [ ] |
| LOCAL-MAP-034 | Round counter updates | Progress through rounds. | Round X / Y display updates. mapLocalRound increments each round. | [ ] |
| LOCAL-MAP-035 | Game ends when all rounds complete | Play through all rounds. | mapLocalRound >= mapLocalTotalRounds triggers endMapGame(). Game over screen shown. | [ ] |
| LOCAL-MAP-036 | Game over screen - single player | Finish map game with 1 player. | Title "Game Over!", score displayed. Message based on score vs max possible. | [ ] |
| LOCAL-MAP-037 | Game over screen - multiplayer | Finish map game with multiple players. | Players sorted by score. Winner shown in banner. All players in scoreboard. | [ ] |
| LOCAL-MAP-038 | Post-game summary map | Finish map game. Observe summary map. | Leaflet map with color-coded dots at each card location. Green (>=800), yellow (>=400), red (<400). | [ ] |
| LOCAL-MAP-039 | Summary map fitBounds all locations | Finish game with diverse locations. | Summary map fitBounds covers all card locations with padding [20,20], maxZoom 6. | [ ] |
| LOCAL-MAP-040 | Confetti on game over | Finish map game. | spawnConfetti() called. Confetti animation visible. | [ ] |
| LOCAL-MAP-041 | Play Again button returns to start | Click Play Again on game over. | switchMode("map") called. Returns to map start screen. Can start new game. | [ ] |
| LOCAL-MAP-042 | Cards shuffled each game | Start two separate games. | shuffle([...MAP_CARDS]) creates random order. Different card order each game. | [ ] |
| LOCAL-MAP-043 | Round count from length param | Start with length=short, medium, long. | short=5, medium=10, long=15 rounds. Capped by available cards. | [ ] |
| LOCAL-MAP-044 | Map interactions disabled on result | View result map after lock-in. | Result map has dragging:false, touchZoom:false, scrollWheelZoom:false, doubleClickZoom:false. | [ ] |
| LOCAL-MAP-045 | Result map instance cleanup | Play multiple rounds. | Previous mapLocalResultMapInstance.remove() called before creating new one. No memory leak. | [ ] |

## 21. Local Play - Host Lobby Integration (LOCAL-INT)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| LOCAL-INT-001 | Play Locally link has URL params | Open host lobby. Inspect "Play Locally" link href. | Link href = /local.html?mode=X&difficulty=Y&length=Z matching current lobby selections. | [ ] |
| LOCAL-INT-002 | updateLocalLink on mode change | Change mode in host lobby (Timeline/Quiz/Map). | updateLocalLink() called in selectMode(). Link href updated with new mode param. | [ ] |
| LOCAL-INT-003 | updateLocalLink on difficulty change | Change difficulty in host lobby. | updateLocalLink() called in selectDifficulty(). Link href updated with new difficulty param. | [ ] |
| LOCAL-INT-004 | updateLocalLink on length change | Change game length in host lobby. | updateLocalLink() called in selectLength(). Link href updated with new length param. | [ ] |
| LOCAL-INT-005 | updateLocalLink on initial load | Load host page fresh. | updateLocalLink() called at end of script. Link has default params (mode=timeline, difficulty=2, length=medium). | [ ] |
| LOCAL-INT-006 | local.html reads mode param | Navigate to /local.html?mode=quiz. | urlParams.get("mode") returns "quiz". switchMode("quiz") called. Flag Quiz tab activated. | [ ] |
| LOCAL-INT-007 | local.html reads map mode param | Navigate to /local.html?mode=map. | switchMode("map") called. Map Game tab activated and start screen shown. | [ ] |
| LOCAL-INT-008 | local.html reads difficulty param | Navigate to /local.html?difficulty=3. | urlParams.get("difficulty") returns "3". Used in startMapGame() for timer (20s) and /api/map-cards?difficulty=3. | [ ] |
| LOCAL-INT-009 | local.html reads length param | Navigate to /local.html?length=long. | urlParams.get("length") returns "long". Used in startMapGame() for round count (15 rounds). | [ ] |
| LOCAL-INT-010 | Default values when no params | Navigate to /local.html (no query string). | Timeline mode shown by default. Map game uses difficulty=2, length=medium if started. | [ ] |
| LOCAL-INT-011 | Tab auto-switches to correct mode | Navigate via host lobby link to /local.html?mode=map. | Mode tab "Map Game" visually active. Correct start screen displayed. | [ ] |
| LOCAL-INT-012 | Invalid mode param handled | Navigate to /local.html?mode=invalid. | switchMode("invalid") does nothing or falls back. Timeline shown by default. | [ ] |

## 22. Local Play - Flag Quiz Color Unification (LOCAL-COLOR)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| LOCAL-COLOR-001 | No body.quiz-mode CSS class | Inspect local.html styles. Search for body.quiz-mode. | No body.quiz-mode CSS rules. Pink/purple overrides removed entirely. | [ ] |
| LOCAL-COLOR-002 | Flag Quiz uses purple/yellow theme | Play local Flag Quiz. Observe colors. | Background stays #1b1464 (purple). Accent color #ffd43b (yellow). Same as Timeline mode. | [ ] |
| LOCAL-COLOR-003 | Quiz buttons match Timeline buttons | Compare button styles between modes. | Buttons use same .btn class with yellow background. No pink/gradient overrides. | [ ] |
| LOCAL-COLOR-004 | Quiz input matches main theme | Inspect quiz input field styling. | Input field uses same styling as rest of app. No pink border or background overrides. | [ ] |
| LOCAL-COLOR-005 | Autocomplete dropdown matches theme | Type in quiz input. Observe dropdown. | Autocomplete list uses same dark theme colors. No quiz-specific color overrides. | [ ] |
| LOCAL-COLOR-006 | Quiz cards match main theme | View a quiz card (flag display). | Card styling consistent with Timeline cards. Same border, shadow, background approach. | [ ] |
| LOCAL-COLOR-007 | Visual consistency across all 3 modes | Switch between Timeline, Flag Quiz, Map Game. | All three modes share same purple/yellow color scheme. No jarring color transitions. | [ ] |
| LOCAL-COLOR-008 | Score bar colors unified | Play Flag Quiz. Check score bar. | Score bar matches Timeline/Map styling. Same background, text colors. | [ ] |

## 23. Server API Endpoint (API)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| API-001 | GET /api/map-cards returns 200 | Send GET request to /api/map-cards. | HTTP 200 response. JSON array returned. | [ ] |
| API-002 | Response contains required fields | Inspect response objects. | Each card has: name, emoji, type, lat, lng, wiki, desc, name_he. All present. | [ ] |
| API-003 | Filters cards with lat/lng only | Compare response to ALL_CARDS. | Only cards where c.lat && c.lng are truthy included. Cards without coordinates excluded. | [ ] |
| API-004 | Difficulty filter - easy (1) | GET /api/map-cards?difficulty=1. | Only cards with difficulty <= 1 (or no difficulty field) returned. | [ ] |
| API-005 | Difficulty filter - medium (2) | GET /api/map-cards?difficulty=2. | Cards with difficulty <= 2 returned. Superset of easy. | [ ] |
| API-006 | Difficulty filter - hard (3) | GET /api/map-cards?difficulty=3. | Cards with difficulty <= 3 returned. Superset of medium. | [ ] |
| API-007 | Default difficulty when param missing | GET /api/map-cards (no query param). | parseInt(undefined) \|\| 2 = 2. Medium difficulty used as default. | [ ] |
| API-008 | desc field defaults to empty string | Check cards without desc field. | c.desc \|\| "" returns empty string. No undefined in response. | [ ] |
| API-009 | name_he falls back to name | Check cards without name_he field. | c.name_he \|\| c.name returns English name as fallback. | [ ] |
| API-010 | Response is valid JSON array | Parse response with JSON.parse. | Response is array (not object). Can be iterated. No parse errors. | [ ] |
| API-011 | No sensitive fields leaked | Inspect response fields. | Only mapped fields returned (name, emoji, type, lat, lng, wiki, desc, name_he). No internal IDs, file paths, etc. | [ ] |
| API-012 | Large card set performance | GET /api/map-cards with full card database. | Response returns within reasonable time (<500ms). No timeout or memory issues. | [ ] |

## 24. Map Scoring — Tiered System (SCORE)

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SCORE-001 | Bullseye (<50km) gives 1000 distance points | Lock in guess within 50km of correct location. | distPoints = 1000. Maximum distance score awarded regardless of exact distance within tier. | [ ] |
| SCORE-002 | Amazing range (50-300km) gives 600-1000 scaled points | Lock in guess between 50km and 300km from correct location. | distPoints scales linearly from 1000 (at 50km) down to 600 (at 300km). Formula produces value in [600, 1000]. | [ ] |
| SCORE-003 | Great range (300-1000km) gives 200-600 scaled points | Lock in guess between 300km and 1000km from correct location. | distPoints scales linearly from 600 (at 300km) down to 200 (at 1000km). Formula produces value in [200, 600]. | [ ] |
| SCORE-004 | Not bad range (1000-2000km) gives 50-200 scaled points | Lock in guess between 1000km and 2000km from correct location. | distPoints scales linearly from 200 (at 1000km) down to 50 (at 2000km). Formula produces value in [50, 200]. | [ ] |
| SCORE-005 | Far off (2000-4000km) gives 10-50 scaled points | Lock in guess between 2000km and 4000km from correct location. | distPoints scales linearly from 50 (at 2000km) down to 10 (at 4000km). Formula produces value in [10, 50]. | [ ] |
| SCORE-006 | Miss (>4000km) gives exactly 0 distance points | Lock in guess more than 4000km from correct location. | distPoints = 0. No partial credit beyond 4000km threshold. | [ ] |
| SCORE-007 | Speed bonus full when distance <1000km | Lock in quickly with guess closer than 1000km. | speedBonus = max(0, round(500 * (1 - timeUsed/timeLimit))). Full speed formula applies. | [ ] |
| SCORE-008 | Speed bonus halved when distance 1000-2000km | Lock in quickly with guess between 1000km and 2000km. | speedBonus = max(0, round(250 * (1 - timeUsed/timeLimit))). Speed bonus multiplier halved to 250. | [ ] |
| SCORE-009 | Speed bonus zero when distance >2000km | Lock in quickly with guess more than 2000km away. | speedBonus = 0. No speed bonus awarded regardless of response time. | [ ] |
| SCORE-010 | Nearby bonus +200 when <300km | Lock in guess within 300km of correct location. | countryBonus = 200. Added to round score on top of distPoints and speedBonus. | [ ] |
| SCORE-011 | Nearby bonus 0 when >=300km | Lock in guess 300km or more from correct location. | countryBonus = 0. No nearby bonus component in round score. | [ ] |
| SCORE-012 | Emoji target for distPoints >= 1000 | Score 1000 distance points (bullseye). | Result emoji displays target emoji. Tier label "Bullseye". | [ ] |
| SCORE-013 | Emoji fire for distPoints >= 600 | Score between 600 and 999 distance points. | Result emoji displays fire emoji. Tier label "Amazing". | [ ] |
| SCORE-014 | Emoji clap for distPoints >= 200 | Score between 200 and 599 distance points. | Result emoji displays clapping hands emoji. Tier label "Great" or "Not bad". | [ ] |
| SCORE-015 | Emoji X for distPoints = 0 | Score 0 distance points (>4000km miss). | Result emoji displays red X emoji. Tier label "Miss". | [ ] |
| SCORE-016 | Local play uses same scoring formula as server | Play map game locally. Compare scoring logic to server.js. | Local haversine + tiered distPoints + tiered speedBonus + countryBonus matches server-side calcMapScore(). Identical results for same inputs. | [ ] |
| SCORE-017 | Host displays correct emoji tiers | Play multiplayer map game. Observe host result scoreboard. | Host scoreboard shows correct emoji per player based on their distPoints tier. Matches player-side emoji. | [ ] |
| SCORE-018 | How-to-play page scoring explanation matches implementation | Navigate to /how-to-play.html. Read Map Game scoring section. | Scoring explanation describes tiered system: distance tiers with km ranges, speed bonus tiers, nearby bonus. Matches actual implementation. | [ ] |
| SCORE-019 | Max score per round is 1700 (1000 + 500 + 200) | Lock in instantly within 50km. | distPoints=1000 + speedBonus=500 + countryBonus=200 = 1700 total. No score exceeds 1700. | [ ] |
| SCORE-020 | Random guess on wrong continent averages near 0 | Simulate multiple guesses >4000km away. | distPoints=0, speedBonus=0, countryBonus=0. Total round score = 0 for all far misses. | [ ] |

## 25. Solo Mode — Mode Select & Navigation

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOLO-001 | Solo page loads | Navigate to /solo.html. | Page renders with "PASTBLAST" logo, "SOLO MODE" subtitle, two mode cards (Timeline Survival, Flag Quiz Survival). | [ ] |
| SOLO-002 | Language switcher - English | Click "English" button on solo page. | Page stays LTR. English button gets active class. All data-i18n elements show English. | [ ] |
| SOLO-003 | Language switcher - Hebrew | Click Hebrew button on solo page. | Page switches to RTL. Hebrew button gets active class. All data-i18n elements show Hebrew. | [ ] |
| SOLO-004 | Language persistence from home page | Switch to Hebrew on home page. Navigate to /solo.html. | Solo page loads in Hebrew immediately. No English flash. RTL layout from first paint. | [ ] |
| SOLO-005 | i18n-cloak prevents language flicker | Set localStorage pb_lang=he. Hard-reload /solo.html. Observe first paint. | Sync script in head sets dir=rtl and lang=he. [data-i18n] elements hidden via visibility:hidden until translations load. No English text visible during load. | [ ] |
| SOLO-006 | i18n-cloak removed after translations load | Set pb_lang=he. Load /solo.html. Inspect DOM after load. | #i18n-cloak style element removed by setLanguage(). All [data-i18n] elements visible with Hebrew text. | [ ] |
| SOLO-007 | i18n-cloak not applied for English | Clear pb_lang or set to "en". Load /solo.html. | No #i18n-cloak style injected. Elements visible immediately with English fallback text. | [ ] |
| SOLO-008 | Timeline Survival card click | Click Timeline Survival card. | startTimelineGame() called. Mode select hides. Timeline game area shows with top bar, current card, timeline. | [ ] |
| SOLO-009 | Flag Quiz Survival card click | Click Flag Quiz Survival card. | startQuizGame() called. Mode select hides. Quiz game area shows with top bar, flag card, input field. | [ ] |
| SOLO-010 | Best score display - no previous | Clear localStorage pb_solo_best_timeline and pb_solo_best_quiz. Load solo page. | Best score areas are empty. No "Best: X" text shown. | [ ] |
| SOLO-011 | Best score display - with previous | Set localStorage pb_solo_best_timeline=15. Load solo page. | Timeline card shows "Best: 15" with score in gold. | [ ] |
| SOLO-012 | Back to Home link | Click "Back to Home" link on mode select. | Navigates to / (home page). | [ ] |
| SOLO-013 | Made by link | Click "Made by Yonatan Back" link. | Opens LinkedIn profile in new tab. | [ ] |

## 26. Solo Mode — Timeline Survival

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOLO-TL-001 | Game initializes correctly | Start Timeline Survival. | Lives = 3 hearts. Score = 0. Streak empty. One starter card on timeline. Current card drawn from deck. | [ ] |
| SOLO-TL-002 | Top bar displays correctly | Start Timeline game. Observe top bar. | Shows: exit button (✕), 3 heart emojis, "Score" label with "0", streak area (empty initially). Sticky at top. | [ ] |
| SOLO-TL-003 | Current card - flag type | Draw a flag card. | Shows: "Flag" category badge, large flag emoji (8rem desktop / 6rem mobile), "When was this country founded?" hint. No country name revealed. | [ ] |
| SOLO-TL-004 | Current card - history type | Draw a history card. | Shows: "History" category badge, emoji, card name (localized), description text. | [ ] |
| SOLO-TL-005 | Current card - landmark type | Draw a landmark card. | Shows: "Landmark" category badge, emoji, card name (localized), description text. | [ ] |
| SOLO-TL-006 | Current card is sticky | Scroll down through a long timeline. | Current card stays visible at top (position: sticky, top: 70px). Does not scroll off screen. Player can always see what they're placing. | [ ] |
| SOLO-TL-007 | "TAP TO PLACE" instruction is sticky | Scroll down through timeline. | Instruction text stays visible below the sticky card (position: sticky, top: 250px). | [ ] |
| SOLO-TL-008 | Timeline renders with drop zones | Start game with starter card. | Timeline shows: "Earlier" label, drop zone, starter card with emoji+name+year, drop zone, "Later" label. | [ ] |
| SOLO-TL-009 | Timeline vertical on mobile | Open on mobile (<600px). | Timeline switches to vertical (flex-direction: column). Red line becomes vertical center line. | [ ] |
| SOLO-TL-010 | Correct placement - score +1 | Place card in correct chronological position. | Card added to timeline. Score increments by 1. Streak increments. Green feedback popup with checkmark, name, year. | [ ] |
| SOLO-TL-011 | Wrong placement - lose a life | Place card in wrong position. | Life lost (heart turns black). Streak resets to 0. Red feedback popup with X, name, year. Card NOT added to timeline. | [ ] |
| SOLO-TL-012 | Streak display at 3 | Get 3 correct in a row. | Streak shows "🔥 x3". | [ ] |
| SOLO-TL-013 | Streak display at 5 | Get 5 correct in a row. | Streak shows "🔥🔥 x5". | [ ] |
| SOLO-TL-014 | Streak display at 10 | Get 10 correct in a row. | Streak shows "🔥🔥🔥 x10". | [ ] |
| SOLO-TL-015 | Game over at 0 lives | Lose all 3 lives. | Game ends after 1.8s delay. Game over screen appears with confetti. | [ ] |
| SOLO-TL-016 | Heart break animation | Lose a life. | Lives container gets heart-break animation (scale 1 -> 1.3 -> 0.8 -> 1, 0.5s). | [ ] |
| SOLO-TL-017 | Deck reshuffles when exhausted | Play through entire deck. | When deck empty, fresh cards shuffled (excluding cards already on timeline). Game continues. | [ ] |
| SOLO-TL-018 | Drop zones grow with timeline | Place 10 cards correctly. | Timeline grows with more cards and drop zones. All positions tappable. Scrollable on mobile. | [ ] |
| SOLO-TL-019 | Year display - BCE dates | Draw card with year < 0. | Displays as "500 BCE" (formatYear). Both on current card reveal and timeline. | [ ] |
| SOLO-TL-020 | Card names localized in Hebrew | Switch to Hebrew, play Timeline. | Card names use name_he. Descriptions use desc_he. Falls back to English if no Hebrew available. | [ ] |
| SOLO-TL-021 | Twemoji renders flag emojis | Start game. Observe flag emojis. | parseEmoji() called. Flag emojis rendered as twemoji SVG images, not native text. | [ ] |
| SOLO-TL-022 | Analytics event on game start | Start Timeline game. Check trackEvent calls. | trackEvent("solo_game_start", { mode: "timeline" }) called. | [ ] |
| SOLO-TL-023 | "Wall Street Crash" question text | Play until "Wall Street Crash" card appears. | Card name is "Wall Street Crash" (not "Stock Market Crash 1929"). Year 1929 not revealed in name. | [ ] |

## 27. Solo Mode — Flag Quiz Survival

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOLO-FQ-001 | Game initializes correctly | Start Flag Quiz Survival. | Lives = 3 hearts. Score = 0. Streak empty. First flag card drawn. Input field focused. | [ ] |
| SOLO-FQ-002 | Top bar displays correctly | Start Flag Quiz game. Observe top bar. | Shows: exit button (✕), 3 hearts, "Score" label with "0", streak area. Sticky at top. | [ ] |
| SOLO-FQ-003 | Flag emoji display - large | Observe flag card. | Flag emoji rendered at 10rem (desktop) / 8rem (mobile). Inside quiz-card with min-height 160px. Centered via flexbox. | [ ] |
| SOLO-FQ-004 | Flag card layout stable | Answer a question and wait for next card. | Card transitions smoothly. No layout jumping. Score/flag don't move up or down unexpectedly. Page stays scrolled to top. | [ ] |
| SOLO-FQ-005 | preventScroll on input focus | Next card loads. Observe scroll behavior. | input.focus({ preventScroll: true }) called. window.scrollTo(0,0) called. Page does not jump when new card appears. | [ ] |
| SOLO-FQ-006 | Quiz game content overflow hidden | Inspect #solo-quiz .game-content computed styles. | overflow: hidden. justify-content: flex-start. Prevents layout shifts from causing scroll. | [ ] |
| SOLO-FQ-007 | Input field - placeholder | Observe input in English. | Placeholder: "Type country name..." (from data-i18n). | [ ] |
| SOLO-FQ-008 | Input field - Hebrew placeholder | Switch to Hebrew. Start quiz. | Placeholder shows Hebrew: "...הקלד שם מדינה". | [ ] |
| SOLO-FQ-009 | Autocomplete - English search | Type "uni". | Dropdown shows: United States, United Kingdom, etc. Matching text highlighted in gold (#ffd43b). | [ ] |
| SOLO-FQ-010 | Autocomplete - Hebrew search | Switch to Hebrew, type Hebrew text. | Searches both name and name_he. Hebrew names shown in dropdown. | [ ] |
| SOLO-FQ-011 | Autocomplete - max 15 results | Type "a" (many matches). | Dropdown shows at most 15 items (.slice(0, 15)). | [ ] |
| SOLO-FQ-012 | Autocomplete - click to submit | Click an autocomplete item. | submitQuizAnswer() called with card.name. Input disabled. Dropdown closes. | [ ] |
| SOLO-FQ-013 | Autocomplete - keyboard arrows | Press ArrowDown/ArrowUp in dropdown. | Active item highlighted. scrollIntoView({ block: 'nearest' }) called. | [ ] |
| SOLO-FQ-014 | Autocomplete - Enter to submit | Navigate to item with arrows, press Enter. | Selected item submitted. Matches by textContent against FLAG_CARDS. | [ ] |
| SOLO-FQ-015 | Autocomplete - Enter with single result | Type until 1 result remains, press Enter. | Single item auto-submitted without needing to arrow-select. | [ ] |
| SOLO-FQ-016 | Autocomplete - click outside closes | Click outside the input/dropdown area. | Dropdown hides (display: none). | [ ] |
| SOLO-FQ-017 | Correct answer - green border + score | Submit correct country. | Input border turns green (#51cf66). Score +1. Streak +1. Green feedback popup. | [ ] |
| SOLO-FQ-018 | Wrong answer - red border + life lost | Submit wrong country. | Input border turns red (#ff6b6b). Streak reset. Life lost. Red feedback popup. | [ ] |
| SOLO-FQ-019 | Input shows correct answer on wrong | Submit wrong answer. | Input value set to correct country name (Hebrew name_he if RTL). | [ ] |
| SOLO-FQ-020 | Next card after 1.5s delay | Answer a question. | Next card appears after 1500ms setTimeout. Input cleared, enabled, refocused. | [ ] |
| SOLO-FQ-021 | Locked state prevents double submit | Submit answer, then quickly try to type/submit again. | qzLocked = true after first submit. Input disabled. No double scoring. | [ ] |
| SOLO-FQ-022 | Deck reshuffles when exhausted | Play through all flag cards. | When deck empty, full FLAG_CARDS reshuffled. Game continues indefinitely until lives run out. | [ ] |
| SOLO-FQ-023 | Well-known flags first | Start quiz game. Note first ~40 cards. | First 40 are from well-known set (shuffled). Harder flags come after. | [ ] |
| SOLO-FQ-024 | Game over at 0 lives | Lose all 3 lives. | Game ends after 1.8s delay. Game over screen with confetti. | [ ] |
| SOLO-FQ-025 | Analytics event on game start | Start Flag Quiz. Check trackEvent calls. | trackEvent("solo_game_start", { mode: "quiz" }) called. | [ ] |
| SOLO-FQ-026 | Font sizes readable | Observe quiz card and input. | Quiz input font: 1.4rem. Autocomplete items: 1.2rem with 12px padding. All legible on mobile. | [ ] |

## 28. Solo Mode — Exit Button

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOLO-EXIT-001 | Exit button visible in Timeline game | Start Timeline Survival. Observe top bar. | ✕ button visible in top-bar-left, before hearts. Styled with semi-transparent background, rounded corners. | [ ] |
| SOLO-EXIT-002 | Exit button visible in Flag Quiz game | Start Flag Quiz Survival. Observe top bar. | Same ✕ button visible in top-bar-left, before hearts. | [ ] |
| SOLO-EXIT-003 | Exit shows confirmation dialog | Click ✕ button during gameplay. | Browser confirm() dialog: "Leave the game? Your progress will be lost." (or Hebrew equivalent). | [ ] |
| SOLO-EXIT-004 | Confirm exit returns to mode select | Click ✕, then confirm (OK). | Returns to solo mode select screen. Best scores updated. Game state cleared. | [ ] |
| SOLO-EXIT-005 | Cancel exit continues game | Click ✕, then cancel. | Dialog dismissed. Game continues from where it was. Score/lives/timeline preserved. | [ ] |
| SOLO-EXIT-006 | Exit confirmation in Hebrew | Switch to Hebrew. Click ✕ during game. | Confirm dialog shows Hebrew: "לעזוב את המשחק? ההתקדמות תאבד." | [ ] |
| SOLO-EXIT-007 | Exit button hover state | Hover over ✕ button (desktop). | Background brightens (rgba 0.2), border brightens, text color turns white. | [ ] |
| SOLO-EXIT-008 | Exit during flag quiz clears input state | Start flag quiz, type partial answer, click ✕ and confirm. | Returns to mode select cleanly. No stale input state when starting new game. | [ ] |

## 29. Solo Mode — Game Over & Share

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOLO-END-001 | Game over screen displays | Lose all lives. | "GAME OVER!" title, final score (large gold text), best streak stat, Play Again / Share / Change Mode buttons, Back to Home link. | [ ] |
| SOLO-END-002 | New best score | Score higher than previous best. | "NEW BEST!" text shown with popInStay animation. localStorage updated. | [ ] |
| SOLO-END-003 | Not a new best | Score lower than previous best. | No "NEW BEST!" shown. localStorage unchanged. | [ ] |
| SOLO-END-004 | Play Again - Timeline | Finish Timeline game. Click PLAY AGAIN. | New Timeline game starts. Scores reset. Fresh deck. 3 lives. | [ ] |
| SOLO-END-005 | Play Again - Flag Quiz | Finish Quiz game. Click PLAY AGAIN. | New Quiz game starts. Scores reset. Fresh deck. 3 lives. Input focused. | [ ] |
| SOLO-END-006 | Change Mode button | Click Change Mode on game over. | Returns to solo mode select screen. Can choose different mode. | [ ] |
| SOLO-END-007 | Share - Web Share API (mobile) | Click SHARE on mobile with Web Share API. | navigator.share() called with score text, mode name, and app URL. | [ ] |
| SOLO-END-008 | Share - clipboard fallback (desktop) | Click SHARE on desktop. | Text copied to clipboard. Button text changes to "✓ Copied!" for 2s with green styling. | [ ] |
| SOLO-END-009 | Share text format | Click SHARE. Inspect shared text. | Format: "PastBlast [Mode Name]\n🏆 [score] points[streak emojis]\n\nCan you beat my score?\n[URL]". | [ ] |
| SOLO-END-010 | Confetti on game over | Game ends. | 35 confetti elements spawned (random flag emojis). Fall animation. Removed after 4s. | [ ] |
| SOLO-END-011 | Analytics on game over | Game ends. Check trackEvent. | trackEvent("solo_game_over", { mode, score, best_streak, new_best }) called. | [ ] |
| SOLO-END-012 | Analytics on share | Click SHARE. | trackEvent("solo_share", { mode, score }) called. | [ ] |
| SOLO-END-013 | Back to Home from game over | Click "Back to Home" link. | Navigates to / (home page). | [ ] |

## 30. Solo Mode — i18n & Visual Polish

| Test ID | Test Case | Steps | Expected Result | Status |
|---------|-----------|-------|-----------------|--------|
| SOLO-I18N-001 | All solo strings in en.json | Review /lang/en.json. | Keys present: solo_mode, timeline_survival, flag_survival, timeline_desc, flag_quiz_desc, how_far, best_score, new_best, best_streak, change_mode, share, exit, confirm_exit. | [ ] |
| SOLO-I18N-002 | All solo strings in he.json | Review /lang/he.json. | Same keys present with Hebrew translations. exit="✕", confirm_exit="לעזוב את המשחק? ההתקדמות תאבד." | [ ] |
| SOLO-I18N-003 | Mode select in Hebrew | Switch to Hebrew on solo page. | "מצב יחיד" subtitle, "הישרדות ציר זמן", "הישרדות חידון דגלים", "?כמה רחוק תגיעו" tagline. | [ ] |
| SOLO-I18N-004 | Game top bar in Hebrew | Play either mode in Hebrew. | "ניקוד" label, hearts render correctly, exit button works. | [ ] |
| SOLO-I18N-005 | Timeline labels in Hebrew | Play Timeline in Hebrew. | "מוקדם יותר ↑" / "מאוחר יותר ↓" direction labels. "לחץ למקם" instruction. | [ ] |
| SOLO-I18N-006 | Flag quiz placeholder in Hebrew | Play Flag Quiz in Hebrew. | Input placeholder: "...הקלד שם מדינה". | [ ] |
| SOLO-I18N-007 | Game over in Hebrew | Finish game in Hebrew. | "!המשחק נגמר" title, "שחק שוב", "שתפו", "החלף מצב", "חזרה הביתה" buttons/links. | [ ] |
| SOLO-I18N-008 | RTL layout - solo mode select | Open solo in Hebrew. | Mode cards, tagline, links all right-aligned. Lang switcher stays LTR (direction:ltr). | [ ] |
| SOLO-I18N-009 | RTL layout - timeline game | Play Timeline in Hebrew. | Cards, drop zones, direction labels, top bar all RTL-aware. | [ ] |
| SOLO-I18N-010 | RTL layout - flag quiz game | Play Flag Quiz in Hebrew. | Input right-aligned. Autocomplete dropdown right-aligned. Top bar mirrors. | [ ] |
| SOLO-VIS-001 | Font sizes - card title | Observe current card title. | font-size: 1.7rem. Bold. White color. | [ ] |
| SOLO-VIS-002 | Font sizes - card description | Observe current card description. | font-size: 1.3rem. Muted white. line-height 1.5. | [ ] |
| SOLO-VIS-003 | Font sizes - card hint | Observe "When was this country founded?" | font-size: 1.3rem. Muted color. | [ ] |
| SOLO-VIS-004 | Font sizes - placed card text | Observe placed cards on timeline. | card-name: 1rem. card-year: 1.25rem (gold). | [ ] |
| SOLO-VIS-005 | Font sizes - mode card description | Observe mode cards on select screen. | font-size: 1.05rem. Muted color. | [ ] |
| SOLO-VIS-006 | Reduced motion preference | Enable prefers-reduced-motion. Play solo mode. | Card bounce, confetti, popIn, heart break all disabled. No animations. | [ ] |

