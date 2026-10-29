import { normalizeSpellingQuiz, normalizeSpelling } from './spelling.js';
export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_BATCH_FILES = 20;
export const MAX_LIBRARY_QUIZZES = 50;
export const MAX_LIBRARY_BYTES = 2 * 1024 * 1024;
export const MAX_QUESTIONS = 200;
const sessionLibraries = new Map();
const sessionAvailability = new Map();

export function createLocalId(randomSource = () => globalThis.crypto) {
  const bytes = new Uint8Array(16);
  const cryptoSource = randomSource();
  if (cryptoSource?.getRandomValues) cryptoSource.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const chars = (value) => Array.from(value).length;
const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function fail(error) { return { valid: false, error }; }

export function normalizeQuiz(payload, { idFactory = createLocalId } = {}) {
  if (!plainObject(payload)) return fail('Quiz file must contain a JSON object.');
  if (payload.type === 'spelling') return normalizeSpellingQuiz(payload, idFactory);
  if (payload.type !== undefined && payload.type !== 'numeric') return fail('Unsupported quiz type.');
  const allowedQuizKeys = new Set(['quiz_id', 'title', 'type', 'time_limit_seconds', 'questions']);
  if (Object.keys(payload).some((key) => !allowedQuizKeys.has(key))) return fail('Quiz contains an unsupported top-level field.');
  if (typeof payload.title !== 'string' || !payload.title.trim() || chars(payload.title.trim()) > 120) return fail('Title must contain 1–120 characters.');
  const time = payload.time_limit_seconds === undefined ? 0 : payload.time_limit_seconds;
  if (!Number.isInteger(time) || (time !== 0 && (time < 5 || time > 3600))) return fail('Time limit must be 0 or a whole number from 5 to 3,600 seconds.');
  if (!Array.isArray(payload.questions) || payload.questions.length < 1 || payload.questions.length > MAX_QUESTIONS) return fail('Quiz must have 1–200 questions.');

  let quizId;
  if (own(payload, 'quiz_id')) {
    if (typeof payload.quiz_id !== 'string' || !payload.quiz_id || payload.quiz_id !== payload.quiz_id.trim() || chars(payload.quiz_id) > 80) return fail('Quiz ID must be a trimmed string of at most 80 characters.');
    quizId = payload.quiz_id;
  } else quizId = idFactory();
  if (typeof quizId !== 'string' || !quizId || chars(quizId) > 80) return fail('Could not assign a valid local quiz ID.');

  const ids = new Set();
  const questions = [];
  const allowedQuestionKeys = new Set(['id', 'skill', 'prompt', 'type', 'answer', 'unit', 'tolerance', 'choices']);
  for (let index = 0; index < payload.questions.length; index += 1) {
    const question = payload.questions[index];
    const label = `Question ${index + 1}`;
    if (!plainObject(question) || Object.keys(question).some((key) => !allowedQuestionKeys.has(key))) return fail(`${label} is not a supported question object.`);
    if (!Number.isInteger(question.id) || question.id < 1 || question.id > 1_000_000) return fail(`${label} ID must be a whole number from 1 to 1,000,000.`);
    if (ids.has(question.id)) return fail(`Question ID ${question.id} is duplicated.`);
    ids.add(question.id);
    if (typeof question.prompt !== 'string' || !question.prompt.trim() || chars(question.prompt) > 2000) return fail(`${label} prompt must contain 1–2,000 characters.`);
    if (question.skill !== undefined && (typeof question.skill !== 'string' || chars(question.skill) > 120)) return fail(`${label} skill must be text no longer than 120 characters.`);
    if (question.unit !== undefined && (typeof question.unit !== 'string' || chars(question.unit) > 40)) return fail(`${label} unit must be text no longer than 40 characters.`);
    if (question.type !== undefined && question.type !== 'numeric') return fail(`${label} uses an unsupported question type; only numeric questions are supported.`);
    if (question.choices !== undefined && (!Array.isArray(question.choices) || question.choices.length > 0)) return fail(`${label} must not include answer choices.`);
    if (typeof question.answer !== 'number' || !Number.isFinite(question.answer) || Math.abs(question.answer) > 1e12) return fail(`${label} answer must be a finite number with absolute value at most 1e12.`);
    const tolerance = question.tolerance === undefined ? 0.01 : question.tolerance;
    if (typeof tolerance !== 'number' || !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1e6) return fail(`${label} tolerance must be a finite number from 0 through 1,000,000.`);
    questions.push({ id: question.id, skill: question.skill ?? '', prompt: question.prompt, type: 'numeric', answer: question.answer, unit: question.unit ?? '', tolerance });
  }
  questions.sort((a, b) => a.id - b.id);
  return { valid: true, quiz: { quiz_id: quizId, title: payload.title.trim(), time_limit_seconds: time, questions } };
}

export function validateLibrary(quizzes) {
  if (!Array.isArray(quizzes) || quizzes.length < 1 || quizzes.length > MAX_LIBRARY_QUIZZES) return fail('Library must contain 1–50 quizzes.');
  const ids = new Set();
  const normalized = [];
  for (const quiz of quizzes) {
    const result = normalizeQuiz(quiz, { idFactory: () => '' });
    if (!result.valid) return result;
    if (ids.has(result.quiz.quiz_id)) return fail(`Quiz ID “${result.quiz.quiz_id}” is already in the library.`);
    ids.add(result.quiz.quiz_id); normalized.push(result.quiz);
  }
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > MAX_LIBRARY_BYTES) return fail('Library exceeds the 2 MiB normalized storage limit.');
  return { valid: true, quizzes: normalized };
}

