import { createAttempt, gradeAttempt } from './model.js';
import { spellingSession, WORD_BANKS } from './spelling.js';
import { createAudioService } from './audio.js';

export function createSpellingView(host, { onLibrary, audio = createAudioService() }) {
  host.innerHTML = `
    <section class="il-setup-card" data-sp-setup>
      <h2 data-sp-title></h2>
      <label>Quiz mode <select data-sp-mode><option value="weekly">Weekly Spelling Quiz</option><option value="mixed">Mixed Practice</option><option value="grade">Fourth-Grade Practice</option></select></label>
      <label data-sp-count-label hidden>Number of extra words <input data-sp-count type="number" min="0" step="1" value="5"></label>
      <p data-sp-summary></p><p role="alert" data-sp-setup-error></p>
      <button class="il-button il-primary" data-sp-start>Start quiz</button>
    </section>
    <section class="il-question-panel" data-sp-player hidden>
      <p data-sp-position></p><h2>Listen and spell</h2>
      <div class="sp-controls"><button class="il-button il-primary" data-sp-hear aria-label="Hear Word">🔊 Hear Word</button><button class="il-button il-quiet" data-sp-sentence>Hear Sentence</button><button class="il-button il-quiet" data-sp-replay>Replay / Repeat Word</button></div>
      <label>Playback speed <select data-sp-speed><option value="0.7">Slow (0.7×)</option><option value="0.9" selected>Normal (0.9×)</option><option value="1">1×</option><option value="1.2">Fast (1.2×)</option></select></label>
      <p role="status" data-sp-audio-status></p>
      <form class="il-answer-form" data-sp-form>
        <label for="sp-answer">Type the word you hear</label>
        <div class="il-answer-row"><input class="il-answer" id="sp-answer" type="text" inputmode="text" spellcheck="false" writingsuggestions="false" autocomplete="off" autocorrect="off" autocapitalize="none" required><button class="il-button il-primary" type="submit">Submit</button></div>
      </form>
      <p role="status" data-sp-feedback></p>
      <button class="il-button il-primary" data-sp-next hidden>Next word</button>
      <button class="il-button il-quiet" data-sp-skip>Skip without scoring</button>
    </section>
    <section class="il-results-hero" data-sp-results hidden>
      <h2>Your spelling results</h2><p data-sp-score></p><p data-sp-groups></p>
      <h3>Missed words</h3><ul data-sp-missed></ul><p data-sp-skipped></p>
      <button class="il-button il-primary" data-sp-retry>Retry Missed Words</button><button class="il-button il-quiet" data-sp-restart>Restart Quiz</button>
    </section>
    <button class="il-text-button" data-sp-library>Return to Quiz Selection</button>`;
  const $ = (selector) => host.querySelector(selector);
  let quiz; let attempt; let mode = 'weekly'; let count; let submitted = false; let request = 0;
  const input = $('#sp-answer');
  function stop() { request++; audio.stop(); }
  function panels(name) { for (const key of ['setup', 'player', 'results']) $(`[data-sp-${key}]`).hidden = key !== name; }
  function setupSummary() {
    mode = $('[data-sp-mode]').value;
    const isGrade = mode === 'grade';
    $('[data-sp-count-label]').hidden = mode === 'weekly';
    $('[data-sp-count-label]').firstChild.textContent = isGrade ? 'Number of words ' : 'Number of extra words ';
    $('[data-sp-count]').min = isGrade ? '1' : '0';
    const bank = WORD_BANKS[quiz.settings.extraWordBank];
    $('[data-sp-count]').max = bank.words.length;
    count = Number($('[data-sp-count]').value);
    $('[data-sp-summary]').textContent = `${mode === 'weekly' ? 10 : count + (isGrade ? 0 : 10)} words · Untimed`;
  }
  function question() { return attempt.quiz.questions[attempt.currentIndex]; }
  async function play(kind) {
    const token = ++request; const entry = question();
    $('[data-sp-audio-status]').textContent = 'Playing audio…';
    const options = { language: quiz.language, rate: Number($('[data-sp-speed]').value), sequence: kind === 'sequence' };
    try {
      const done = kind === 'sentence' ? await audio.speakSentence(entry.sentence, options) : await audio.speakWord(entry, options);
      if (token === request) $('[data-sp-audio-status]').textContent = done ? 'Listen again whenever you need.' : '';
    } catch {
      if (token === request) $('[data-sp-audio-status]').textContent = 'Audio could not play. Check volume and installed voices, then try Hear Word again or skip without scoring.';
    }
  }
  function showQuestion() {
    stop(); submitted = false; panels('player');
    $('[data-sp-position]').textContent = `Question ${attempt.currentIndex + 1} of ${attempt.quiz.questions.length}`;
    $('[data-sp-feedback]').textContent = ''; $('[data-sp-next]').hidden = true;
    $('[data-sp-form]').hidden = false; $('[data-sp-skip]').hidden = false;
    input.value = ''; input.disabled = false;
    $('[data-sp-sentence]').hidden = !question().sentence;
    input.focus(); play('sequence');
  }
  function start(retry = null) {
    try {
      const session = spellingSession(quiz, { mode, count, retry });
      const number = (attempt?.attemptNumber ?? 0) + 1;
      stop(); attempt = createAttempt(session); attempt.attemptNumber = number; attempt.started = true;
      $('[data-sp-setup-error]').textContent = ''; showQuestion();
    } catch (error) { $('[data-sp-setup-error]').textContent = error.message; }
  }
  function results() {
    stop(); attempt.finalized = true; attempt.result = gradeAttempt(attempt, 0); panels('results');
    const result = attempt.result;
    $('[data-sp-score]').textContent = `${result.correct}/${result.attempted} correct (${result.scorePercent}%) · ${result.attempted} attempted · ${result.incorrect} incorrect · ${result.skipped} skipped`;
    const { weekly, supplemental } = result.groups;
    $('[data-sp-groups]').textContent = `Weekly spelling: ${weekly.correct}/${weekly.total} · Extra practice: ${supplemental.correct}/${supplemental.total}`;
    const list = $('[data-sp-missed]'); list.replaceChildren();
    for (const row of result.missed) { const item = document.createElement('li'); item.textContent = `${row.expected} — Your answer: ${row.raw}`; list.append(item); }
    if (!result.missed.length) { const item = document.createElement('li'); item.textContent = 'No missed words.'; list.append(item); }
    $('[data-sp-skipped]').textContent = result.skipped ? 'Skipped words were not scored or included in missed-word retry.' : '';
    $('[data-sp-retry]').disabled = !result.missed.length;
    $('[data-sp-restart]').focus();
  }
  function advance() { stop(); if (++attempt.currentIndex >= attempt.quiz.questions.length) results(); else showQuestion(); }
  function submit(event) {
    event.preventDefault(); if (submitted || !input.value.trim()) return;
    stop(); attempt.answers[question().id] = input.value; submitted = true;
    const row = gradeAttempt(attempt, 0).rows[attempt.currentIndex];
    $('[data-sp-feedback]').textContent = `${row.correct ? 'Correct!' : 'Not quite. The correct spelling is'} ${row.expected}. Your answer: ${row.raw}`;
    input.disabled = true; $('[data-sp-form]').hidden = true;
    $('[data-sp-next]').hidden = false; $('[data-sp-skip]').hidden = true; $('[data-sp-next]').focus();
  }
  function click(event) {
    if (event.target.closest('[data-sp-start]')) start();
    if (event.target.closest('[data-sp-hear], [data-sp-replay]')) play('word');
    if (event.target.closest('[data-sp-sentence]')) play('sentence');
    if (event.target.closest('[data-sp-next]') && submitted) advance();
    if (event.target.closest('[data-sp-skip]') && !submitted) { attempt.skipped.push(question().id); advance(); }
    if (event.target.closest('[data-sp-retry]')) start(attempt.result.missed);
    if (event.target.closest('[data-sp-restart]')) start();
    if (event.target.closest('[data-sp-library]')) { stop(); onLibrary(); }
  }
  function change(event) {
    if (event.target.matches('[data-sp-mode]')) { $('[data-sp-count]').value = event.target.value === 'grade' ? 10 : quiz.settings.defaultExtraWordCount; setupSummary(); }
    if (event.target.matches('[data-sp-count]')) setupSummary();
    if (event.target.matches('[data-sp-speed]')) stop();
  }
  function blur() { if (!host.hidden) { stop(); $('[data-sp-audio-status]').textContent = 'Audio stopped. Press Hear Word to listen again.'; } }
  function visibility() { if (document.hidden) blur(); }
  function key(event) { if (!host.hidden && event.key === 'Escape') { stop(); onLibrary(); } }
  host.addEventListener('click', click); host.addEventListener('change', change); $('[data-sp-form]').addEventListener('submit', submit);
  window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility); host.addEventListener('keydown', key);
  return {
    open(definition) { stop(); quiz = definition; attempt = null; mode = 'weekly'; $('[data-sp-mode]').value = mode; $('[data-sp-count]').value = quiz.settings.defaultExtraWordCount; $('[data-sp-title]').textContent = quiz.title; $('[data-sp-setup-error]').textContent = ''; setupSummary(); panels('setup'); $('[data-sp-start]').focus(); },
    stop,
    destroy() { stop(); host.removeEventListener('click', click); host.removeEventListener('change', change); $('[data-sp-form]').removeEventListener('submit', submit); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); host.removeEventListener('keydown', key); },
  };
}
