import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_QUIZ } from '../src/illuminate/example.js';
import { createAttempt, createLibraryStore, createLocalId, gradeAttempt, importQuizBatch, MAX_FILE_BYTES, MAX_LIBRARY_BYTES, MAX_LIBRARY_QUIZZES, normalizeQuiz, parseNumericAnswer, reviewRows, validateLibrary } from '../src/illuminate/model.js';

const q = (id, overrides = {}) => ({ id, prompt: `Prompt ${id}`, answer: id, ...overrides });
const quiz = (overrides = {}) => ({ title: 'Practice', questions: [q(2), q(1)], ...overrides });

test('normalization fills source defaults and sorts stable question IDs', () => {
  const result = normalizeQuiz(quiz(), { idFactory: () => 'legacy-local-id' });
  assert.equal(result.valid, true);
  assert.equal(result.quiz.quiz_id, 'legacy-local-id');
  assert.equal(result.quiz.time_limit_seconds, 0);
  assert.deepEqual(result.quiz.questions.map(({ id }) => id), [1, 2]);
  assert.deepEqual(result.quiz.questions[0], { id: 1, skill: '', prompt: 'Prompt 1', type: 'numeric', answer: 1, unit: '', tolerance: 0.01 });
});

test('legacy quiz ID generation works with getRandomValues when randomUUID is unavailable', () => {
  const id = createLocalId(() => ({ getRandomValues: (bytes) => { bytes.fill(1); return bytes; } }));
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(normalizeQuiz(quiz()).valid, true);
});

test('schema validates numeric question bounds, title, time, tolerance, and unique IDs', () => {
  assert.equal(normalizeQuiz(quiz({ quiz_id: 'id', title: ` ${'x'.repeat(121)} ` })).valid, false);
  assert.match(normalizeQuiz(quiz({ time_limit_seconds: null })).error, /Time limit/);
  assert.match(normalizeQuiz(quiz({ time_limit_seconds: 4 })).error, /Time limit/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1), q(1)] })).error, /duplicated/);
  assert.match(normalizeQuiz(quiz({ questions: [q(0)] })).error, /ID/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1, { answer: '1' })] })).error, /finite number/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1, { answer: Number.POSITIVE_INFINITY })] })).error, /finite number/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1, { tolerance: null })] })).error, /tolerance/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1, { type: 'multiple-choice' })] })).error, /unsupported question type/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1, { choices: ['one'] })] })).error, /answer choices/);
  assert.match(normalizeQuiz(quiz({ questions: [q(1, { prompt: '   ' })] })).error, /prompt/);
  assert.match(normalizeQuiz({ ...quiz(), extra: true }).error, /top-level field/);
});

test('import batches commit all valid files together and reject mixed-invalid and duplicate IDs atomically', () => {
  const current = [normalizeQuiz(quiz({ quiz_id: 'existing' })).quiz];
  const imported = importQuizBatch(current, [quiz({ quiz_id: 'new-a' }), quiz({ quiz_id: 'new-b' })]);
  assert.equal(imported.valid, true); assert.equal(imported.quizzes.length, 3); assert.equal(current.length, 1);
  assert.match(importQuizBatch(current, [quiz({ quiz_id: 'new' }), { title: 'broken', questions: [] }]).error, /1–200/);
  assert.equal(importQuizBatch(current, [quiz({ quiz_id: 'existing' })]).valid, false);
  assert.equal(importQuizBatch(current, [quiz({ quiz_id: 'dupe' }), quiz({ quiz_id: 'dupe' })]).valid, false);
  assert.equal(importQuizBatch(current, Array.from({ length: 21 }, () => quiz())).valid, false);
  assert.equal(importQuizBatch(Array.from({ length: MAX_LIBRARY_QUIZZES }, (_, index) => normalizeQuiz(quiz({ quiz_id: `id-${index}` })).quiz), [quiz({ quiz_id: 'over-limit' })]).valid, false);
  assert.equal(MAX_FILE_BYTES, 524288);
});

