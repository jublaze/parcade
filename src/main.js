import './style.css';
import { createGameState, pauseGame, queueDirection, restartGame, startGame, tick, TICK_MS } from './game.js';
import { mountMaze } from './maze/mount.js';
import { mountHolm } from './holm/mount.js';
import { mountMath } from './math-ladder/mount.js';
import { mountIlluminate } from './illuminate/mount.js';
import { mountSettingsDialog, mountSettingsNotice, readSavedConfig, snapshot, writeSavedConfig } from './settings-core.js';
import { CLASSIC_FIELDS, CLASSIC_PRESETS, CLASSIC_SOURCE, validateClassicConfig } from './settings.js';

const app = document.querySelector('#app');
const bestKey = 'parcade.snake.best.v1';
let best = readBest();
let classicStorageAvailable = true;
let classicConfig = CLASSIC_SOURCE;
let state = null;
let timer = null;
let lastAnnouncement = '';

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#home" aria-label="Parcade home"><span class="brand-mark">P</span><span>PARCADE</span></a>
      <span class="top-note"><span class="online-dot"></span> OPEN FOR PLAY</span>
    </header>
    <section id="home" class="home-view" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow"><span>01</span> THE POCKET ARCADE</p>
        <h1 id="home-title">Small games.<br><span>Big energy.</span></h1>
        <p class="hero-sub">A tiny corner of the internet for the joy of one more round.</p>
      </div>
      <div class="arcade-grid">
        <article class="game-card snake-card">
          <div class="card-art" aria-hidden="true">
            <span class="art-spark spark-a">✳</span><span class="art-spark spark-b">✦</span>
            <div class="mini-board"><i></i><i></i><i></i><b></b><em></em><span>↗</span></div>
            <span class="art-label">NO. 01</span>
          </div>
          <div class="card-info"><div><p class="card-kicker">THE CLASSIC, RECOILED</p><h2>Snake</h2><p class="card-copy">One snack at a time. Try not to bite your own tail.</p></div><button class="play-button" id="open-snake">Play Snake <span aria-hidden="true">↗</span></button></div>
        </article>
        <article class="game-card maze-card">
          <div class="maze-card-art" aria-hidden="true"><div class="maze-art-grid"><i></i><i></i><i></i><i></i><b></b><em></em><span>↗</span></div><small>LEVEL 01</small></div>
          <div class="maze-card-info"><div><p class="card-kicker">A LONG WAY HOME</p><h2>Snake Maze</h2><p class="card-copy">Ten links. Fifty columns. Watch for traps.</p></div><button class="play-button" id="open-maze">Play Maze <span aria-hidden="true">↗</span></button></div>
        </article>
        <article class="game-card maze-card holm-card"><div class="maze-card-art holm-card-art" aria-hidden="true"><div class="holm-card-mark">⌁</div><small>120 SECONDS</small></div><div class="maze-card-info"><div><p class="card-kicker">A RUNNER’S JOURNEY</p><h2>Snakeholm</h2><p class="card-copy">A living maze, a dwindling population, and a name to remember.</p></div><button class="play-button" id="open-holm">Play Snakeholm <span aria-hidden="true">↗</span></button></div></article>
        <article class="game-card math-card"><div class="math-card-art" aria-hidden="true"><div class="math-card-ladder"><i></i><i></i><i></i><i></i><i></i><i></i></div><span>6 RUNG CHALLENGE</span></div><div class="maze-card-info"><div><p class="card-kicker">A QUICK CLIMB</p><h2>Math Ladder</h2><p class="card-copy">One answer at a time. Keep your cool and climb to the top.</p></div><button class="play-button" id="open-math">Play Math Ladder <span aria-hidden="true">↗</span></button></div></article>
        <article class="game-card illuminate-card"><div class="illuminate-card-art" aria-hidden="true"><div class="il-card-orbit"><i>?</i><b></b><span></span></div><small>LOCAL QUIZ STUDIO</small></div><div class="maze-card-info"><div><p class="card-kicker">YOUR KNOWLEDGE, LIT</p><h2>Illuminate Quiz</h2><p class="card-copy">Import a numeric quiz, work at your pace, and see what you know.</p></div><button class="play-button" id="open-illuminate">Play Illuminate <span aria-hidden="true">↗</span></button></div></article>
      </div>
      <footer class="home-footer"><span>MADE FOR THE “ONE MORE GAME” MOMENT</span><span>© PARCADE ’26</span></footer>
    </section>
    <section id="game" class="game-view" aria-label="Snake game" hidden>
      <div class="game-heading"><button class="back-button" id="back-home"><span aria-hidden="true">←</span> ARCADE</button><div class="game-title"><span class="title-dot"></span><h1>SNAKE</h1><span class="title-sub">NO. 01 / CLASSIC</span></div><div class="heading-best">BEST <strong id="best-heading">${best}</strong></div></div>
      <div class="play-layout">
        <section class="play-panel" aria-label="Game board and controls">
          <div class="hud"><div><span class="hud-label">SCORE</span><strong id="score">000</strong></div><div class="status-badge"><span class="status-dot"></span><span id="status-text">READY WHEN YOU ARE</span></div><div class="hud-best"><span class="hud-label">BEST</span><strong id="best-score">${best}</strong></div></div>
          <div class="board-wrap"><canvas id="board" width="600" height="600" role="img" aria-label="Snake game board, ready to start"></canvas><div id="game-overlay" class="game-overlay"><div class="overlay-stamp">✳</div><p class="overlay-kicker">YOUR MOVE</p><h2 id="overlay-title">Ready,<br>player one?</h2><p id="overlay-copy">Find the snacks. Mind the walls.</p><button id="start-button" class="primary-button">Start game <span aria-hidden="true">→</span></button></div></div>
          <div class="board-foot"><span><i class="keycap">⏎</i> SPACE TO START / PAUSE</span><span class="config-summary" id="classic-config-summary">20 × 20 · 120 ms</span></div>
        </section>
        <aside class="side-panel">
          <div class="side-card score-card"><p class="side-label">YOUR PERSONAL BEST</p><div class="best-number"><span id="best-large">${best}</span><span class="best-star">✳</span></div><p class="side-hint">Every run counts.</p></div>
          <div class="side-card controls-card"><p class="side-label">HOW TO PLAY</p><p class="control-intro">Eat the dots. Grow your tail. Stay on the board.</p><div class="key-hint"><div class="key-grid" aria-hidden="true"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div><span>ARROWS OR WASD<br><small>to steer</small></span></div><div class="key-hint"><kbd class="wide-key">R</kbd><span>RESTART<br><small>fresh start, same best</small></span></div><p class="pause-note"><span>Ⅱ</span> Leaving the tab pauses the game.</p></div>
          <button id="restart-button" class="quiet-button">↻ <span>Restart run</span><kbd>R</kbd></button><button id="settings-button" class="settings-launch">⚙ Game settings</button>
        </aside>
      </div>
      <div class="touch-controls" aria-label="Touch game controls"><p class="mobile-help">ARROWS / WASD STEER <span>·</span> SPACE PAUSES <span>·</span> R RESTARTS</p><button data-direction="up" aria-label="Move up">↑</button><div><button data-direction="left" aria-label="Move left">←</button><button data-direction="down" aria-label="Move down">↓</button><button data-direction="right" aria-label="Move right">→</button></div><div class="touch-actions"><button id="touch-start">Start / pause</button><button id="touch-restart">Restart</button><button id="touch-settings">Settings</button><button id="touch-home">Arcade</button></div></div>
      <div id="live-status" class="sr-only" role="status" aria-live="polite"></div>
    </section>
    <section id="maze-view" class="maze-view" aria-label="Snake Maze" hidden></section>
    <section id="holm-view" aria-label="Snakeholm" hidden></section>
    <section id="math-view" aria-label="Math Ladder" hidden></section>
    <section id="illuminate-view" aria-label="Illuminate Quiz" hidden></section>
  </main>`;

const homeView = document.querySelector('#home');
const gameView = document.querySelector('#game');
const mazeView = document.querySelector('#maze-view');
const holmView = document.querySelector('#holm-view');
const mathView = document.querySelector('#math-view');
const illuminateView = document.querySelector('#illuminate-view');
const canvas = document.querySelector('#board');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#game-overlay');
const liveStatus = document.querySelector('#live-status');
const classicSettings = mountSettingsDialog(gameView, {
  title: 'Classic Snake', presets: CLASSIC_PRESETS, fields: CLASSIC_FIELDS, validate: validateClassicConfig,
  onApply: (config) => { classicConfig = snapshot(config); classicStorageAvailable = writeSavedConfig('parcade.settings.classic.v1', classicConfig); classicSettingsNotice[ classicStorageAvailable ? 'clear' : 'show' ](); cleanup(); state = createGameState({ best, config: classicConfig }); render(); document.querySelector('#start-button').focus(); },
  onCancel: () => { if (state) render(); },
});
const savedClassic = readSavedConfig('parcade.settings.classic.v1', CLASSIC_SOURCE, validateClassicConfig);
classicConfig = savedClassic.config;
classicStorageAvailable = savedClassic.available;
const classicSettingsNotice = mountSettingsNotice(gameView, classicStorageAvailable);
let disposeMaze = null;
let disposeHolm = null;
let disposeMath = null;
let disposeIlluminate = null;

function readBest() {
  try {
    const value = Number(localStorage.getItem(bestKey));
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch { return 0; }
}

function saveBest(value) {
  try { localStorage.setItem(bestKey, String(value)); } catch { /* Best remains available for this session. */ }
}

function setView(name) {
  homeView.hidden = name !== 'home';
  gameView.hidden = name !== 'game';
  if (name === 'home') {
    cleanup();
    state = null;
    history.replaceState(null, '', '#home');
    window.scrollTo(0, 0);
    document.querySelector('#open-snake').focus();
  } else {
    history.replaceState(null, '', '#snake');
    window.scrollTo(0, 0);
  }
}

function closeMaze() {
  disposeMaze?.();
  disposeMaze = null;
  mazeView.hidden = true;
  homeView.hidden = false;
  gameView.hidden = true;
  history.replaceState(null, '', '#home');
  window.scrollTo(0, 0);
  document.querySelector('#open-maze').focus();
}

function closeHolm() {
  disposeHolm?.(); disposeHolm = null; holmView.hidden = true; homeView.hidden = false; gameView.hidden = true;
  history.replaceState(null, '', '#home'); window.scrollTo(0, 0); document.querySelector('#open-holm').focus();
}

function closeMath() {
  disposeMath?.(); disposeMath = null; mathView.hidden = true; homeView.hidden = false; gameView.hidden = true;
  history.replaceState(null, '', '#home'); window.scrollTo(0, 0); document.querySelector('#open-math').focus();
}

function closeIlluminate() {
  disposeIlluminate?.(); disposeIlluminate = null; illuminateView.hidden = true; homeView.hidden = false; gameView.hidden = true;
  history.replaceState(null, '', '#home'); window.scrollTo(0, 0); document.querySelector('#open-illuminate').focus();
}

function openHolm() {
  cleanup(); state = null; disposeMaze?.(); disposeMaze = null; disposeMath?.(); disposeMath = null; disposeIlluminate?.(); disposeIlluminate = null; illuminateView.hidden = true; mathView.hidden = true; mazeView.hidden = true;
  homeView.hidden = true; gameView.hidden = true; holmView.hidden = false;
  history.replaceState(null, '', '#holm'); window.scrollTo(0, 0); disposeHolm?.();
  disposeHolm = mountHolm(holmView, { onHome: closeHolm });
}

function openMaze() {
  cleanup(); disposeHolm?.(); disposeHolm = null; disposeMath?.(); disposeMath = null; disposeIlluminate?.(); disposeIlluminate = null; illuminateView.hidden = true; mathView.hidden = true; holmView.hidden = true;
  state = null;
  homeView.hidden = true;
  gameView.hidden = true;
  mazeView.hidden = false;
  history.replaceState(null, '', '#maze');
  window.scrollTo(0, 0);
  disposeMaze?.();
  disposeMaze = mountMaze(mazeView, { onHome: closeMaze });
}

function openMath() {
  cleanup(); state = null; disposeMaze?.(); disposeMaze = null; disposeHolm?.(); disposeHolm = null; disposeIlluminate?.(); disposeIlluminate = null;
  mazeView.hidden = true; holmView.hidden = true; illuminateView.hidden = true; homeView.hidden = true; gameView.hidden = true; mathView.hidden = false;
  history.replaceState(null, '', '#math'); window.scrollTo(0, 0); disposeMath?.();
  disposeMath = mountMath(mathView, { onHome: closeMath });
}

function openIlluminate() {
  cleanup(); state = null; disposeMaze?.(); disposeMaze = null; disposeHolm?.(); disposeHolm = null; disposeMath?.(); disposeMath = null;
  mazeView.hidden = true; holmView.hidden = true; mathView.hidden = true; homeView.hidden = true; gameView.hidden = true; illuminateView.hidden = false;
  history.replaceState(null, '', '#illuminate'); window.scrollTo(0, 0); disposeIlluminate?.();
  disposeIlluminate = mountIlluminate(illuminateView, { onHome: closeIlluminate });
}

function cleanup() {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

function updateBest(value) {
  best = value;
  document.querySelector('#best-heading').textContent = value;
  document.querySelector('#best-score').textContent = value;
  document.querySelector('#best-large').textContent = value;
  saveBest(value);
}

function statusName(status) {
  return ({ ready: 'READY WHEN YOU ARE', running: 'IN THE ZONE', paused: 'TAKE A BREATHER', lost: 'RUN OVER', won: 'BOARD CLEARED' })[status];
}

function announce(message) {
  if (message && message !== lastAnnouncement) liveStatus.textContent = message;
  lastAnnouncement = message;
}

function draw() {
  if (!state) return;
  const size = canvas.width;
  const boardSize = state.boardSize ?? 20;
  const cell = size / boardSize;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#171d39';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(238,242,255,.045)';
  ctx.lineWidth = 1;
  for (let i = 1; i < boardSize; i += 1) {
    const line = i * cell;
    ctx.beginPath(); ctx.moveTo(line, 0); ctx.lineTo(line, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, line); ctx.lineTo(size, line); ctx.stroke();
  }
  if (state.food) {
    const cx = (state.food.x + .5) * cell;
    const cy = (state.food.y + .5) * cell;
    ctx.shadowColor = '#ff6f68'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff746b'; ctx.beginPath(); ctx.arc(cx, cy, cell * .29, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#ffd08e'; ctx.beginPath(); ctx.arc(cx - cell * .08, cy - cell * .09, cell * .07, 0, Math.PI * 2); ctx.fill();
  }
  state.snake.forEach((part, index) => {
    const inset = index === 0 ? cell * .09 : cell * .13;
    const x = part.x * cell + inset; const y = part.y * cell + inset; const side = cell - inset * 2;
    ctx.fillStyle = index === 0 ? '#d5ff58' : index < 3 ? '#b5ed50' : '#79c94d';
    ctx.shadowColor = index === 0 ? 'rgba(213,255,88,.3)' : 'transparent'; ctx.shadowBlur = index === 0 ? 16 : 0;
    roundedRect(ctx, x, y, side, side, cell * .23); ctx.fill();
    if (index === 0) {
      ctx.shadowBlur = 0; ctx.fillStyle = '#222b31';
      const eyes = state.direction === 'right' ? [[.68,.34],[.68,.66]] : state.direction === 'left' ? [[.32,.34],[.32,.66]] : state.direction === 'up' ? [[.34,.32],[.66,.32]] : [[.34,.68],[.66,.68]];
      eyes.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(x + side * ex, y + side * ey, cell * .055, 0, Math.PI * 2); ctx.fill(); });
    }
  });
  ctx.shadowBlur = 0;
  canvas.setAttribute('aria-label', `Snake board, ${state.status}, score ${state.score}, ${state.snake.length} cells`);
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath(); context.roundRect(x, y, width, height, radius);
}

function render() {
  if (!state) return;
  const oldStatus = render.previousStatus;
  document.querySelector('#score').textContent = String(state.score).padStart(3, '0');
  document.querySelector('#classic-config-summary').textContent = `${state.boardSize} × ${state.boardSize} · ${state.tickMs} ms${state.configPreset === 'source' ? ' · SOURCE' : ` · ${state.configPreset.toUpperCase()}`}`;
  document.querySelector('#status-text').textContent = statusName(state.status);
  document.querySelector('.status-badge').dataset.state = state.status;
  updateBest(state.best);
  const messages = {
    ready: ['YOUR MOVE', 'Ready,<br>player one?', 'Find the snacks. Mind the walls.', 'Start game'],
    paused: ['PAUSE MODE', 'Take a<br>breather.', 'Your run is right where you left it.', 'Resume game'],
    lost: ['THAT’S A WRAP', 'One more<br>round?', `You scored ${state.score}. The arcade is always open.`, 'Play again'],
    won: ['PERFECT RUN', 'Board<br>cleared!', 'Every square. Every snack. Nicely done.', 'Play again'],
  };
  if (state.status === 'running') overlay.hidden = true;
  else {
    const [kicker, title, copy, button] = messages[state.status];
    overlay.hidden = false;
    document.querySelector('.overlay-kicker').textContent = kicker;
    document.querySelector('#overlay-title').innerHTML = title;
    document.querySelector('#overlay-copy').textContent = copy;
    document.querySelector('#start-button').innerHTML = `${button} <span aria-hidden="true">→</span>`;
  }
  if (oldStatus !== state.status) announce(`${statusName(state.status)}. Score ${state.score}.`);
  render.previousStatus = state.status;
  draw();
}

function armTimer() {
  cleanup();
  timer = window.setInterval(() => {
    if (!state || state.status !== 'running') { cleanup(); return; }
    const previousBest = state.best;
    state = tick(state);
    if (state.best > previousBest) announce(`New personal best: ${state.best}.`);
    render();
    if (state.status !== 'running') cleanup();
  }, state.tickMs ?? TICK_MS);
}

function startOrPause() {
  if (!state) return;
  if (state.status === 'running') { state = pauseGame(state); cleanup(); }
  else if (state.status === 'ready' || state.status === 'paused') { state = startGame(state); armTimer(); }
  else if (state.status === 'lost' || state.status === 'won') { restart(); state = startGame(state); armTimer(); }
  else return;
  render();
}

function restart() {
  if (!state) return;
  cleanup(); state = restartGame(state, { best }); render();
}

function openGame() {
  state = createGameState({ best, config: classicConfig });
  setView('game'); render();
  document.querySelector('#start-button').focus();
}

function openClassicSettings() {
  if (!state) return;
  if (state.status === 'running') { state = pauseGame(state); cleanup(); render(); }
  classicSettings.open(classicConfig, { storageAvailable: classicStorageAvailable });
}

function returnHome() { if (state?.status === 'running') state = pauseGame(state); setView('home'); }

document.querySelector('#open-snake').addEventListener('click', openGame);
document.querySelector('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  if (!mathView.hidden) closeMath();
  else if (!illuminateView.hidden) closeIlluminate();
  else if (!mazeView.hidden) closeMaze();
  else if (!holmView.hidden) closeHolm();
  else returnHome();
});
document.querySelector('#open-maze').addEventListener('click', openMaze);
document.querySelector('#open-holm').addEventListener('click', openHolm);
document.querySelector('#open-math').addEventListener('click', openMath);
document.querySelector('#open-illuminate').addEventListener('click', openIlluminate);
document.querySelector('#back-home').addEventListener('click', returnHome);
document.querySelector('#touch-home').addEventListener('click', returnHome);
document.querySelector('#settings-button').addEventListener('click', openClassicSettings);
document.querySelector('#touch-settings').addEventListener('click', openClassicSettings);
document.querySelector('#start-button').addEventListener('click', startOrPause);
document.querySelector('#touch-start').addEventListener('click', startOrPause);
document.querySelector('#restart-button').addEventListener('click', restart);
document.querySelector('#touch-restart').addEventListener('click', restart);
document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => {
  if (state) state = queueDirection(state, button.dataset.direction);
}));

window.addEventListener('keydown', (event) => {
  if (!state) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('.settings-dialog')) return;
  if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (target?.closest('button,a,[role="button"]') && [' ', 'Enter'].includes(event.key)) return;
  if (event.repeat) return;
  const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowRight: 'right', d: 'right', D: 'right', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left' };
  const direction = keys[event.key];
  if (direction && state.status === 'running') {
    event.preventDefault(); state = queueDirection(state, direction); return;
  }
  if (event.key === ' ') { event.preventDefault(); startOrPause(); }
  else if (event.key === 'r' || event.key === 'R') { event.preventDefault(); restart(); }
  else if (event.key === 'Escape') { event.preventDefault(); returnHome(); }
});

function pauseForLeaving() {
  if (state?.status === 'running') { state = pauseGame(state); cleanup(); render(); }
}
window.addEventListener('blur', pauseForLeaving);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseForLeaving(); });

if (location.hash === '#snake') openGame();
else if (location.hash === '#maze') openMaze();
else if (location.hash === '#holm') openHolm();
else if (location.hash === '#math') openMath();
else if (location.hash === '#illuminate') openIlluminate();
