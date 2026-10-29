import { DATED_SPELLING_QUIZZES } from './spelling-quizzes.js';
import SPELLING_EXAMPLE from './spelling-example.json' with { type: 'json' };
import { createSpellingView } from './spelling-view.js';
import './illuminate.css';
import { EXAMPLE_QUIZ, EXAMPLE_JSON } from './example.js';
import { createAttempt, createLibraryStore, createLocalId, gradeAttempt, importQuizBatch, MAX_BATCH_FILES, MAX_FILE_BYTES, MAX_LIBRARY_QUIZZES, parseNumericAnswer, reviewRows, validateLibrary } from './model.js';
import { generateMultiplicationQuiz, MULTIPLICATION_MODES } from './multiplication.js';

const STORE_KEY = 'parcade.illuminate.library.v1';
const uid = createLocalId;
const libraryStore = createLibraryStore(EXAMPLE_QUIZ, { key: STORE_KEY });
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function mountIlluminate(root, { onHome }) {
  const store = libraryStore;
  const saved = store.load();
  let quizzes = saved.quizzes;
  let selectedId = saved.selectedId;
  let selectedQuiz = quizzes.find((quiz) => quiz.quiz_id === selectedId) ?? quizzes[0];
  let practiceMode = null;
  let attempt = null;
  let screen = 'library';
  let playerView = 'question';
  let interval = null;
  let clockStarted = null;
  let elapsedBeforePause = 0;
  let lastNotice = '';

  root.innerHTML = `
    <section class="illuminate-app" aria-labelledby="illuminate-title">
      <header class="illuminate-header"><button class="illuminate-back" type="button" data-il-home>← ARCADE</button><div class="illuminate-brand"><p>LOCAL QUIZ STUDIO</p><h1 id="illuminate-title">Illuminate Quiz</h1></div><span class="illuminate-mark" aria-hidden="true">IQ</span></header>
      <div class="il-notice" data-il-notice role="status" aria-live="polite" hidden></div>
      <main>
        <section class="il-library" data-il-library aria-labelledby="il-library-title">
          <div class="il-intro"><div><p class="il-eyebrow">YOUR STUDY DESK</p><h2 id="il-library-title">Pick a quiz.<br><span>Find your light.</span></h2><p>Bring a numeric or spelling quiz, or start with a built-in practice set.</p></div><div class="il-import-card"><span class="il-import-icon" aria-hidden="true">＋</span><strong>Add a quiz</strong><p>Import one or a batch of JSON files from this device.</p><button class="il-button il-primary" type="button" data-il-choose-files aria-controls="il-file-input">Choose quiz files</button><input id="il-file-input" type="file" accept="application/json,.json" multiple data-il-file hidden><button class="il-button il-quiet" type="button" data-il-download>Download example JSON</button></div></div>
          <section class="il-practice-card" aria-labelledby="il-practice-title"><div><p class="il-eyebrow">QUICK PRACTICE</p><h3 id="il-practice-title">Multiplication practice</h3><p>Ten fresh untimed questions per round. Practice rounds stay separate from your quiz library.</p></div><div class="il-practice-actions"><button class="il-button il-quiet" type="button" data-il-practice-mode="${MULTIPLICATION_MODES.oneDigit.id}">1-digit × 1-digit</button><button class="il-button il-quiet" type="button" data-il-practice-mode="${MULTIPLICATION_MODES.twoDigit.id}">1-digit × 2-digits</button></div></section>
          <section class="il-practice-card"><div><p class="il-eyebrow">LISTEN AND SPELL</p><h3 data-il-spelling-title></h3><p>Ten weekly words, mixed practice, or fourth-grade word bank practice.</p></div><div class="il-practice-actions"><button class="il-button il-primary" data-il-spelling>Open spelling quiz</button><button class="il-button il-quiet" data-il-spelling-download>Download spelling JSON</button></div></section>
          <div data-il-dated-spelling></div>
          <div class="il-library-heading"><div><p class="il-eyebrow">ON THIS DEVICE</p><h3>Quiz library <span data-il-count></span></h3></div><button class="il-restore" type="button" data-il-restore hidden>Restore example quiz</button></div>
          <div class="il-quiz-list" data-il-quiz-list></div>
          <p class="il-library-foot">Quiz files stay on this device. Practice numbers or listen and spell.</p>
        </section>
        <section class="il-setup" data-il-setup aria-labelledby="il-setup-title" hidden>
          <button class="il-text-button" type="button" data-il-library>← Quiz library</button>
          <div class="il-setup-card"><p class="il-eyebrow">READY WHEN YOU ARE</p><div class="il-setup-meta"><span data-il-setup-count></span><span data-il-setup-time></span><span data-il-setup-type></span></div><h2 id="il-setup-title" data-il-setup-title></h2><p data-il-setup-copy>Move through each question, flag anything to revisit, then review before you submit.</p><button class="il-button il-primary" type="button" data-il-start>Start quiz <span aria-hidden="true">→</span></button></div>
        </section>
        <section class="il-player" data-il-player aria-label="Quiz player" hidden>
          <div class="il-player-top"><div><p class="il-eyebrow" data-il-player-eyebrow>QUESTION 1</p><h2 data-il-player-title></h2></div><div class="il-clock"><span>TIME LEFT</span><strong data-il-clock>UNTIMED</strong></div></div>
          <div class="il-player-actions"><span class="il-live-state" data-il-run-state>READY</span><button class="il-button il-quiet" type="button" data-il-pause>Ⅱ Pause</button><button class="il-button il-quiet" type="button" data-il-library>End attempt</button></div>
          <div class="il-paused" data-il-paused hidden><strong>Quiz paused</strong><span>Time is stopped. Resume when you’re ready.</span><button class="il-button il-primary" type="button" data-il-resume>Resume quiz</button></div>
          <nav class="il-question-nav" aria-label="Quiz questions" data-il-question-nav></nav>
          <section class="il-question-panel" data-il-question-panel aria-labelledby="il-question-heading">
            <div class="il-question-meta"><span data-il-question-position></span><span data-il-skill></span><button type="button" class="il-flag" data-il-flag aria-pressed="false">☆ Flag for review</button></div>
            <h3 id="il-question-heading" data-il-prompt></h3>
            <form class="il-answer-form" data-il-answer-form novalidate>
              <label for="il-answer">Your numeric answer</label><div class="il-answer-row"><input id="il-answer" class="il-answer" name="answer" type="text" inputmode="decimal" autocomplete="off" aria-describedby="il-answer-help" data-il-answer><button class="il-button il-primary" type="submit" data-il-next>Save &amp; next <span aria-hidden="true">→</span></button></div>
              <p id="il-answer-help" class="il-answer-help" data-il-answer-help>Numbers, decimals, $ amounts, and percentages are accepted.</p>
              <div class="il-keypad" aria-label="Numeric keypad"><button type="button" data-il-key="1">1</button><button type="button" data-il-key="2">2</button><button type="button" data-il-key="3">3</button><button type="button" data-il-key="4">4</button><button type="button" data-il-key="5">5</button><button type="button" data-il-key="6">6</button><button type="button" data-il-key="7">7</button><button type="button" data-il-key="8">8</button><button type="button" data-il-key="9">9</button><button type="button" data-il-key="-" aria-label="Minus">−</button><button type="button" data-il-key="0">0</button><button type="button" data-il-key="." aria-label="Decimal point">.</button><button type="button" data-il-key="backspace" aria-label="Backspace">⌫</button><button type="button" data-il-key="clear">Clear</button></div>
            </form>
            <div class="il-question-footer"><button type="button" class="il-text-button" data-il-prev>← Previous</button><button type="button" class="il-button il-quiet" data-il-review>Review quiz</button></div>
          </section>
          <section class="il-review" data-il-review-panel aria-labelledby="il-review-title" hidden><div class="il-review-heading"><p class="il-eyebrow">ONE LAST LOOK</p><h3 id="il-review-title">Review your answers</h3><p>Open a question to make a change, or submit when you’re ready.</p></div><div class="il-review-list" data-il-review-list></div><div class="il-review-actions"><button type="button" class="il-text-button" data-il-back-question>← Back to quiz</button><button type="button" class="il-button il-primary" data-il-submit-quiz>Submit quiz</button></div></section>
          <p class="il-live" data-il-live role="status" aria-live="polite"></p>
        </section>
        <section class="il-results" data-il-results aria-labelledby="il-results-title" hidden>
          <div class="il-results-hero"><p class="il-eyebrow">QUIZ COMPLETE</p><h2 id="il-results-title">Your results</h2><div class="il-score" data-il-score></div><p data-il-score-copy></p><div class="il-result-actions"><button class="il-button il-primary" type="button" data-il-retry>Retry quiz</button><button class="il-button il-quiet" type="button" data-il-library>Quiz library</button></div></div>
          <div class="il-result-list" data-il-result-list></div>
        </section>
      </main>
    </section>`;

  const $ = (selector) => root.querySelector(selector);
  const libraryView = $('[data-il-library]');
  const setupView = $('[data-il-setup]');
  const playerViewElement = $('[data-il-player]');
  const resultsView = $('[data-il-results]');
  const answerInput = $('[data-il-answer]');
  const answerForm = $('[data-il-answer-form]');
  const fileInput = $('[data-il-file]');
  const notice = $('[data-il-notice]');
  const spellingHost = document.createElement('section'); spellingHost.className = 'il-spelling'; spellingHost.hidden = true; $('main').append(spellingHost);
  const spellingView = createSpellingView(spellingHost, { onLibrary: () => showScreen('library') });
  function openSpelling(quiz) { clearTimers(); attempt = null; showScreen('spelling'); spellingView.open(quiz); }

  function setNotice(message, error = false) {
    lastNotice = message;
    notice.hidden = !message;
    notice.textContent = message;
    notice.dataset.kind = error ? 'error' : 'info';
  }
  if (!saved.available) setNotice('Browser storage could not be read. The built-in quiz is ready; updates will stay in memory for this page session.', true);

  function syncLibrary() {
    const success = store.save({ quizzes, selectedId });
    if (!success) setNotice('Browser storage is unavailable. Your quiz library remains available in memory for this page session.', true);
    else if (lastNotice.includes('storage')) setNotice('');
    return success;
  }
  function announceLibraryAction(message) {
    if (store.available) setNotice(message);
    else setNotice(`${message} Browser storage is unavailable; changes remain in memory for this page session.`, true);
  }
  function getSelectedQuiz() { return quizzes.find((quiz) => quiz.quiz_id === selectedId) ?? quizzes[0]; }
  function showScreen(name) {
    spellingView.stop(); spellingHost.hidden = name !== 'spelling';
    screen = name;
    libraryView.hidden = name !== 'library'; setupView.hidden = name !== 'setup';
    playerViewElement.hidden = name !== 'player'; resultsView.hidden = name !== 'results';
    if (name === 'library') renderLibrary();
    if (name === 'setup') renderSetup();
    if (name === 'player') renderPlayer();
    if (name === 'results') renderResults();
  }
  function renderLibrary() {
    $('[data-il-spelling-title]').textContent = SPELLING_EXAMPLE.title;
    const dated = $('[data-il-dated-spelling]'); dated.replaceChildren();
    for (const quiz of DATED_SPELLING_QUIZZES) {
      const card = document.createElement('section'); card.className = 'il-practice-card';
      const info = document.createElement('div'); const title = document.createElement('h3'); title.textContent = quiz.title;
      const copy = document.createElement('p'); copy.textContent = '10 assigned words · Weekly, mixed, or grade-level practice'; info.append(title, copy);
      const actions = document.createElement('div'); actions.className = 'il-practice-actions';
      const open = document.createElement('button'); open.className = 'il-button il-primary'; open.type = 'button'; open.textContent = 'Open dated quiz'; open.dataset.ilDatedOpen = quiz.quiz_id;
      open.setAttribute('aria-label', `Open ${quiz.title}`);
      const download = document.createElement('button'); download.className = 'il-button il-quiet'; download.type = 'button'; download.textContent = 'Download JSON'; download.dataset.ilDatedDownload = quiz.quiz_id;
      download.setAttribute('aria-label', `Download ${quiz.title} JSON`);
      actions.append(open, download); card.append(info, actions); dated.append(card);
    }
    const host = $('[data-il-quiz-list]'); host.replaceChildren();
    $('[data-il-count]').textContent = `${quizzes.length} / ${MAX_LIBRARY_QUIZZES}`;
    $('[data-il-restore]').hidden = quizzes.some((quiz) => quiz.quiz_id === EXAMPLE_QUIZ.quiz_id);
    quizzes.forEach((quiz, index) => {
      const card = document.createElement('article'); card.className = 'il-quiz-card';
      const marker = document.createElement('span'); marker.className = 'il-quiz-index'; marker.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('div'); info.className = 'il-quiz-info';
      const title = document.createElement('h4'); title.textContent = quiz.title;
      const detail = document.createElement('p'); detail.textContent = `${quiz.words?.length ?? quiz.questions.length} ${(quiz.words?.length ?? quiz.questions.length) === 1 ? 'question' : 'questions'} · ${quiz.time_limit_seconds ? formatTime(quiz.time_limit_seconds) : 'Untimed'} · ${quiz.type === 'spelling' ? 'Audio spelling' : 'Numeric answers'}`;
      info.append(title, detail);
      const actions = document.createElement('div'); actions.className = 'il-quiz-actions';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'il-button il-primary'; open.textContent = 'Open quiz'; open.dataset.ilOpenQuiz = quiz.quiz_id;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'il-remove'; remove.textContent = 'Remove'; remove.dataset.ilRemoveQuiz = quiz.quiz_id; remove.disabled = quizzes.length === 1; remove.setAttribute('aria-label', `Remove ${quiz.title}`);
      actions.append(open, remove); card.append(marker, info, actions); host.append(card);
    });
  }
  function renderSetup() {
    if (practiceMode) {
      const descriptor = Object.values(MULTIPLICATION_MODES).find(({ id }) => id === practiceMode);
      $('[data-il-setup-title]').textContent = `Multiplication · ${descriptor.title}`;
      $('[data-il-setup-count]').textContent = '10 QUESTIONS';
      $('[data-il-setup-time]').textContent = 'UNTIMED';
      $('[data-il-setup-type]').textContent = 'FRESH GENERATED ROUND';
      $('[data-il-setup-copy]').textContent = 'Start creates a fresh set of exact integer multiplication questions. Retry creates another set.';
      return;
    }
    selectedQuiz = getSelectedQuiz();
    $('[data-il-setup-title]').textContent = selectedQuiz.title;
    $('[data-il-setup-count]').textContent = `${selectedQuiz.questions.length} ${selectedQuiz.questions.length === 1 ? 'QUESTION' : 'QUESTIONS'}`;
    $('[data-il-setup-time]').textContent = selectedQuiz.time_limit_seconds ? `${formatTime(selectedQuiz.time_limit_seconds)} TIME LIMIT` : 'UNTIMED';
    $('[data-il-setup-type]').textContent = 'UPLOADED QUIZ';
    $('[data-il-setup-copy]').textContent = 'Move through each question, flag anything to revisit, then review before you submit.';
  }
  function elapsedMs() { return elapsedBeforePause + (clockStarted === null ? 0 : performance.now() - clockStarted); }
  function stopInterval() { if (interval !== null) clearInterval(interval); interval = null; }
  function remainingSeconds() {
    const limit = attempt?.quiz.time_limit_seconds ?? 0;
    return limit ? Math.max(0, Math.ceil((limit * 1000 - elapsedMs()) / 1000)) : null;
  }
  function announce(message) { $('[data-il-live]').textContent = message; }
  function saveVisibleDraft() {
    if (!attempt || playerView !== 'question') return;
    const question = attempt.quiz.questions[attempt.currentIndex];
    attempt.answers[question.id] = answerInput.value;
  }
  function clearTimers() { stopInterval(); clockStarted = null; }
  function finalize() {
    if (!attempt || attempt.finalized) return false;
    attempt.finalized = true; attempt.paused = false;
    const result = gradeAttempt(attempt, elapsedMs() / 1000);
    attempt.result = result; clearTimers();
    showScreen('results'); announce('Quiz results are ready.'); return true;
  }
  function expireIfDue() {
    if (!attempt || !attempt.started || attempt.paused || attempt.finalized || attempt.quiz.time_limit_seconds === 0) return false;
    if (elapsedMs() < attempt.quiz.time_limit_seconds * 1000) return false;
    finalize(); return true;
  }
  function armTimer() {
    stopInterval();
    if (attempt?.started && !attempt.paused && !attempt.finalized && attempt.quiz.time_limit_seconds) {
      interval = window.setInterval(() => { if (expireIfDue()) return; updateClock(); }, 200);
    }
    updateClock();
  }
  function updateClock() {
    const remaining = remainingSeconds();
    $('[data-il-clock]').textContent = remaining === null ? 'UNTIMED' : formatTime(remaining);
  }
  function checkBeforeAction() { return expireIfDue(); }
  function pauseAttempt() {
    if (!attempt || !attempt.started || attempt.finalized || attempt.paused) return;
    if (expireIfDue()) return;
    elapsedBeforePause += performance.now() - clockStarted; clockStarted = null; attempt.paused = true; stopInterval();
    renderPlayer(); announce('Quiz paused.');
  }
  function resumeAttempt() {
    if (!attempt || !attempt.started || attempt.finalized || !attempt.paused) return;
    attempt.paused = false; clockStarted = performance.now(); armTimer(); renderPlayer(); announce('Quiz resumed.');
    if (playerView === 'question') answerInput.focus();
  }
  function startAttempt() {
    if (practiceMode) selectedQuiz = generateMultiplicationQuiz(practiceMode);
    else { selectedQuiz = getSelectedQuiz(); selectedId = selectedQuiz.quiz_id; syncLibrary(); }
    attempt = createAttempt(selectedQuiz); attempt.started = true; elapsedBeforePause = 0; clockStarted = performance.now(); playerView = 'question';
    showScreen('player'); armTimer(); answerInput.focus(); announce('Quiz started.');
  }
  function abandonToLibrary() {
    clearTimers(); attempt = null; practiceMode = null; selectedQuiz = getSelectedQuiz(); showScreen('library'); $('[data-il-home]').focus();
  }
  function withTimelyDraft(action, { flush = true } = {}) {
    if (checkBeforeAction()) return;
    if (!attempt || attempt.paused || attempt.finalized) return;
    if (flush) saveVisibleDraft();
    action();
  }
  function setCurrentQuestion(index) {
    withTimelyDraft(() => {
      const total = attempt.quiz.questions.length;
      if (index < 0) return;
      if (index >= total) { playerView = 'review'; renderPlayer(); announce('Review your answers before submitting.'); return; }
      playerView = 'question'; attempt.currentIndex = index; renderPlayer(); announce(`Question ${index + 1} of ${total}.`); answerInput.focus();
    });
  }
  function openReview() {
    withTimelyDraft(() => { playerView = 'review'; renderPlayer(); announce('Review your answers before submitting.'); });
  }
  function submitQuiz() {
    withTimelyDraft(() => finalize(), { flush: false });
  }
  function renderNavigation() {
    const nav = $('[data-il-question-nav]'); nav.replaceChildren();
    attempt.quiz.questions.forEach((question, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'il-question-number';
      const answered = Boolean(String(attempt.answers[question.id] ?? '').trim());
      button.textContent = String(index + 1); button.dataset.ilQuestionIndex = String(index);
      button.setAttribute('aria-label', `Question ${index + 1}${answered ? ', answered' : ', blank'}${attempt.flagged.includes(question.id) ? ', flagged' : ''}`);
      if (answered) button.classList.add('is-answered'); if (attempt.flagged.includes(question.id)) button.classList.add('is-flagged');
      if (playerView === 'question' && attempt.currentIndex === index) button.setAttribute('aria-current', 'step');
      button.disabled = attempt.paused; nav.append(button);
    });
  }
  function renderReview() {
    const host = $('[data-il-review-list]'); host.replaceChildren();
    reviewRows(attempt).forEach((row, index) => {
      const item = document.createElement('div'); item.className = 'il-review-row';
      const number = document.createElement('span'); number.textContent = `Q${index + 1}`;
      const skill = document.createElement('span'); skill.textContent = row.skill || 'Practice question';
      const status = document.createElement('span'); status.className = row.answered ? 'il-answered' : 'il-blank'; status.textContent = row.answered ? 'Answered' : 'Blank';
      const flag = document.createElement('span'); flag.textContent = row.flagged ? 'Flagged' : '';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'il-text-button'; open.textContent = 'Open'; open.dataset.ilQuestionIndex = String(index); open.disabled = attempt.paused;
      item.append(number, skill, status, flag, open); host.append(item);
    });
  }
  function renderPlayer() {
    if (!attempt) return;
    renderNavigation(); updateClock();
    $('[data-il-player-title]').textContent = attempt.quiz.title;
    $('[data-il-run-state]').textContent = attempt.paused ? 'PAUSED' : 'IN PROGRESS';
    $('[data-il-pause]').textContent = attempt.paused ? '▶ Resume' : 'Ⅱ Pause';
    $('[data-il-pause]').disabled = attempt.finalized;
    $('[data-il-paused]').hidden = !attempt.paused;
    $('[data-il-resume]').hidden = !attempt.paused;
    const isReview = playerView === 'review';
    $('[data-il-question-panel]').hidden = isReview;
    $('[data-il-review-panel]').hidden = !isReview;
    if (!isReview) {
      const question = attempt.quiz.questions[attempt.currentIndex];
      $('[data-il-player-eyebrow]').textContent = `QUESTION ${attempt.currentIndex + 1} / ${attempt.quiz.questions.length}`;
      $('[data-il-question-position]').textContent = `QUESTION ${attempt.currentIndex + 1}`;
      $('[data-il-skill]').textContent = question.skill || 'Practice question';
      $('[data-il-prompt]').textContent = question.prompt;
      answerInput.value = String(attempt.answers[question.id] ?? '');
      answerInput.disabled = attempt.paused;
      $('[data-il-flag]').disabled = attempt.paused;
      const flagged = attempt.flagged.includes(question.id);
      $('[data-il-flag]').setAttribute('aria-pressed', String(flagged));
      $('[data-il-flag]').textContent = flagged ? '★ Flagged for review' : '☆ Flag for review';
      $('[data-il-prev]').disabled = attempt.paused || attempt.currentIndex === 0;
      $('[data-il-next]').disabled = attempt.paused;
      $('[data-il-review]').disabled = attempt.paused;
      $('[data-il-keyboard]');
      root.querySelectorAll('[data-il-key]').forEach((button) => { button.disabled = attempt.paused; });
      const parsed = parseNumericAnswer(answerInput.value);
      $('[data-il-answer-help]').textContent = parsed.kind === 'invalid' ? 'Enter a valid number or clear this answer.' : 'Numbers, decimals, $ amounts, and percentages are accepted.';
      renderReview();
    } else {
      $('[data-il-player-eyebrow]').textContent = 'REVIEW BEFORE YOU SUBMIT';
      renderReview();
      $('[data-il-review-list]').querySelectorAll('button').forEach((button) => { button.disabled = attempt.paused; });
      $('[data-il-submit-quiz]').disabled = attempt.paused;
    }
  }
  function renderResults() {
    const result = attempt?.result;
    if (!result) return;
    $('[data-il-score]').textContent = `${result.scorePercent}%`;
    $('[data-il-score-copy]').textContent = `${result.correct} of ${result.total} correct · ${formatTime(result.elapsedSeconds)} active time`;
    const host = $('[data-il-result-list]'); host.replaceChildren();
    result.rows.forEach((row, index) => {
      const article = document.createElement('article'); article.className = `il-result-row ${row.correct ? 'is-correct' : 'is-wrong'}`;
      const number = document.createElement('span'); number.textContent = `Q${index + 1}`;
      const prompt = document.createElement('div'); const title = document.createElement('strong'); title.textContent = row.skill || 'Practice question'; const copy = document.createElement('p'); copy.textContent = row.prompt; prompt.append(title, copy);
      const yours = document.createElement('div'); yours.className = 'il-result-answer'; const yoursLabel = document.createElement('small'); yoursLabel.textContent = 'YOUR ANSWER'; const yoursValue = document.createElement('strong'); yoursValue.textContent = row.raw || '—'; yours.append(yoursLabel, yoursValue);
      const correct = document.createElement('div'); correct.className = 'il-result-answer'; const correctLabel = document.createElement('small'); correctLabel.textContent = 'CORRECT'; const correctValue = document.createElement('strong'); correctValue.textContent = `${row.expected}${row.unit ? ` ${row.unit}` : ''}`; correct.append(correctLabel, correctValue);
      const verdict = document.createElement('span');
      const outcome = row.correct ? 'Correct' : 'Review';
      const flagState = row.flagged ? 'Flagged' : 'Not flagged';
      verdict.textContent = `${outcome} · ${flagState}`;
      verdict.setAttribute('aria-label', `${outcome}; ${row.flagged ? 'flagged for review' : 'not flagged for review'}`);
      article.append(number, prompt, yours, correct, verdict); host.append(article);
    });
  }
  function launchQuiz(id) {
    const quiz = quizzes.find((entry) => entry.quiz_id === id); if (!quiz) return;
    if (quiz.type === 'spelling') { selectedId = id; syncLibrary(); openSpelling(quiz); return; }
    practiceMode = null;
    selectedId = id; selectedQuiz = quiz; syncLibrary(); showScreen('setup'); $('[data-il-start]').focus();
  }
  function choosePracticeMode(mode) {
    if (!Object.values(MULTIPLICATION_MODES).some((descriptor) => descriptor.id === mode)) return;
    practiceMode = mode; showScreen('setup'); $('[data-il-start]').focus();
  }
  async function importFiles(files) {
    if (!files.length) return;
    if (files.length > MAX_BATCH_FILES) { setNotice('Choose no more than 20 files in one import.', true); return; }
    const tooLarge = files.find((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge) { setNotice(`${tooLarge.name}: each quiz file must be 512 KiB or smaller. No files were imported.`, true); return; }
    try {
      const payloads = await Promise.all(files.map(async (file) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()))));
      const result = importQuizBatch(quizzes, payloads, { idFactory: uid });
      if (!result.valid) { setNotice(`${files.map((file) => file.name).join(', ')}: ${result.error} No files were imported.`, true); return; }
      quizzes = result.quizzes; selectedId = quizzes.at(-1).quiz_id; selectedQuiz = getSelectedQuiz(); syncLibrary();
      announceLibraryAction(`${files.length} ${files.length === 1 ? 'quiz' : 'quizzes'} added to your local library.`); renderLibrary();
    } catch {
      setNotice(`${files.map((file) => file.name).join(', ')}: one or more files contain invalid JSON. No files were imported.`, true);
    } finally { fileInput.value = ''; }
  }
  function removeQuiz(id) {
    if (quizzes.length <= 1) { setNotice('Keep at least one quiz in your library. Restore the example or add another quiz first.', true); return; }
    quizzes = quizzes.filter((quiz) => quiz.quiz_id !== id);
    if (!quizzes.some((quiz) => quiz.quiz_id === selectedId)) selectedId = quizzes[0].quiz_id;
    selectedQuiz = getSelectedQuiz(); syncLibrary(); renderLibrary(); announceLibraryAction('Quiz removed from this device.');
  }
  function restoreExample() {
    const checked = validateLibrary([...quizzes, EXAMPLE_QUIZ]);
    if (!checked.valid) { setNotice(checked.error, true); return; }
    quizzes = checked.quizzes; selectedId = EXAMPLE_QUIZ.quiz_id; selectedQuiz = EXAMPLE_QUIZ; syncLibrary(); renderLibrary(); announceLibraryAction('Built-in percentages quiz restored.');
  }
  function downloadExample(spelling = false, quiz = SPELLING_EXAMPLE) {
    const blob = new Blob([spelling ? JSON.stringify(quiz, null, 2) : EXAMPLE_JSON], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = spelling ? `${quiz.quiz_id}.json` : 'illuminate-percentages-example.json'; link.click(); URL.revokeObjectURL(url);
  }
  function onInput() {
    if (expireIfDue()) return;
    if (!attempt || attempt.paused || attempt.finalized) return;
    const question = attempt.quiz.questions[attempt.currentIndex];
    attempt.answers[question.id] = answerInput.value;
    const parsed = parseNumericAnswer(answerInput.value);
    $('[data-il-answer-help]').textContent = parsed.kind === 'invalid' && answerInput.value.trim() ? 'Enter a valid number or clear this answer.' : 'Numbers, decimals, $ amounts, and percentages are accepted.';
    renderNavigation();
  }
  function handleFormSubmit(event) { event.preventDefault(); setCurrentQuestion(attempt.currentIndex + 1); }
  function keyValue(key) {
    if (expireIfDue() || !attempt || attempt.paused || attempt.finalized) return;
    if (key === 'clear') answerInput.value = '';
    else if (key === 'backspace') answerInput.value = answerInput.value.slice(0, -1);
    else answerInput.value += key;
    answerInput.dispatchEvent(new Event('input', { bubbles: true })); answerInput.focus();
  }
  function clickHandler(event) {
    const target = event.target instanceof Element ? event.target : null; if (!target) return;
    const datedOpen = target.closest('[data-il-dated-open]');
    if (datedOpen) { const quiz = DATED_SPELLING_QUIZZES.find((entry) => entry.quiz_id === datedOpen.dataset.ilDatedOpen); if (quiz) openSpelling(quiz); return; }
    const datedDownload = target.closest('[data-il-dated-download]');
    if (datedDownload) { const quiz = DATED_SPELLING_QUIZZES.find((entry) => entry.quiz_id === datedDownload.dataset.ilDatedDownload); if (quiz) downloadExample(true, quiz); return; }
    if (target.closest('[data-il-spelling]')) { openSpelling(SPELLING_EXAMPLE); return; }
    const open = target.closest('[data-il-open-quiz]'); if (open) { launchQuiz(open.dataset.ilOpenQuiz); return; }
    const remove = target.closest('[data-il-remove-quiz]'); if (remove) { removeQuiz(remove.dataset.ilRemoveQuiz); return; }
    if (target.closest('[data-il-spelling-download]')) { downloadExample(true); return; }
    if (target.closest('[data-il-download]')) { downloadExample(); return; }
    if (target.closest('[data-il-choose-files]')) { fileInput.click(); return; }
    const practiceChoice = target.closest('[data-il-practice-mode]'); if (practiceChoice) { choosePracticeMode(practiceChoice.dataset.ilPracticeMode); return; }
    if (target.closest('[data-il-restore]')) { restoreExample(); return; }
    if (target.closest('[data-il-start]')) { startAttempt(); return; }
    if (target.closest('[data-il-home]')) { spellingView.stop(); clearTimers(); onHome(); return; }
    if (target.closest('[data-il-library]')) { abandonToLibrary(); return; }
    if (target.closest('[data-il-pause]')) { if (attempt?.paused) resumeAttempt(); else pauseAttempt(); return; }
    if (target.closest('[data-il-resume]')) { resumeAttempt(); return; }
    if (target.closest('[data-il-prev]')) { setCurrentQuestion(attempt.currentIndex - 1); return; }
    if (target.closest('[data-il-review], [data-il-back-question]')) { if (playerView === 'review') setCurrentQuestion(attempt.currentIndex); else openReview(); return; }
    if (target.closest('[data-il-submit-quiz]')) { submitQuiz(); return; }
    if (target.closest('[data-il-retry]')) { startAttempt(); return; }
    if (target.closest('[data-il-flag]')) {
      withTimelyDraft(() => { const id = attempt.quiz.questions[attempt.currentIndex].id; attempt.flagged = attempt.flagged.includes(id) ? attempt.flagged.filter((entry) => entry !== id) : [...attempt.flagged, id]; renderPlayer(); }); return;
    }
    const indexButton = target.closest('[data-il-question-index]'); if (indexButton) { setCurrentQuestion(Number(indexButton.dataset.ilQuestionIndex)); return; }
    const keyButton = target.closest('[data-il-key]'); if (keyButton) { keyValue(keyButton.dataset.ilKey); return; }
  }
  function onKeyDown(event) {
    if (screen === 'library' || screen === 'setup') { if (event.key === 'Escape' && screen === 'setup') { practiceMode = null; selectedQuiz = getSelectedQuiz(); showScreen('library'); return; } }
    if (screen !== 'player') return;
    const target = event.target instanceof Element ? event.target : null;
    if (event.key === 'Escape') { event.preventDefault(); abandonToLibrary(); return; }
    if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (target?.closest('button,a,[role="button"]') && [' ', 'Enter'].includes(event.key)) return;
    if (event.repeat) return;
    if (event.key === ' ' && attempt?.started && !attempt.finalized) { event.preventDefault(); if (attempt.paused) resumeAttempt(); else pauseAttempt(); }
  }
  function onBlur() { if (screen === 'player' && attempt?.started && !attempt.paused && !attempt.finalized) pauseAttempt(); }
  function onVisibility() { if (document.hidden) onBlur(); }

  function delegatedClick(event) { clickHandler(event); }
  root.addEventListener('click', delegatedClick);
  answerForm.addEventListener('submit', handleFormSubmit);
  answerInput.addEventListener('input', onInput);
  fileInput.addEventListener('change', () => importFiles([...fileInput.files]));
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);
  showScreen('library');

  return () => {
    spellingView.destroy(); clearTimers(); root.removeEventListener('click', delegatedClick); answerForm.removeEventListener('submit', handleFormSubmit);
    answerInput.removeEventListener('input', onInput); window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVisibility);
    root.replaceChildren();
  };
}