export function importQuizBatch(current, payloads, { idFactory = createLocalId } = {}) {
  if (!Array.isArray(payloads) || payloads.length < 1 || payloads.length > MAX_BATCH_FILES) return fail('Choose between 1 and 20 quiz files.');
  const next = [...current];
  const ids = new Set(current.map((quiz) => quiz.quiz_id));
  for (const payload of payloads) {
    const result = normalizeQuiz(payload, { idFactory });
    if (!result.valid) return result;
    if (ids.has(result.quiz.quiz_id)) return fail(`Quiz ID “${result.quiz.quiz_id}” is already in the library or import batch.`);
    ids.add(result.quiz.quiz_id); next.push(result.quiz);
  }
  if (next.length > MAX_LIBRARY_QUIZZES) return fail('Import would exceed the 50-quiz library limit.');
  const checked = validateLibrary(next);
  return checked.valid ? { valid: true, quizzes: checked.quizzes } : checked;
}

export function parseNumericAnswer(raw) {
  if (typeof raw !== 'string') return { kind: 'invalid', value: null };
  let value = raw.trim();
  if (!value) return { kind: 'blank', value: null };
  if (value.endsWith('%')) value = value.slice(0, -1).trim();
  if (value.startsWith('$')) value = value.slice(1);
  const match = value.match(/^([+-]?)(.*?)([eE][+-]?\d+)?$/);
  if (!match) return { kind: 'invalid', value: null };
  const [, sign, mantissaRaw, exponent = ''] = match;
  const mantissa = mantissaRaw;
  const numeric = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?$|^\.\d+$/;
  if (!numeric.test(mantissa)) return { kind: 'invalid', value: null };
  const parsed = Number(`${sign}${mantissa.replaceAll(',', '')}${exponent}`);
  return Number.isFinite(parsed) ? { kind: 'number', value: parsed } : { kind: 'invalid', value: null };
}

export function createAttempt(quiz) {
  return { quiz, answers: Object.create(null), flagged: [], currentIndex: 0, started: false, paused: false, finalized: false, result: null, skipped: [], attemptNumber: 1 };
}

export function reviewRows(attempt) {
  return attempt.quiz.questions.map((question, index) => ({
    index,
    id: question.id,
    skill: question.skill,
    answered: Boolean(String(attempt.answers[question.id] ?? '').trim()),
    flagged: attempt.flagged.includes(question.id),
  }));
}

