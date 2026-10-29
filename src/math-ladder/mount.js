import './math.css';
import { mountSettingsDialog, mountSettingsNotice, readSavedConfig, snapshot, writeSavedConfig } from '../settings-core.js';
import { MATH_FIELDS, MATH_PRESETS, MATH_SOURCE, validateMathConfig } from '../settings.js';
import { createSetupState, expireMathRun, pauseMathRun, resumeMathRun, startMathRun, submitMathAnswer } from './game.js';

const SETTINGS_KEY = 'parcade.settings.math.v1';
const operationName = (operation) => ({ addition: 'Addition', subtraction: 'Subtraction', multiplication: 'Multiplication' })[operation];

export function mountMath(root, { onHome }) {
  const saved = readSavedConfig(SETTINGS_KEY, MATH_SOURCE, validateMathConfig);
  let config = saved.config;
  let storageAvailable = saved.available;
  let state = createSetupState(config);
  let timer = null;
  let clockStartedAt = null;
  let elapsedBeforePause = 0;
  let lastAnnouncement = '';

  root.innerHTML = `
    <section class="math-app" aria-label="Math Ladder">
      <header class="math-heading">
        <button class="math-home" type="button" data-math-home><span aria-hidden="true">←</span> ARCADE</button>
        <div class="math-brand"><p class="math-kicker">NO. 04 / QUICK THINKING</p><h1>Math Ladder</h1></div>
        <button class="settings-launch" type="button" data-math-settings>⚙ Settings</button>
      </header>
      <section class="math-setup" data-math-setup aria-labelledby="math-setup-title">
        <div class="math-setup-copy"><p class="math-kicker">ONE ANSWER AT A TIME</p><h2 id="math-setup-title">Climb the<br><span>number ladder.</span></h2><p>Six rungs by default. Keep your head, watch the clock, make it to the top.</p></div>
        <div class="math-setup-card"><div class="math-setup-icon" aria-hidden="true"><span>＋</span><span>×</span><span>−</span></div><p class="math-card-label">READY FOR A ROUND?</p><h3>Set your pace.</h3><p class="math-summary" data-math-summary></p><button class="math-primary" type="button" data-math-start>Start climbing <span aria-hidden="true">→</span></button><button class="math-secondary" type="button" data-math-settings>⚙ Change settings</button></div>
        <p class="math-setup-note">No points to lose. Just rungs to earn.</p>
      </section>
      <section class="math-run" data-math-run hidden aria-label="Math Ladder run">
        <div class="math-run-meta"><div class="math-stat"><span>TIME LEFT</span><strong data-math-time>00:45</strong></div><div class="math-stat math-rung-stat"><span>LADDER PROGRESS</span><strong data-math-rung>0 / 6</strong></div><div class="math-stat math-wrong-stat"><span>MISSES</span><strong data-math-wrong>0 / 3</strong></div><div class="math-run-status" data-math-status>READY</div></div>
        <div class="math-ladder" role="progressbar" aria-label="Ladder progress" aria-valuemin="0" aria-valuemax="6" aria-valuenow="0" aria-valuetext="0 of 6 rungs" data-math-progress><div class="math-ladder-rail math-rail-left"></div><ol data-math-rungs aria-hidden="true"></ol><div class="math-ladder-rail math-rail-right"></div><span class="math-ladder-cap math-cap-top">✳</span><span class="math-ladder-cap math-cap-bottom">↗</span></div>
        <div class="math-play-card" data-math-play-card>
          <p class="math-operation-label" data-math-operation>ADDITION</p><h2 class="math-question" data-math-question>12 + 8 =</h2>
          <form class="math-answer-form" data-math-form novalidate>
            <label for="math-answer">Your answer</label><div class="math-answer-row"><input id="math-answer" name="answer" type="text" inputmode="numeric" autocomplete="off" autocapitalize="off" maxlength="10" aria-label="Answer" data-math-answer><button class="math-submit" type="submit">Submit <span aria-hidden="true">↵</span></button></div>
            <div class="math-keypad" aria-label="Number keypad"><button type="button" data-math-key="1">1</button><button type="button" data-math-key="2">2</button><button type="button" data-math-key="3">3</button><button type="button" data-math-key="4">4</button><button type="button" data-math-key="5">5</button><button type="button" data-math-key="6">6</button><button type="button" data-math-key="7">7</button><button type="button" data-math-key="8">8</button><button type="button" data-math-key="9">9</button><button type="button" class="math-minus" data-math-key="-" hidden aria-label="Minus">−</button><button type="button" data-math-key="0">0</button><button type="button" data-math-key="backspace" aria-label="Backspace">⌫</button></div>
            <div class="math-form-actions"><button type="button" class="math-clear" data-math-clear>Clear</button><button type="button" class="math-pause" data-math-pause>Ⅱ Pause</button><button type="button" class="math-restart" data-math-restart>↻ Restart</button></div>
          </form>
          <p class="math-feedback" data-math-feedback role="status" aria-live="polite"></p>
        </div>
        <div class="math-terminal" data-math-terminal hidden><p class="math-kicker" data-math-terminal-label></p><h2 data-math-terminal-title></h2><p data-math-terminal-copy></p><button class="math-primary" type="button" data-math-terminal-action></button></div>
        <div class="math-run-bottom"><span data-math-config></span><button type="button" class="math-arcade-link" data-math-return>← Back to arcade</button></div>
        <p class="math-keyboard-help">ENTER SUBMITS <i>·</i> SPACE PAUSES <i>·</i> R RESTARTS <i>·</i> ESC ARCADE</p>
      </section>
      <p class="math-live sr-only" role="status" aria-live="polite" data-math-live></p>
    </section>`;

  const $ = (selector) => root.querySelector(selector);
  const setupScreen = $('[data-math-setup]');
  const runScreen = $('[data-math-run]');
  const answer = $('[data-math-answer]');
  const form = $('[data-math-form]');
  const settingsDialog = mountSettingsDialog(root, {
    title: 'Math Ladder', presets: MATH_PRESETS, fields: MATH_FIELDS, validate: validateMathConfig,
    onApply: (next) => {
      config = snapshot(next);
      storageAvailable = writeSavedConfig(SETTINGS_KEY, config);
      settingsNotice[storageAvailable ? 'clear' : 'show']();
      clearTimer(); resetClock(); state = createSetupState(config); render(); $('[data-math-start]').focus();
    },
    onCancel: () => { render(); },
  });
  const settingsNotice = mountSettingsNotice(root, storageAvailable);

  function elapsed() { return elapsedBeforePause + (clockStartedAt === null ? 0 : performance.now() - clockStartedAt); }
  function resetClock() { clockStartedAt = null; elapsedBeforePause = 0; }
  function startClock() { clockStartedAt = performance.now(); }
  function pauseClock() { if (clockStartedAt !== null) elapsedBeforePause += performance.now() - clockStartedAt; clockStartedAt = null; }
  function clearTimer() { if (timer !== null) window.clearInterval(timer); timer = null; }
  function announce(message) { if (message && message !== lastAnnouncement) $('[data-math-live]').textContent = message; lastAnnouncement = message; }
  function summaryText(value) {
    const ops = value.operations.map(operationName).join(' + ');
    const range = value.customRangeEnabled ? ` · range ${value.operandMin}–${value.operandMax}` : '';
    return `${ops} · ${value.digits} digits · ${value.timeLimitSeconds}s · ${value.correctToWin} to win · ${value.wrongToLose} misses${range}`;
  }
  function startRun() {
    clearTimer(); resetClock(); state = startMathRun(config); startClock(); render(); armTimer(); answer.focus();
  }
  function toSetup() {
    clearTimer(); pauseClock(); resetClock(); state = createSetupState(config); render(); $('[data-math-start]').focus();
  }
  function startOrPause() {
    if (state.status === 'running') { state = pauseMathRun(state); pauseClock(); clearTimer(); render(); }
    else if (state.status === 'paused') { state = resumeMathRun(state); startClock(); render(); armTimer(); answer.focus(); }
  }
  function openSettings() {
    if (state.status === 'running') { state = pauseMathRun(state); pauseClock(); clearTimer(); render(); }
    settingsDialog.open(config, { storageAvailable });
  }
  function finishIfExpired() {
    if (state.status !== 'running') return false;
    const expired = expireMathRun(state, elapsed());
    if (expired === state) return false;
    state = expired; pauseClock(); clearTimer(); render(); announce('Time is up. The run ended.'); return true;
  }
  function render() {
    const setup = state.status === 'setup';
    setupScreen.hidden = !setup;
    runScreen.hidden = setup;
    $('[data-math-summary]').textContent = summaryText(config);
    $('[data-math-config]').textContent = `${state.config?.preset?.toUpperCase?.() ?? config.preset.toUpperCase()} · ${summaryText(state.config ?? config)}`;
    if (setup) return;
    const target = state.config.correctToWin;
    const remaining = Math.max(0, state.config.timeLimitSeconds * 1000 - elapsed());
    const seconds = Math.ceil(remaining / 1000);
    $('[data-math-time]').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('[data-math-rung]').textContent = `${state.rung} / ${target}`;
    const progress = $('[data-math-progress]');
    progress.setAttribute('aria-valuemax', String(target));
    progress.setAttribute('aria-valuenow', String(state.rung));
    progress.setAttribute('aria-valuetext', `${state.rung} of ${target} rungs`);
    $('[data-math-wrong]').textContent = `${state.wrong} / ${state.config.wrongToLose}`;
    $('[data-math-status]').textContent = ({ running: 'CLIMBING', paused: 'PAUSED', won: 'LADDER CLEARED', lost: state.endReason === 'time' ? 'TIME UP' : 'SPLAT' })[state.status];
    $('[data-math-status]').dataset.state = state.status;
    $('[data-math-rungs]').style.setProperty('--math-target', target);
    $('[data-math-rungs]').style.setProperty('--math-columns', Math.min(target, 10));
    $('[data-math-rungs]').style.setProperty('--math-rows', Math.ceil(target / 10));
    $('[data-math-rungs]').replaceChildren(...Array.from({ length: target }, (_, index) => {
      const rung = document.createElement('li'); rung.className = index < state.rung ? 'is-climbed' : ''; return rung;
    }));
    $('[data-math-question]').textContent = state.question?.prompt ?? '';
    $('[data-math-operation]').textContent = state.question ? operationName(state.question.operation).toUpperCase() : '';
    $('[data-math-feedback]').textContent = state.feedback;
    $('[data-math-feedback]').dataset.kind = state.feedback.startsWith('Wrong') || state.feedback === 'Splat.' ? 'bad' : state.feedback.startsWith('Numbers') ? 'warn' : 'good';
    answer.inputMode = state.question?.operation === 'subtraction' ? 'decimal' : 'numeric';
    $('[data-math-key="-"]').hidden = state.question?.operation !== 'subtraction';
    $('[data-math-pause]').textContent = state.status === 'paused' ? '▶ Resume' : 'Ⅱ Pause';
    const terminal = state.status !== 'running';
    $('[data-math-play-card]').hidden = terminal;
    $('[data-math-terminal]').hidden = !terminal;
    if (terminal) {
      const paused = state.status === 'paused'; const won = state.status === 'won';
      $('[data-math-terminal]').dataset.state = state.status;
      $('[data-math-terminal-label]').textContent = paused ? 'TAKE A BREATHER' : won ? 'PERFECT CLIMB' : 'RUN ENDED';
      $('[data-math-terminal-title]').textContent = paused ? 'The ladder can wait.' : won ? 'You made it to the top.' : 'Time for another try.';
      $('[data-math-terminal-copy]').textContent = paused ? 'Your time and progress are safely paused.' : won ? `${state.rung} rungs cleared. Lovely work.` : state.endReason === 'time' ? 'The timer reached zero before the answer landed.' : `${state.wrong} wrong answers. Your next climb starts fresh.`;
      $('[data-math-terminal-action]').textContent = paused ? 'Resume ladder →' : 'New ladder →';
      $('[data-math-terminal-action]').setAttribute('data-action', paused ? 'resume' : 'restart');
    }
    if (state.status !== render.previousStatus) announce(({ paused: 'Ladder paused.', won: 'You won Math Ladder.', lost: state.endReason === 'time' ? 'Time expired.' : 'The run ended.' })[state.status] ?? 'Math Ladder started.');
    render.previousStatus = state.status;
  }
  function armTimer() {
    clearTimer();
    if (state.status === 'running') timer = window.setInterval(() => { if (finishIfExpired()) return; render(); }, 100);
  }
  function submit(event) {
    event.preventDefault();
    if (finishIfExpired()) return;
    state = submitMathAnswer(state, answer.value, { elapsedMs: elapsed() });
    answer.value = '';
    if (state.status !== 'running') { clearTimer(); pauseClock(); }
    render();
    if (state.status === 'running') answer.focus();
  }
  function handleKeypad(event) {
    const key = event.target.closest('[data-math-key]')?.dataset.mathKey;
    if (!key) return;
    if (key === 'backspace') answer.value = answer.value.slice(0, -1);
    else if (key === '-') { if (state.question?.operation === 'subtraction' && !answer.value) answer.value = '-'; }
    else answer.value += key;
    answer.focus();
  }
  function handleTerminalAction(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'resume') startOrPause();
    else if (action === 'restart') toSetup();
  }
  function handleSettingsClick(event) { if (event.target.closest('[data-math-settings]')) openSettings(); }
  function onKeyDown(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('.settings-dialog')) return;
    if (event.key === 'Escape') { event.preventDefault(); onHome(); return; }
    if (event.key === 'Enter' && ['won', 'lost'].includes(state.status) && target?.matches('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); toSetup(); return; }
    if (target?.matches('input,textarea,select,[contenteditable="true"]') || target?.isContentEditable) return;
    if (target?.matches('button,a,[role="button"]') && [' ', 'Enter'].includes(event.key)) return;
    if (event.repeat) return;
    if (event.key === ' ' && (state.status === 'running' || state.status === 'paused')) { event.preventDefault(); startOrPause(); }
    else if (event.key.toLowerCase() === 'r' && state.status !== 'setup') { event.preventDefault(); toSetup(); }
    else if (event.key === 'Enter' && ['won', 'lost'].includes(state.status)) { event.preventDefault(); toSetup(); }
  }
  function pauseOnLeave() { if (state.status === 'running') startOrPause(); }
  function onVisibilityChange() { if (document.hidden) pauseOnLeave(); }
  function onFormInput() { if (state.status === 'running') finishIfExpired(); }
  function onHomeClick() { onHome(); }
  function rootClickHandler(event) {
    if (event.target.closest('[data-math-start]')) startRun();
    else if (event.target.closest('[data-math-pause]')) startOrPause();
    else if (event.target.closest('[data-math-restart]')) toSetup();
    else if (event.target.closest('[data-math-home], [data-math-return]')) onHomeClick();
    else if (event.target.closest('[data-math-clear]')) { answer.value = ''; answer.focus(); }
  }

  form.addEventListener('submit', submit);
  root.addEventListener('click', handleSettingsClick);
  root.addEventListener('click', handleKeypad);
  root.addEventListener('click', handleTerminalAction);
  root.addEventListener('click', rootClickHandler);
  answer.addEventListener('input', onFormInput);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', pauseOnLeave);
  document.addEventListener('visibilitychange', onVisibilityChange);
  render();
  return () => {
    clearTimer(); pauseClock();
    form.removeEventListener('submit', submit);
    root.removeEventListener('click', handleSettingsClick);
    root.removeEventListener('click', handleKeypad);
    root.removeEventListener('click', handleTerminalAction);
    root.removeEventListener('click', rootClickHandler);
    answer.removeEventListener('input', onFormInput);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', pauseOnLeave);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    root.replaceChildren();
  };
}
