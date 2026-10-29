import test from 'node:test';
import assert from 'node:assert/strict';
import example from '../src/illuminate/spelling-example.json' with { type: 'json' };
import { normalizeQuiz, importQuizBatch, createAttempt, gradeAttempt, createLibraryStore } from '../src/illuminate/model.js';
import { spellingSession, validateWords, normalizeSpelling, WORD_BANKS } from '../src/illuminate/spelling.js';
const quiz = normalizeQuiz(example).quiz;

test('sample and registered bank validate; spelling imports persist through the existing store', () => {
  assert.equal(normalizeQuiz(example).valid, true);
  assert.equal(validateWords(WORD_BANKS.grade4.words, 'supplemental').length, 50);
  const batch = importQuizBatch([], [example]); assert.equal(batch.valid, true);
  let saved; const storage = { getItem: () => saved ?? null, setItem: (_, value) => { saved = value; } };
  const store = createLibraryStore(quiz, { key: 'spelling-test', storageProvider: () => storage });
  store.save({ quizzes: batch.quizzes, selectedId: quiz.quiz_id });
  assert.deepEqual(store.load().quizzes[0], quiz);
});

test('malformed spelling definitions return useful errors and reject atomic imports', () => {
  const mutations = [
    [(q) => delete q.title, /Title/], [(q) => q.type = 'unknown', /type/],
    [(q) => q.words.pop(), /exactly 10/], [(q) => q.words[0].word = ' ', /Word 1/],
    [(q) => q.words[0].word = 12, /Word 1/], [(q) => q.words[1].word = 'CURIOUS', /Duplicate/],
    [(q) => q.words[1].id = 1, /unique numeric/], [(q) => q.words[0].category = 'supplemental', /category/],
    [(q) => q.words[0].audio = 'https://example.com/a.mp3', /audio/],
    [(q) => q.words[0].audio = '/audio/../a.mp3', /audio/],
    [(q) => q.words[0].sentence = 'No matching word.', /sentence/],
    [(q) => delete q.settings, /settings/], [(q) => delete q.settings.extraWordBank, /bank/],
    [(q) => q.settings.extraWordBank = 'toString', /bank/], [(q) => q.settings.extraWordBank = 'grade5', /bank/],
    [(q) => q.settings.defaultExtraWordCount = -1, /count/], [(q) => q.settings.shuffle = 'yes', /Shuffle/],
    [(q) => q.grade = 3, /bank/], [(q) => q.language = '', /Language/],
  ];
  for (const [mutate, pattern] of mutations) {
    const invalid = structuredClone(example); mutate(invalid);
    const result = normalizeQuiz(invalid); assert.equal(result.valid, false); assert.match(result.error, pattern);
    assert.equal(importQuizBatch([], [example, invalid]).valid, false);
  }
  const recorded = structuredClone(example); recorded.words[0].audio = '/audio/week-1/word_01.mp3';
  assert.equal(normalizeQuiz(recorded).valid, true);
});

test('all modes choose unique words with correct counts, categories, grade and randomization', () => {
  const original = JSON.stringify(quiz);
  for (let run = 0; run < 50; run++) {
    for (const mode of ['weekly', 'mixed', 'grade']) {
      const session = spellingSession(quiz, { mode });
      assert.equal(session.questions.length, mode === 'mixed' ? 15 : 10);
      assert.equal(new Set(session.questions.map((q) => normalizeSpelling(q.word))).size, session.questions.length);
      assert.equal(session.questions.filter((q) => q.category === 'weekly').length, mode === 'grade' ? 0 : 10);
      for (const q of session.questions.filter((q) => q.category === 'supplemental')) assert.ok(WORD_BANKS.grade4.words.some((w) => w.word === q.word));
      if (mode !== 'grade') assert.deepEqual(session.questions.filter((q) => q.category === 'weekly').map((q) => q.word).sort(), quiz.words.map((q) => q.word).sort());
    }
  }
  assert.equal(JSON.stringify(quiz), original);
  assert.equal(spellingSession(quiz, { mode: 'mixed', count: 7 }).questions.length, 17);
  assert.equal(spellingSession(quiz, { mode: 'grade', count: 20 }).questions.length, 20);
  for (const count of [-1, 1.5, 100]) assert.throws(() => spellingSession(quiz, { mode: 'mixed', count }), /whole number/);
  assert.throws(() => spellingSession(quiz, { mode: 'grade', count: 0 }), /whole number/);
  const noShuffle = { ...quiz, settings: { ...quiz.settings, shuffle: false } };
  assert.deepEqual(spellingSession(noShuffle).questions.map((q) => q.word), quiz.words.map((q) => q.word));
});

test('mixed selection excludes overlapping weekly bank words', () => {
  const overlapping = structuredClone(quiz); overlapping.words[0] = { id: 1, word: 'address', category: 'weekly' };
  const session = spellingSession(overlapping, { mode: 'mixed', count: 49 });
  assert.equal(session.questions.filter((q) => q.word === 'address').length, 1);
  assert.throws(() => spellingSession(overlapping, { mode: 'mixed', count: 50 }), /whole number/);
});

test('deterministic spelling, skip accounting, provenance and missed-only retry', () => {
  const session = spellingSession(quiz, { mode: 'mixed' }); const attempt = createAttempt(session); attempt.attemptNumber = 2;
  for (const q of session.questions) attempt.answers[q.id] = `  ${q.answer.toUpperCase()}  `;
  const wrong = session.questions[0]; attempt.answers[wrong.id] = 'misspelled'; attempt.skipped.push(session.questions[1].id);
  const result = gradeAttempt(attempt, 0);
  assert.equal(result.correct, 13); assert.equal(result.incorrect, 1); assert.equal(result.skipped, 1); assert.equal(result.attempted, 14);
  assert.equal(result.groups.weekly.total + result.groups.supplemental.total, 14);
  assert.equal(result.rows[0].quizId, quiz.quiz_id); assert.equal(result.rows[0].attemptNumber, 2); assert.match(result.rows[0].wordId, /^(weekly|supplemental):\d+$/);
  const retry = spellingSession(quiz, { retry: result.missed }); assert.deepEqual(retry.questions.map((q) => q.word), [wrong.word]);
  assert.equal(retry.questions[0].sourceWordId, wrong.sourceWordId);
  assert.equal(normalizeSpelling(' e\u0301 '), normalizeSpelling('É'));
  assert.notEqual(normalizeSpelling("they're"), normalizeSpelling('theyre'));
  assert.notEqual(normalizeSpelling('ice-cream'), normalizeSpelling('ice cream'));
  attempt.skipped = session.questions.map((q) => q.id);
  assert.equal(gradeAttempt(attempt, 0).scorePercent, 0);
});

