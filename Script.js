/* ═══════════════════════════════════════════════════
   GridMind AI — Premium Tic-Tac-Toe
   Game Logic, AI (Minimax), Audio, Haptics
   ═══════════════════════════════════════════════════ */

// ── Audio Engine (Web Audio API) ────────────────────
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgmNodes = [];
        this.bgmGain = null;
        this.masterGain = null;
        this.volume = 0.6;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
    }

    setVolume(v) {
        this.volume = v;
        if (this.masterGain) this.masterGain.gain.value = v;
        if (this.bgmGain) this.bgmGain.gain.value = v * 0.08;
    }

    _tone(freq, type, dur, vol = 0.15, ramp = true) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        if (ramp) gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + dur);
    }

    _sweep(from, to, type, dur, vol = 0.1) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(to, this.ctx.currentTime + dur);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + dur);
    }

    // Move X — satisfying pop sweep
    playMoveX() {
        this._sweep(400, 900, 'sine', 0.08, 0.12);
        setTimeout(() => this._tone(900, 'sine', 0.06, 0.06), 60);
    }

    // Move O — deeper electronic blip
    playMoveO() {
        this._sweep(300, 550, 'triangle', 0.12, 0.1);
    }

    // Win — triumphant ascending melody C5-E5-G5-C6
    playWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this._tone(freq, 'sine', 0.3, 0.2);
                this._tone(freq * 1.005, 'sine', 0.3, 0.08); // slight detune for richness
            }, i * 160);
        });
    }

    // Draw — gentle neutral chime
    playDraw() {
        this._tone(440, 'sine', 0.25, 0.1);
        setTimeout(() => this._tone(392, 'sine', 0.35, 0.08), 180);
    }

    // UI Click — crisp
    playClick() {
        this._tone(1200, 'square', 0.03, 0.04);
    }

    // Error / Invalid move
    playError() {
        this._tone(180, 'sawtooth', 0.12, 0.08);
        setTimeout(() => this._tone(140, 'sawtooth', 0.1, 0.06), 80);
    }

    // Game start whoosh
    playStart() {
        this._sweep(200, 1200, 'sine', 0.4, 0.08);
        this._sweep(100, 800, 'triangle', 0.5, 0.04);
    }

    // Background music — ambient pad
    toggleBgm(play) {
        if (!this.ctx) this.init();
        if (play && this.bgmNodes.length === 0) {
            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.value = this.volume * 0.08;
            this.bgmGain.connect(this.ctx.destination);

            // Layer 3 slightly detuned oscillators for ambient pad
            const baseFreqs = [110, 110.5, 109.5];
            baseFreqs.forEach(freq => {
                const osc = this.ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;

                // Slow LFO for movement
                const lfo = this.ctx.createOscillator();
                const lfoGain = this.ctx.createGain();
                lfo.frequency.value = 0.2 + Math.random() * 0.3;
                lfoGain.gain.value = 2;
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start();

                osc.connect(this.bgmGain);
                osc.start();
                this.bgmNodes.push(osc, lfo);
            });

            // Add a fifth (165 Hz) very softly
            const fifth = this.ctx.createOscillator();
            fifth.type = 'sine';
            fifth.frequency.value = 165;
            const fifthGain = this.ctx.createGain();
            fifthGain.gain.value = 0.3;
            fifth.connect(fifthGain);
            fifthGain.connect(this.bgmGain);
            fifth.start();
            this.bgmNodes.push(fifth);
        } else if (!play) {
            this.bgmNodes.forEach(n => { try { n.stop(); } catch(e) {} });
            this.bgmNodes = [];
        }
    }
}

// ── Haptic Feedback ─────────────────────────────────
const Haptics = {
    tap() { navigator.vibrate?.(12); },
    move() { navigator.vibrate?.(15); },
    win() { navigator.vibrate?.([50, 30, 50, 30, 100]); },
    draw() { navigator.vibrate?.([30, 20, 30]); },
    error() { navigator.vibrate?.([20, 10, 20]); },
    click() { navigator.vibrate?.(8); },
};

// ── Particle System ─────────────────────────────────
class ParticleSystem {
    constructor(container) {
        this.container = container;
    }

