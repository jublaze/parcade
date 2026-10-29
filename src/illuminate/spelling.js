import grade4 from './word-banks/grade4.json' with { type: 'json' };
export const WORD_BANKS = { grade4 };
export const normalizeSpelling = (value) => value.trim().normalize('NFC').toLowerCase();
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export function validateWords(words, category = 'weekly') {
  if (!Array.isArray(words) || !words.length) throw new Error('Words must be a nonempty array.');
  const seen = new Set(); const ids = new Set();
  return words.map((entry, index) => {
    if (!object(entry) || Object.keys(entry).some((key) => !['id', 'word', 'category', 'sentence', 'audio'].includes(key))) throw new Error(`Word ${index + 1} is not a supported word object.`);
    if (!text(entry.word, 80)) throw new Error(`Word ${index + 1} must contain 1–80 characters.`);
    const word = entry.word.trim().normalize('NFC');
    const key = normalizeSpelling(word);
    if (seen.has(key)) throw new Error(`Duplicate spelling word at entry ${index + 1}.`);
    seen.add(key);
    const id = entry.id ?? index + 1;
    if (!Number.isInteger(id) || id < 1 || id > 1000000 || ids.has(id)) throw new Error(`Word ${index + 1} needs a unique numeric ID from 1 to 1,000,000.`);
    ids.add(id);
    if (entry.category !== undefined && entry.category !== category) throw new Error(`Word ${index + 1} category must be ${category}.`);
    if (entry.sentence !== undefined && (!text(entry.sentence, 2000) || !normalizeSpelling(entry.sentence).includes(key))) throw new Error(`Word ${index + 1} sentence must contain its word and be at most 2,000 characters.`);
    if (entry.audio !== undefined && (typeof entry.audio !== 'string' || !/^\/audio\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(mp3|wav|ogg|m4a)$/.test(entry.audio))) throw new Error(`Word ${index + 1} audio must reference a file under /audio/.`);
    return { id, word, category, ...(entry.sentence !== undefined ? { sentence: entry.sentence } : {}), ...(entry.audio !== undefined ? { audio: entry.audio } : {}) };
  });
}
export function normalizeSpellingQuiz(payload, idFactory) {
  try {
    if (Object.keys(payload).some((key) => !['quiz_id', 'title', 'type', 'grade', 'language', 'settings', 'words'].includes(key))) throw new Error('Spelling quiz contains an unsupported field.');
    if (!text(payload.title, 120)) throw new Error('Title must contain 1–120 characters.');
    const quiz_id = payload.quiz_id ?? idFactory();
    if (!text(quiz_id, 80) || quiz_id !== quiz_id.trim()) throw new Error('Quiz ID must be a trimmed string of at most 80 characters.');
    if (!Number.isInteger(payload.grade) || payload.grade < 1 || payload.grade > 12) throw new Error('Grade must be a whole number from 1 to 12.');
    if (!text(payload.language, 40) || !/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(payload.language)) throw new Error('Language must be a language tag such as en-US.');
    const settings = payload.settings;
    if (!object(settings) || Object.keys(settings).some((key) => !['extraWordBank', 'defaultExtraWordCount', 'shuffle'].includes(key))) throw new Error('Spelling settings are required and contain unsupported fields.');
    const bank = WORD_BANKS[settings.extraWordBank];
    if (!Object.hasOwn(WORD_BANKS, settings.extraWordBank) || bank.grade !== payload.grade || bank.language !== payload.language) throw new Error('Unknown or missing supplemental word bank for this grade and language.');
    const words = validateWords(payload.words);
    if (words.length !== 10) throw new Error('Weekly spelling quizzes must contain exactly 10 words.');
    const available = bank.words.filter((entry) => !words.some((weekly) => normalizeSpelling(weekly.word) === normalizeSpelling(entry.word))).length;
    const count = settings.defaultExtraWordCount ?? 5;
    if (!Number.isInteger(count) || count < 0 || count > available) throw new Error(`Extra word count must be a whole number from 0 to ${available}.`);
    if (settings.shuffle !== undefined && typeof settings.shuffle !== 'boolean') throw new Error('Shuffle must be true or false.');
    return { valid: true, quiz: { quiz_id, title: payload.title.trim(), type: 'spelling', grade: payload.grade, language: payload.language, settings: { extraWordBank: settings.extraWordBank, defaultExtraWordCount: count, shuffle: settings.shuffle ?? true }, words } };
  } catch (error) { return { valid: false, error: error.message }; }
}
function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function spellingSession(quiz, { mode = 'weekly', count = mode === 'mixed' ? quiz.settings.defaultExtraWordCount : 10, random = Math.random, retry = null } = {}) {
  if (!['weekly', 'mixed', 'grade'].includes(mode)) throw new Error('Unsupported spelling mode.');
  const bank = WORD_BANKS[quiz.settings.extraWordBank];
  let words;
  if (retry) words = retry.map((row) => row.definition);
  else if (mode === 'weekly') words = quiz.words;
  else {
    const weeklyKeys = new Set(quiz.words.map((entry) => normalizeSpelling(entry.word)));
    const pool = validateWords(bank.words, 'supplemental').filter((entry) => mode === 'grade' || !weeklyKeys.has(normalizeSpelling(entry.word)));
    if (!Number.isInteger(count) || count < (mode === 'grade' ? 1 : 0) || count > pool.length) throw new Error(`Choose a whole number from ${mode === 'grade' ? 1 : 0} to ${pool.length}.`);
    words = [...(mode === 'mixed' ? quiz.words : []), ...shuffled(pool, random).slice(0, count)];
  }
  if (quiz.settings.shuffle || mode !== 'weekly' || retry) words = shuffled(words, random);
  return { ...quiz, sourceQuizId: quiz.quiz_id, mode, time_limit_seconds: 0, questions: words.map((entry, index) => ({ ...entry, sourceWordId: `${entry.category}:${entry.id}`, id: index + 1, type: 'spelling', prompt: 'Listen and spell the word.', answer: entry.word, skill: entry.category === 'weekly' ? 'Weekly spelling' : 'Extra practice', definition: entry })) };
}
