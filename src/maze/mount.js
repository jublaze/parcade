import './maze.css';
import { mountSettingsDialog, mountSettingsNotice, readSavedConfig, snapshot, writeSavedConfig } from '../settings-core.js';
import { MAZE_FIELDS, MAZE_PRESETS, MAZE_SOURCE, validateMazeConfig } from '../settings.js';
import {
  MAZE_HEIGHT, MAZE_WIDTH, PERSIST_TRAPS, REFRESH_TRAPS,
  createMazeState, mazeTickMs, pauseMaze,
  resumeMaze, setMazeDirection, startMaze, tickMaze,
} from './game.js';

const modeName = (mode) => mode === PERSIST_TRAPS ? 'Persist + add' : 'Refresh each level';
const directionKeys = {
  ArrowUp: 'up', w: 'up', W: 'up', ArrowRight: 'right', d: 'right', D: 'right',
  ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left',
};

export function mountMaze(root, { onHome }) {
  let state = null;
  const savedSettings = readSavedConfig('parcade.settings.maze.v1', MAZE_SOURCE, validateMazeConfig);
  let config = savedSettings.config;
  let storageAvailable = savedSettings.available;
  let selectedMode = config.trapMode;
  let menuOpen = true;
  let timeout = null;
  let lastAnnouncement = '';
  let zoom = 1;

  root.innerHTML = `
    <div class="maze-shell">
      <header class="maze-heading">
        <button class="maze-back" id="maze-home"><span aria-hidden="true">←</span> ARCADE</button>
        <div class="maze-title"><span class="maze-title-dot"></span><h1>SNAKE MAZE</h1><span class="maze-subtitle">NO. 02 / LONG RUN</span></div>
        <span class="maze-level-label" id="maze-heading-level">LEVEL 01</span>
      </header>
      <section id="maze-mode-screen" class="maze-mode-screen" aria-labelledby="maze-mode-title">
        <div class="maze-mode-copy"><p class="eyebrow"><span>SETTINGS</span> PICK YOUR TRAP STORY</p><h2 id="maze-mode-title" tabindex="-1">The maze<br>has a memory.</h2><p>Fifty columns. Ten links. Choose how the danger returns.</p></div>
        <div class="maze-mode-options" role="group" aria-label="Trap layout mode">
          <button class="maze-mode-choice" data-maze-mode="refresh" aria-pressed="true"><span class="mode-icon mode-refresh" aria-hidden="true">↻</span><span><strong>Refresh each level</strong><small>A new set of traps every run across.</small></span><i aria-hidden="true">●</i></button>
          <button class="maze-mode-choice" data-maze-mode="persist" aria-pressed="false"><span class="mode-icon mode-persist" aria-hidden="true">＋</span><span><strong>Persist + add</strong><small>Keep old traps. Add three more.</small></span><i aria-hidden="true">●</i></button>
        </div>
        <div class="maze-menu-actions"><p id="maze-menu-note">Three traps. Columns 1–5 stay clear.</p><button class="settings-launch" id="maze-pregame-settings">⚙ Settings</button><button class="primary-button" id="maze-start-run">Start Maze <span aria-hidden="true">→</span></button><button class="maze-resume-button" id="maze-resume-current" hidden>Resume current run</button></div>
      </section>
      <section id="maze-game-screen" class="maze-layout" aria-label="Snake Maze game" hidden>
        <div class="maze-panel">
          <div class="maze-hud"><div class="maze-stat"><span>LEVEL</span><strong id="maze-level">01</strong></div><div class="maze-status" data-status="running"><span></span><b id="maze-status-text">IN THE MAZE</b></div><div class="maze-stat maze-speed"><span>STEP</span><strong id="maze-speed">80 ms</strong></div></div>
          <div class="maze-board-viewport" id="maze-board-viewport" tabindex="0" aria-label="Scrollable Snake Maze board">
            <canvas id="maze-board" width="1000" height="300" role="img" aria-label="Snake Maze board"></canvas>
            <div class="maze-overlay" id="maze-overlay" hidden><span class="maze-overlay-symbol">✳</span><p id="maze-overlay-kicker">LEVEL PAUSED</p><h2 id="maze-overlay-title">Take a<br>breather.</h2><p id="maze-overlay-copy">Your place is right where you left it.</p><button id="maze-overlay-action" class="primary-button">Resume <span aria-hidden="true">→</span></button></div>
          </div>
          <div class="maze-board-tools"><span>50 × 15 <i>·</i> FIXED LENGTH 10 <i>·</i> <b id="maze-trap-count">3 TRAPS</b></span><div class="maze-zoom" aria-label="Board zoom"><button id="maze-zoom-out" aria-label="Zoom out">−</button><button id="maze-fit" aria-label="Fit full board">FIT</button><button id="maze-zoom-in" aria-label="Zoom in">＋</button></div><span id="maze-mode-readout">REFRESH</span><span id="maze-config-summary" class="config-summary"></span></div>
        </div>
        <aside class="maze-side">
          <div class="maze-side-card maze-level-card"><p class="maze-side-label">KEEP MOVING</p><div class="maze-big-level"><span id="maze-side-level">01</span><i>✳</i></div><p id="maze-trap-note">Three traps ahead.</p></div>
          <div class="maze-side-card maze-howto"><p class="maze-side-label">HOW TO PLAY</p><p>Find the exit on the far right. The maze resets. Your ten-link tail comes with you.</p><div class="maze-key-hint"><span class="maze-key-grid"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>ARROWS / WASD<br><small>to steer</small></span></div><div class="maze-key-hint"><kbd class="maze-key-wide">SPACE</kbd><span>PAUSE / RESUME<br><small>R restarts this mode</small></span></div><p class="maze-pause-note">Leaving the tab pauses your run.</p></div>
          <div class="maze-side-actions"><button id="maze-pause" class="maze-action-button">Ⅱ <span>Pause run</span><kbd>SPACE</kbd></button><button id="maze-settings" class="maze-action-button">⚙ <span>Trap mode</span><kbd>MODE</kbd></button><button id="maze-game-settings" class="maze-action-button">⚙ <span>Game settings</span></button><button id="maze-restart" class="maze-action-button">↻ <span>Restart run</span><kbd>R</kbd></button></div>
        </aside>
        <div class="maze-touch-controls" aria-label="Touch game controls"><p>ARROWS / WASD STEER <span>·</span> SPACE PAUSES</p><button data-maze-direction="up" aria-label="Move up">↑</button><div class="maze-dpad-row"><button data-maze-direction="left" aria-label="Move left">←</button><button data-maze-direction="down" aria-label="Move down">↓</button><button data-maze-direction="right" aria-label="Move right">→</button></div><div class="maze-touch-actions"><button id="maze-touch-pause">Pause</button><button id="maze-touch-settings">Trap mode</button><button id="maze-touch-game-settings">Settings</button><button id="maze-touch-restart">Restart</button><button id="maze-touch-home">Arcade</button></div></div>
      </section>
      <div id="maze-live" class="sr-only" role="status" aria-live="polite"></div>
    </div>`;

  const modeScreen = root.querySelector('#maze-mode-screen');
  const gameScreen = root.querySelector('#maze-game-screen');
  const canvas = root.querySelector('#maze-board');
  const context = canvas.getContext('2d');
  const viewport = root.querySelector('#maze-board-viewport');
  const overlay = root.querySelector('#maze-overlay');
  const live = root.querySelector('#maze-live');
  const settingsDialog = mountSettingsDialog(root, {
    title: 'Snake Maze', presets: MAZE_PRESETS, fields: MAZE_FIELDS, validate: validateMazeConfig,
    onApply: (next) => { config = snapshot(next); storageAvailable = writeSavedConfig('parcade.settings.maze.v1', config); settingsNotice[storageAvailable ? 'clear' : 'show'](); selectedMode = config.trapMode; state = createMazeState({ trapMode: selectedMode, config }); menuOpen = true; renderModeMenu(); render(); root.querySelector('#maze-start-run').focus(); },
    onCancel: () => { if (state) { renderModeMenu(); render(); } },
  });
  const settingsNotice = mountSettingsNotice(root, storageAvailable);

  function clearTimer() {
    if (timeout !== null) window.clearTimeout(timeout);
    timeout = null;
  }

  function announce(message) {
    if (message && message !== lastAnnouncement) live.textContent = message;
    lastAnnouncement = message;
  }

  function renderModeMenu() {
    modeScreen.hidden = !menuOpen;
    gameScreen.hidden = menuOpen;
    root.querySelectorAll('[data-maze-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mazeMode === selectedMode));
    });
    root.querySelector('#maze-resume-current').hidden = state?.status !== 'paused';
    root.querySelector('#maze-start-run').textContent = state ? 'Start new run →' : 'Start Maze →';
    const trapCount = config.trapsPerLevel;
    const trapText = `${trapCount} trap${trapCount === 1 ? '' : 's'}`;
    root.querySelector('[data-maze-mode="refresh"] small').textContent = trapCount ? `Replace the set with ${trapText} each level.` : 'Clear the set; place no new traps.';
    root.querySelector('[data-maze-mode="persist"] small').textContent = trapCount ? `Keep old traps. Add ${trapText} each level.` : 'Keep old traps. Add no new traps.';
    if (state?.status === 'dead') root.querySelector('#maze-menu-note').textContent = `Choose a mode. ${trapCount} new traps per level; columns 1–5 stay clear.`;
    else if (state?.status === 'paused') root.querySelector('#maze-menu-note').textContent = `Current run paused · ${modeName(state.trapMode)} · ${trapText} per level.`;
    else root.querySelector('#maze-menu-note').textContent = `${trapCount} traps per level. Columns 1–5 stay clear.`;
  }

  function roundedRect(x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function drawBoard() {
    if (!state) return;
    const cell = canvas.width / MAZE_WIDTH;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#171d39';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(238,242,255,.075)';
    context.lineWidth = 1;
    for (let x = 0; x <= MAZE_WIDTH; x += 1) {
      context.beginPath(); context.moveTo(x * cell, 0); context.lineTo(x * cell, canvas.height); context.stroke();
    }
    for (let y = 0; y <= MAZE_HEIGHT; y += 1) {
      context.beginPath(); context.moveTo(0, y * cell); context.lineTo(canvas.width, y * cell); context.stroke();
    }
    context.fillStyle = 'rgba(213,255,88,.055)';
    context.fillRect(0, 0, SAFE_COLUMNS * cell, canvas.height);
    for (const trap of state.traps) {
      const inset = cell * .22;
      context.fillStyle = '#ff746b';
      context.shadowColor = 'rgba(255,116,107,.38)'; context.shadowBlur = 8;
      roundedRect(trap.x * cell + inset, trap.y * cell + inset, cell - inset * 2, cell - inset * 2, cell * .24);
      context.fill();
    }
    state.snake.forEach((part, index) => {
      if (part.x < 0 || part.x >= MAZE_WIDTH) return;
      const inset = index === 0 ? 2 : 3;
      const x = part.x * cell + inset; const y = part.y * cell + inset;
      context.shadowColor = index === 0 ? 'rgba(213,255,88,.35)' : 'transparent';
      context.shadowBlur = index === 0 ? 12 : 0;
      context.fillStyle = state.status === 'dead' ? '#ffc86b' : index === 0 ? '#d5ff58' : index < 4 ? '#b9ef54' : '#75c957';
      roundedRect(x, y, cell - inset * 2, cell - inset * 2, cell * .22);
      context.fill();
      if (index === 0) {
        context.shadowBlur = 0; context.fillStyle = '#25303a';
        context.beginPath(); context.arc(x + cell * .63, y + cell * .36, 1.2, 0, Math.PI * 2); context.fill();
        context.beginPath(); context.arc(x + cell * .63, y + cell * .64, 1.2, 0, Math.PI * 2); context.fill();
      }
    });
    context.shadowBlur = 0;
    canvas.setAttribute('aria-label', `Snake Maze board, level ${state.level}, ${state.status}, ten segments`);
  }

  const SAFE_COLUMNS = 5;

  function updateZoom() {
    if (!canvas || !viewport) return;
    canvas.style.width = zoom === 1 ? '100%' : `${Math.min(1000, Math.round(viewport.clientWidth * zoom))}px`;
  }

  function showOverlay() {
    const pauseButton = root.querySelector('#maze-pause');
    const touchPause = root.querySelector('#maze-touch-pause');
    pauseButton.innerHTML = state.status === 'paused' ? '▶ <span>Resume run</span><kbd>SPACE</kbd>' : 'Ⅱ <span>Pause run</span><kbd>SPACE</kbd>';
    touchPause.textContent = state.status === 'paused' ? 'Resume' : 'Pause';
    overlay.hidden = state.status === 'running' || state.status === 'ready';
    if (state.status === 'dead') {
      root.querySelector('#maze-overlay-kicker').textContent = 'RUN OVER';
      root.querySelector('#maze-overlay-title').innerHTML = 'Maze<br>ended.';
      root.querySelector('#maze-overlay-copy').textContent = `A ${state.deathReason} collision ended this run.`;
      root.querySelector('#maze-overlay-action').innerHTML = 'Choose trap mode <span aria-hidden="true">→</span>';
    } else if (state.status === 'paused') {
      root.querySelector('#maze-overlay-kicker').textContent = 'LEVEL PAUSED';
      root.querySelector('#maze-overlay-title').innerHTML = 'Take a<br>breather.';
      root.querySelector('#maze-overlay-copy').textContent = 'Your place is right where you left it.';
      root.querySelector('#maze-overlay-action').innerHTML = 'Resume <span aria-hidden="true">→</span>';
    }
  }

  function render() {
    if (!state) return;
    const statusText = ({ ready: 'READY', running: 'IN THE MAZE', paused: 'PAUSED', dead: 'RUN OVER' })[state.status];
    root.querySelector('#maze-level').textContent = String(state.level).padStart(2, '0');
    root.querySelector('#maze-side-level').textContent = String(state.level).padStart(2, '0');
    root.querySelector('#maze-heading-level').textContent = `LEVEL ${String(state.level).padStart(2, '0')}`;
    root.querySelector('#maze-speed').textContent = `${mazeTickMs(state.level, state.config)} ms`;
    root.querySelector('#maze-config-summary').textContent = `${state.config.preset.toUpperCase()} · ${state.config.startMs}/${state.config.floorMs} ms · ${state.config.trapsPerLevel} traps/level`;
    root.querySelector('#maze-trap-count').textContent = state.placementShortage > 0
      ? `${state.traps.length} TRAPS · ${state.placementShortage} SKIPPED`
      : `${state.traps.length} TRAPS`;
    root.querySelector('#maze-mode-readout').textContent = state.trapMode === PERSIST_TRAPS ? 'PERSIST + ADD' : 'REFRESH';
    root.querySelector('#maze-status-text').textContent = statusText;
    root.querySelector('.maze-status').dataset.status = state.status;
    root.querySelector('#maze-trap-note').textContent = state.placementShortage > 0
      ? `Only ${state.traps.length} traps fit. The maze is full.`
      : `${state.traps.length} trap${state.traps.length === 1 ? '' : 's'} on the board.`;
    showOverlay();
    drawBoard();
    if (state.status !== 'running') announce(`${statusText}. Level ${state.level}.`);
    else if (state.level !== render.previousLevel) announce(`Level ${state.level}.`);
    if (state.placementShortage > 0) announce(`Trap placement capped. ${state.placementShortage} could not fit.`);
    render.previousLevel = state.level;
  }

  function armTimer() {
    clearTimer();
    if (state?.status !== 'running') return;
    timeout = window.setTimeout(() => {
      timeout = null;
      if (state?.status !== 'running') return;
      const oldLevel = state.level;
      state = tickMaze(state);
      render();
      if (state.status === 'dead') {
        clearTimer();
        announce(`Run over. Collision with ${state.deathReason}.`);
      } else if (state.level !== oldLevel && state.placementShortage > 0) {
        announce(`Level ${state.level}. Trap placement capped.`);
      }
      armTimer();
    }, mazeTickMs(state.level, state.config));
  }

  function startNewRun(mode = selectedMode) {
    clearTimer();
    selectedMode = mode;
    config = snapshot({ ...config, trapMode: mode });
    storageAvailable = writeSavedConfig('parcade.settings.maze.v1', config);
    settingsNotice[storageAvailable ? 'clear' : 'show']();
    menuOpen = false;
    state = startMaze(createMazeState({ trapMode: selectedMode, config }));
    renderModeMenu();
    render();
    updateZoom();
    armTimer();
    root.querySelector('#maze-pause').focus();
  }

  function openModeMenu({ afterDeath = false } = {}) {
    clearTimer();
    if (state?.status === 'running') state = pauseMaze(state);
    if (afterDeath) selectedMode = config.trapMode;
    menuOpen = true;
    renderModeMenu();
    if (state) render();
    root.querySelector(`[data-maze-mode="${selectedMode}"]`).focus();
  }

  function resumeCurrentRun() {
    if (state?.status !== 'paused') return;
    state = resumeMaze(state);
    menuOpen = false;
    renderModeMenu();
    render();
    armTimer();
    root.querySelector('#maze-pause').focus();
  }

  function togglePause() {
    if (!state) return;
    if (state.status === 'running') {
      clearTimer(); state = pauseMaze(state); render();
    } else if (state.status === 'paused') {
      menuOpen = false; state = resumeMaze(state); renderModeMenu(); render(); armTimer();
    } else if (state.status === 'dead') openModeMenu({ afterDeath: true });
  }

  function restart() {
    if (state?.status === 'dead') openModeMenu({ afterDeath: true });
    else startNewRun(selectedMode);
  }

  function chooseMode(mode) {
    if (!mode) return;
    selectedMode = mode;
    renderModeMenu();
  }

  function openSettings() {
    if (state?.status === 'running') { clearTimer(); state = pauseMaze(state); render(); }
    settingsDialog.open(config, { storageAvailable });
  }

  function returnHome() {
    onHome();
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    if (event.target instanceof Element && event.target.closest('.settings-dialog')) return;
    if (event.key === 'Escape') { event.preventDefault(); returnHome(); return; }
    const target = event.target instanceof Element ? event.target : null;
    const controlFocused = target?.closest('button, a, input, select, textarea, [contenteditable="true"]');
    if (menuOpen) {
      if (controlFocused) {
        if (target.closest('[data-maze-mode]') && ['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(event.key)) {
          event.preventDefault();
          chooseMode(selectedMode === REFRESH_TRAPS ? PERSIST_TRAPS : REFRESH_TRAPS);
          root.querySelector(`[data-maze-mode="${selectedMode}"]`).focus();
        }
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(event.key)) {
        event.preventDefault();
        chooseMode(selectedMode === REFRESH_TRAPS ? PERSIST_TRAPS : REFRESH_TRAPS);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        startNewRun(selectedMode);
      } else if (event.key === ' ') {
        event.preventDefault();
        if (state?.status === 'paused') resumeCurrentRun();
        else startNewRun(selectedMode);
      }
      return;
    }
    if (controlFocused && (event.key === 'Enter' || event.key === ' ')) return;
    if (directionKeys[event.key]) {
      if (state?.status === 'running') {
        event.preventDefault(); state = setMazeDirection(state, directionKeys[event.key]);
      }
      return;
    }
    if (event.key === ' ' && state?.status !== 'dead') { event.preventDefault(); togglePause(); }
    else if (event.key === 'r' || event.key === 'R') { event.preventDefault(); restart(); }
    else if ((event.key === 'Enter' || event.key === ' ') && state?.status === 'dead') { event.preventDefault(); openModeMenu({ afterDeath: true }); }
  }

  function onBlur() {
    if (state?.status === 'running') togglePause();
  }

  function onVisibilityChange() {
    if (document.hidden && state?.status === 'running') togglePause();
  }

  root.querySelector('#maze-home').addEventListener('click', returnHome);
  root.querySelectorAll('[data-maze-mode]').forEach((button) => button.addEventListener('click', () => chooseMode(button.dataset.mazeMode)));
  root.querySelector('#maze-start-run').addEventListener('click', () => startNewRun(selectedMode));
  root.querySelector('#maze-resume-current').addEventListener('click', resumeCurrentRun);
  root.querySelector('#maze-pause').addEventListener('click', togglePause);
  root.querySelector('#maze-touch-pause').addEventListener('click', togglePause);
  root.querySelector('#maze-settings').addEventListener('click', () => openModeMenu());
  root.querySelector('#maze-touch-settings').addEventListener('click', () => openModeMenu());
  root.querySelector('#maze-game-settings').addEventListener('click', openSettings);
  root.querySelector('#maze-touch-game-settings').addEventListener('click', openSettings);
  root.querySelector('#maze-pregame-settings').addEventListener('click', openSettings);
  root.querySelector('#maze-restart').addEventListener('click', restart);
  root.querySelector('#maze-touch-restart').addEventListener('click', restart);
  root.querySelector('#maze-touch-home').addEventListener('click', returnHome);
  root.querySelector('#maze-overlay-action').addEventListener('click', () => {
    if (state?.status === 'dead') openModeMenu({ afterDeath: true });
    else if (state?.status === 'paused') togglePause();
  });
  root.querySelectorAll('[data-maze-direction]').forEach((button) => button.addEventListener('click', () => {
    if (state) state = setMazeDirection(state, button.dataset.mazeDirection);
  }));
  root.querySelector('#maze-zoom-in').addEventListener('click', () => { zoom = Math.min(2.4, zoom + .25); updateZoom(); });
  root.querySelector('#maze-zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom - .25); updateZoom(); });
  root.querySelector('#maze-fit').addEventListener('click', () => { zoom = 1; updateZoom(); viewport.scrollTo(0, 0); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', onBlur);
  window.addEventListener('resize', updateZoom);
  document.addEventListener('visibilitychange', onVisibilityChange);
  renderModeMenu();
  root.querySelector('#maze-mode-title').focus();

  return () => {
    clearTimer();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('resize', updateZoom);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    root.innerHTML = '';
  };
}