    burst(x, y, count = 40) {
        const colors = [
            getComputedStyle(document.documentElement).getPropertyValue('--particle-1').trim() || '#7c3aed',
            getComputedStyle(document.documentElement).getPropertyValue('--particle-2').trim() || '#ec4899',
            getComputedStyle(document.documentElement).getPropertyValue('--particle-3').trim() || '#06b6d4',
            getComputedStyle(document.documentElement).getPropertyValue('--particle-4').trim() || '#fbbf24',
        ];

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle burst';
            const size = Math.random() * 8 + 4;
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
            const velocity = 80 + Math.random() * 120;
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity;

            Object.assign(p.style, {
                left: x + 'px',
                top: y + 'px',
                width: size + 'px',
                height: size + 'px',
                background: colors[Math.floor(Math.random() * colors.length)],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            });

            p.style.setProperty('animation', 'none');
            this.container.appendChild(p);

            // Animate with JS for custom directions
            let startTime = null;
            const duration = 800 + Math.random() * 400;
            const animate = (ts) => {
                if (!startTime) startTime = ts;
                const elapsed = ts - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);

                p.style.transform = `translate(${dx * ease}px, ${dy * ease + progress * progress * 200}px) rotate(${progress * 720}deg) scale(${1 - progress})`;
                p.style.opacity = 1 - progress;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    p.remove();
                }
            };
            requestAnimationFrame(animate);
        }
    }

    confetti(count = 50) {
        const colors = ['#7c3aed', '#ec4899', '#06b6d4', '#fbbf24', '#10b981', '#f97316'];
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle confetti';
            const size = Math.random() * 8 + 4;
            Object.assign(p.style, {
                left: Math.random() * 100 + '%',
                top: -10 + 'px',
                width: size + 'px',
                height: size * (Math.random() * 2 + 1) + 'px',
                background: colors[Math.floor(Math.random() * colors.length)],
                animationDelay: Math.random() * 0.5 + 's',
                animationDuration: (1.5 + Math.random() * 1.5) + 's',
            });
            this.container.appendChild(p);
            setTimeout(() => p.remove(), 3000);
        }
    }
}

// ── Floating Background Particles ───────────────────
function createFloatingParticles() {
    const container = document.getElementById('floating-particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const dot = document.createElement('div');
        dot.className = 'floating-dot';
        dot.style.left = Math.random() * 100 + '%';
        dot.style.animationDuration = (15 + Math.random() * 20) + 's';
        dot.style.animationDelay = Math.random() * 15 + 's';
        dot.style.width = dot.style.height = (2 + Math.random() * 4) + 'px';
        container.appendChild(dot);
    }
}

// ── Ripple Effect ───────────────────────────────────
function addRipple(e, el) {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width / 2) - rect.left - size / 2 + 'px';
    ripple.style.top = (e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height / 2) - rect.top - size / 2 + 'px';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// ── AI Engine (Minimax with Alpha-Beta) ─────────────
class TicTacToeAI {
    constructor() {
        this.difficulty = 'hard';
    }

    static LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    getMove(board) {
        switch (this.difficulty) {
            case 'easy': return this._randomMove(board);
            case 'medium': return Math.random() < 0.3 ? this._randomMove(board) : this._bestMove(board);
            case 'hard': return this._bestMove(board);
            default: return this._bestMove(board);
        }
    }

    _randomMove(board) {
        const empty = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
        return empty.length > 0 ? empty[Math.floor(Math.random() * empty.length)] : -1;
    }

    _bestMove(board) {
        let bestScore = -Infinity;
        let bestIdx = -1;
        for (let i = 0; i < 9; i++) {
            if (board[i] !== null) continue;
            board[i] = 'O';
            const score = this._minimax(board, 0, false, -Infinity, Infinity);
            board[i] = null;
            if (score > bestScore) { bestScore = score; bestIdx = i; }
        }
        return bestIdx;
    }

    _minimax(board, depth, isMax, alpha, beta) {
        const winner = this._checkWinner(board);
        if (winner === 'O') return 10 - depth;
        if (winner === 'X') return depth - 10;
        if (winner === 'tie') return 0;

        if (isMax) {
            let best = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] !== null) continue;
                board[i] = 'O';
                best = Math.max(best, this._minimax(board, depth + 1, false, alpha, beta));
                board[i] = null;
                alpha = Math.max(alpha, best);
                if (beta <= alpha) break; // Alpha-beta pruning
            }
            return best;
        } else {
            let best = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] !== null) continue;
                board[i] = 'X';
                best = Math.min(best, this._minimax(board, depth + 1, true, alpha, beta));
                board[i] = null;
                beta = Math.min(beta, best);
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    _checkWinner(board) {
        for (const [a, b, c] of TicTacToeAI.LINES) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
        }
        return board.includes(null) ? null : 'tie';
    }
}