export function gradeAttempt(attempt, elapsedSeconds) {
  const rows = attempt.quiz.questions.map((question) => {
    const raw = String(attempt.answers[question.id] ?? '');
    if (question.type === 'spelling') {
      const skipped = attempt.skipped.includes(question.id);
      return { id: question.id, quizId: attempt.quiz.sourceQuizId ?? attempt.quiz.quiz_id, wordId: question.sourceWordId, attemptNumber: attempt.attemptNumber, category: question.category, raw, expected: question.answer, correct: !skipped && normalizeSpelling(raw) === normalizeSpelling(question.answer), skipped, definition: question.definition };
    }
    const parsed = parseNumericAnswer(raw);
    const correct = parsed.kind === 'number' && Math.abs(parsed.value - question.answer) <= question.tolerance;
    return { id: question.id, skill: question.skill, prompt: question.prompt, raw, parsedValue: parsed.value, expected: question.answer, unit: question.unit, correct, flagged: attempt.flagged.includes(question.id) };
  });
  const correctCount = rows.filter((row) => row.correct).length;
  if (attempt.quiz.type === 'spelling') {
    const attempted = rows.filter((row) => !row.skipped).length;
    const groups = Object.fromEntries(['weekly', 'supplemental'].map((category) => {
      const group = rows.filter((row) => row.category === category && !row.skipped);
      return [category, { correct: group.filter((row) => row.correct).length, total: group.length }];
    }));
    return { correct: correctCount, incorrect: attempted - correctCount, attempted, skipped: rows.length - attempted, total: rows.length, scorePercent: attempted ? Math.round(correctCount / attempted * 100) : 0, groups, rows, missed: rows.filter((row) => !row.correct && !row.skipped) };
  }
  return { correct: correctCount, total: rows.length, scorePercent: Math.round(correctCount / rows.length * 100), elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)), rows };
}

export function createLibraryStore(defaultQuiz, { storageProvider = () => globalThis.localStorage, key = 'parcade.illuminate.library.v1' } = {}) {
  let cache = null;
  let available = true;
  const fallback = () => ({ quizzes: [structuredClone(defaultQuiz)], selectedId: defaultQuiz.quiz_id });
  const cloneState = (state) => structuredClone(state);
  function load() {
    if (!cache && sessionLibraries.has(key)) {
      cache = structuredClone(sessionLibraries.get(key));
      available = sessionAvailability.get(key) ?? true;
    }
    if (cache) return { ...cloneState(cache), available };
    try {
      const storage = storageProvider();
      const raw = storage.getItem(key);
      if (raw === null) { cache = fallback(); sessionLibraries.set(key, cache); sessionAvailability.set(key, true); return { ...cloneState(cache), available: true }; }
      const parsed = JSON.parse(raw);
      const validated = validateLibrary(parsed.quizzes);
      if (!validated.valid || typeof parsed.selectedId !== 'string' || !validated.quizzes.some((quiz) => quiz.quiz_id === parsed.selectedId)) {
        cache = fallback(); available = false; sessionLibraries.set(key, cache); sessionAvailability.set(key, false); return { ...cloneState(cache), available };
      }
      cache = { quizzes: validated.quizzes, selectedId: parsed.selectedId };
      sessionLibraries.set(key, cache); sessionAvailability.set(key, true);
      return { ...cloneState(cache), available: true };
    } catch {
      cache = fallback(); available = false; sessionLibraries.set(key, cache); sessionAvailability.set(key, false); return { ...cloneState(cache), available };
    }
  }
  function save(state) {
    cache = cloneState(state);
    sessionLibraries.set(key, cache);
    try { storageProvider().setItem(key, JSON.stringify(cache)); available = true; sessionAvailability.set(key, true); return true; }
    catch { available = false; sessionAvailability.set(key, false); return false; }
  }
  return { load, save, get available() { return available; } };
}