test('normalized UTF-8 library cap rejects oversized content without changing inputs', () => {
  const largeQuiz = (id) => normalizeQuiz({ quiz_id: id, title: 'Large', questions: Array.from({ length: 200 }, (_, index) => q(index + 1, { prompt: 'é'.repeat(2000) })) }).quiz;
  const candidate = Array.from({ length: 6 }, (_, index) => largeQuiz(`large-${index}`));
  assert.ok(new TextEncoder().encode(JSON.stringify(candidate)).byteLength > MAX_LIBRARY_BYTES);
  const result = validateLibrary(candidate);
  assert.equal(result.valid, false); assert.match(result.error, /2 MiB/);
});

test('numeric parser accepts source formats and full signed decimal/exponent values', () => {
  for (const [raw, expected] of [['16', 16], ['$1,234.50', 1234.5], ['75%', 75], [' -1.25e2 ', -125], ['.5', 0.5], ['0', 0], ['1,000,000', 1000000]]) {
    assert.deepEqual(parseNumericAnswer(raw), { kind: 'number', value: expected }, raw);
  }
  assert.deepEqual(parseNumericAnswer('   '), { kind: 'blank', value: null });
});

test('numeric parser rejects malformed groups, internal whitespace, partials, and non-finite values', () => {
  for (const raw of ['12abc', '1,23', '12,34,567', '$$12', '- 1', '1 e2', '$ 1', '1e', 'Infinity', 'NaN', '12$', '1%%']) {
    assert.deepEqual(parseNumericAnswer(raw), { kind: 'invalid', value: null }, raw);
  }
});

test('review uses trimmed answered state and flags while grading absolute tolerance', () => {
  const normalized = normalizeQuiz({ quiz_id: 'ordered', title: 'Quiz', questions: [q(9, { answer: 3.5, tolerance: 0.1 }), q(2, { answer: 10, tolerance: 0 })] }).quiz;
  const attempt = createAttempt(normalized); attempt.answers[2] = '  '; attempt.answers[9] = '3.59'; attempt.flagged = [2, 9];
  assert.deepEqual(reviewRows(attempt).map((row) => [row.id, row.answered, row.flagged]), [[2, false, true], [9, true, true]]);
  const result = gradeAttempt(attempt, 12.9);
  assert.equal(result.correct, 1); assert.equal(result.total, 2); assert.equal(result.scorePercent, 50); assert.equal(result.elapsedSeconds, 12);
  assert.deepEqual(result.rows.map((row) => row.correct), [false, true]);
  assert.equal(result.rows[1].raw, '3.59');
});

test('library cache survives remount and blocked writes without replacing stale disk data', () => {
  const old = { quizzes: [EXAMPLE_QUIZ], selectedId: EXAMPLE_QUIZ.quiz_id };
  let disk = JSON.stringify(old); let blockWrite = true;
  const storage = { getItem: () => disk, setItem: (_key, value) => { if (blockWrite) throw new Error('quota'); disk = value; } };
  const key = `illuminate-cache-${crypto.randomUUID()}`;
  const first = createLibraryStore(EXAMPLE_QUIZ, { storageProvider: () => storage, key });
  assert.equal(first.load().quizzes.length, 1);
  const extra = normalizeQuiz(quiz({ quiz_id: 'memory-new' })).quiz;
  assert.equal(first.save({ quizzes: [EXAMPLE_QUIZ, extra], selectedId: extra.quiz_id }), false);
  assert.equal(disk, JSON.stringify(old));
  const remount = createLibraryStore(EXAMPLE_QUIZ, { storageProvider: () => storage, key });
  const loaded = remount.load();
  assert.equal(loaded.available, false); assert.equal(loaded.selectedId, 'memory-new'); assert.equal(loaded.quizzes.length, 2);
});

test('corrupt stored library falls back without deleting the stored bytes', () => {
  let writes = 0; const invalidDisk = '{ broken json';
  const storage = { getItem: () => invalidDisk, setItem: () => { writes += 1; } };
  const store = createLibraryStore(EXAMPLE_QUIZ, { storageProvider: () => storage, key: `illuminate-corrupt-${crypto.randomUUID()}` });
  const loaded = store.load();
  assert.equal(loaded.available, false); assert.equal(loaded.quizzes[0].quiz_id, EXAMPLE_QUIZ.quiz_id); assert.equal(writes, 0);
});