// ── Main Game Class ─────────────────────────────────
class GridMindGame {
    constructor() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.isActive = false;
        this.gameMode = 'pvp';
        this.ai = new TicTacToeAI();
        this.audio = new AudioEngine();
        this.sfxEnabled = true;
        this.musicEnabled = false;
        this.scores = { X: 0, O: 0, ties: 0 };
        this.streak = 0;
        this.lastWinner = null;
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.moveHistory = [];

        this._initDOM();
        this._bindEvents();
        this._loadSettings();
        this._startSplash();
        createFloatingParticles();
        this.particles = new ParticleSystem(document.getElementById('particles-container'));
    }

    _initDOM() {
        this.cells = [...document.querySelectorAll('.cell')];
        this.turnEl = document.querySelector('.turn-indicator');
        this.timerEl = document.querySelector('.game-timer');
        this.aiThinkingEl = document.querySelector('.ai-thinking');
        this.streakEl = document.getElementById('streak-count');
        this.settingsOverlay = document.querySelector('.settings-overlay');
        this.settingsPanel = document.querySelector('.settings-panel');
    }

    _bindEvents() {
        // Cell clicks
        this.cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                addRipple(e, cell);
                this._handleMove(parseInt(cell.dataset.index));
            });
        });

        // Settings
        document.getElementById('btn-settings').addEventListener('click', (e) => {
            addRipple(e, e.currentTarget);
            this.audio.init();
            if (this.sfxEnabled) this.audio.playClick();
            Haptics.click();
            this._openSettings();
        });

        document.querySelector('.close-btn').addEventListener('click', () => this._closeSettings());
        this.settingsOverlay.addEventListener('click', () => this._closeSettings());

        // Game mode buttons
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                addRipple(e, btn);
                document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.gameMode = btn.dataset.mode;
                document.getElementById('ai-diff-group').style.display = this.gameMode === 'ai' ? 'block' : 'none';
                this._updateLabels();
                if (this.sfxEnabled) this.audio.playClick();
                Haptics.click();
                this.resetGame();
                this._saveSettings();
            });
        });

        // AI difficulty
        document.querySelectorAll('[data-diff]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                addRipple(e, btn);
                document.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.ai.difficulty = btn.dataset.diff;
                if (this.sfxEnabled) this.audio.playClick();
                Haptics.click();
                this._saveSettings();
            });
        });

        // Theme
        document.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                addRipple(e, btn);
                document.querySelectorAll('[data-theme]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.body.className = `theme-${btn.dataset.theme}`;
                if (this.sfxEnabled) this.audio.playClick();
                Haptics.click();
                this._saveSettings();
            });
        });

        // Sound toggles
        document.getElementById('sfx-toggle').addEventListener('change', (e) => {
            this.sfxEnabled = e.target.checked;
            if (this.sfxEnabled) { this.audio.init(); this.audio.playClick(); }
            Haptics.click();
            this._saveSettings();
        });

        document.getElementById('music-toggle').addEventListener('change', (e) => {
            this.musicEnabled = e.target.checked;
            this.audio.init();
            this.audio.toggleBgm(this.musicEnabled);
            Haptics.click();
            this._saveSettings();
        });

        // Volume
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            const v = parseInt(e.target.value) / 100;
            this.audio.setVolume(v);
            document.getElementById('volume-value').textContent = e.target.value + '%';
            this._saveSettings();
        });

        // Control buttons
        document.getElementById('btn-new-game').addEventListener('click', (e) => {
            addRipple(e, e.currentTarget);
            if (this.sfxEnabled) this.audio.playClick();
            Haptics.click();
            this.resetGame();
        });

        document.getElementById('btn-reset-scores').addEventListener('click', (e) => {
            addRipple(e, e.currentTarget);
            if (this.sfxEnabled) this.audio.playClick();
            Haptics.click();
            this.scores = { X: 0, O: 0, ties: 0 };
            this.streak = 0;
            this.lastWinner = null;
            this._updateScores();
            this._saveSettings();
        });

        // Init audio on first user gesture
        document.body.addEventListener('click', () => this.audio.init(), { once: true });
        document.body.addEventListener('touchstart', () => this.audio.init(), { once: true });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._closeSettings();
            if (e.key === 'r' || e.key === 'R') this.resetGame();
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) this._handleMove(num - 1);
        });

        // Prevent zoom on double tap
        let lastTouch = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouch <= 300) e.preventDefault();
            lastTouch = now;
        }, { passive: false });
    }

    _startSplash() {
        setTimeout(() => {
            document.getElementById('splash').classList.add('fade-out');
            setTimeout(() => {
                document.getElementById('splash').remove();
                this.isActive = true;
                this._startTimer();
                if (this.sfxEnabled) this.audio.playStart();
            }, 800);
        }, 2200);
    }

    _openSettings() {
        this.settingsOverlay.classList.add('open');
        this.settingsPanel.classList.add('open');
    }

    _closeSettings() {
        this.settingsOverlay.classList.remove('open');
        this.settingsPanel.classList.remove('open');
    }

    // ── Game Logic ────────────────────────────────
    _handleMove(idx) {
        if (!this.isActive || this.board[idx] !== null) {
            if (this.board[idx] !== null && this.isActive) {
                // Invalid move feedback
                if (this.sfxEnabled) this.audio.playError();
                Haptics.error();
                this.cells[idx].classList.add('shake');
                setTimeout(() => this.cells[idx].classList.remove('shake'), 400);
            }
            return;
        }

        this._placeMove(idx, this.currentPlayer);

        const result = this._checkResult();
        if (result) {
            this._endGame(result);
            return;
        }

        // Switch player
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        this._updateTurnIndicator();

        // AI turn
        if (this.gameMode === 'ai' && this.currentPlayer === 'O' && this.isActive) {
            this.isActive = false;
            this._showAIThinking();
            const delay = 400 + Math.random() * 600;
            setTimeout(() => {
                this._hideAIThinking();
                const aiIdx = this.ai.getMove(this.board);
                if (aiIdx >= 0) {
                    this.isActive = true;
                    this._placeMove(aiIdx, 'O');
                    const res = this._checkResult();
                    if (res) {
                        this._endGame(res);
                        return;
                    }
                    this.currentPlayer = 'X';
                    this._updateTurnIndicator();
                    this.isActive = true;
                }
            }, delay);
        }
    }

    _placeMove(idx, player) {
        this.board[idx] = player;
        this.moveHistory.push({ idx, player });

        const cell = this.cells[idx];
        cell.classList.add(player.toLowerCase(), 'animate-place');

        // SVG X or O with draw animation
        if (player === 'X') {
            cell.innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke-width="10" stroke-linecap="round">
                <path d="M 25 25 L 75 75" stroke-dasharray="71" stroke-dashoffset="71"><animate attributeName="stroke-dashoffset" from="71" to="0" dur="0.35s" fill="freeze"/></path>
                <path d="M 75 25 L 25 75" stroke-dasharray="71" stroke-dashoffset="71"><animate attributeName="stroke-dashoffset" from="71" to="0" dur="0.35s" begin="0.15s" fill="freeze"/></path>
            </svg>`;
        } else {
            cell.innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke-width="10" stroke-linecap="round">
                <circle cx="50" cy="50" r="28" stroke-dasharray="176" stroke-dashoffset="176"><animate attributeName="stroke-dashoffset" from="176" to="0" dur="0.4s" fill="freeze"/></circle>
            </svg>`;
        }

        if (this.sfxEnabled) {
            player === 'X' ? this.audio.playMoveX() : this.audio.playMoveO();
        }
        Haptics.move();
    }

    _checkResult() {
        // Check win
        for (const [a, b, c] of TicTacToeAI.LINES) {
            if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
                return { type: 'win', winner: this.board[a], line: [a, b, c] };
            }
        }
        // Check draw
        if (!this.board.includes(null)) return { type: 'draw' };
        return null;
    }

    _endGame(result) {
        this.isActive = false;
        this._stopTimer();

        if (result.type === 'win') {
            const w = result.winner;
            this.scores[w]++;

            // Highlight winning cells
            result.line.forEach(i => this.cells[i].classList.add('winning'));

            // Update streak
            if (this.lastWinner === w) {
                this.streak++;
            } else {
                this.streak = 1;
                this.lastWinner = w;
            }

            const winText = (this.gameMode === 'ai' && w === 'O') ? '🤖 AI Wins!' : `🏆 Player ${w} Wins!`;
            this.turnEl.textContent = winText;
            this.turnEl.className = 'turn-indicator win';

            if (this.sfxEnabled) this.audio.playWin();
            Haptics.win();

            // Celebration particles
            const boardRect = document.getElementById('board').getBoundingClientRect();
            const cx = boardRect.left + boardRect.width / 2;
            const cy = boardRect.top + boardRect.height / 2;
            this.particles.burst(cx, cy, 50);
            setTimeout(() => this.particles.confetti(40), 300);
        } else {
            this.scores.ties++;
            this.streak = 0;
            this.lastWinner = null;
            this.turnEl.textContent = '🤝 Draw!';
            this.turnEl.className = 'turn-indicator draw-state';

            if (this.sfxEnabled) this.audio.playDraw();
            Haptics.draw();
        }

        this._updateScores();
        this._saveSettings();
    }

    resetGame() {
        this.board.fill(null);
        this.currentPlayer = 'X';
        this.moveHistory = [];

        this.cells.forEach(cell => {
            cell.innerHTML = '';
            cell.className = 'cell';
        });

        this.turnEl.textContent = "Player X's Turn";
        this.turnEl.className = 'turn-indicator x-turn';
        this._hideAIThinking();

        this.isActive = true;
        this._startTimer();

        if (this.sfxEnabled) {
            this.audio.init();
            this.audio.playStart();
        }
    }

    // ── Timer ─────────────────────────────────────
    _startTimer() {
        this._stopTimer();
        this.timerSeconds = 0;
        this._updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this._updateTimerDisplay();
        }, 1000);
    }

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _updateTimerDisplay() {
        const m = String(Math.floor(this.timerSeconds / 60)).padStart(2, '0');
        const s = String(this.timerSeconds % 60).padStart(2, '0');
        this.timerEl.textContent = `${m}:${s}`;
    }

    // ── UI Updates ────────────────────────────────
    _updateTurnIndicator() {
        if (this.gameMode === 'ai' && this.currentPlayer === 'O') {
            this.turnEl.textContent = "🤖 AI's Turn";
            this.turnEl.className = 'turn-indicator o-turn';
        } else {
            this.turnEl.textContent = `Player ${this.currentPlayer}'s Turn`;
            this.turnEl.className = `turn-indicator ${this.currentPlayer.toLowerCase()}-turn`;
        }
    }

    _updateScores() {
        ['X', 'O', 'ties'].forEach(key => {
            const el = document.getElementById(`score-${key === 'ties' ? 'ties' : key.toLowerCase()}`);
            if (el.textContent !== String(this.scores[key])) {
                el.textContent = this.scores[key];
                el.classList.add('bump');
                setTimeout(() => el.classList.remove('bump'), 400);
            }
        });
        this.streakEl.textContent = this.streak;
    }

    _updateLabels() {
        const p2Label = document.querySelector('.score-box.p2 .label');
        if (this.gameMode === 'ai') {
            p2Label.textContent = 'AI (O)';
        } else {
            p2Label.textContent = 'Player O';
        }
    }

    _showAIThinking() {
        this.aiThinkingEl.classList.add('active');
    }

    _hideAIThinking() {
        this.aiThinkingEl.classList.remove('active');
    }

    // ── Persistence ───────────────────────────────
    _saveSettings() {
        const data = {
            scores: this.scores,
            streak: this.streak,
            lastWinner: this.lastWinner,
            gameMode: this.gameMode,
            difficulty: this.ai.difficulty,
            sfxEnabled: this.sfxEnabled,
            musicEnabled: this.musicEnabled,
            volume: this.audio.volume,
            theme: document.body.className,
        };
        try { localStorage.setItem('gridmind_v2', JSON.stringify(data)); } catch(e) {}
    }

    _loadSettings() {
        try {
            const raw = localStorage.getItem('gridmind_v2');
            if (!raw) return;
            const data = JSON.parse(raw);

            if (data.scores) this.scores = data.scores;
            if (data.streak !== undefined) this.streak = data.streak;
            if (data.lastWinner !== undefined) this.lastWinner = data.lastWinner;
            if (data.gameMode) {
                this.gameMode = data.gameMode;
                document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === data.gameMode));
                document.getElementById('ai-diff-group').style.display = data.gameMode === 'ai' ? 'block' : 'none';
            }
            if (data.difficulty) {
                this.ai.difficulty = data.difficulty;
                document.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('active', b.dataset.diff === data.difficulty));
            }
            if (data.sfxEnabled !== undefined) {
                this.sfxEnabled = data.sfxEnabled;
                document.getElementById('sfx-toggle').checked = data.sfxEnabled;
            }
            if (data.musicEnabled !== undefined) {
                this.musicEnabled = data.musicEnabled;
                document.getElementById('music-toggle').checked = data.musicEnabled;
            }
            if (data.volume !== undefined) {
                this.audio.volume = data.volume;
                const pct = Math.round(data.volume * 100);
                document.getElementById('volume-slider').value = pct;
                document.getElementById('volume-value').textContent = pct + '%';
            }
            if (data.theme) {
                document.body.className = data.theme;
                const themeName = data.theme.replace('theme-', '');
                document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === themeName));
            }

            this._updateScores();
            this._updateLabels();
        } catch(e) {}
    }
}

// ── Initialize ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => new GridMindGame());