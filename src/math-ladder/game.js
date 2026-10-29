export const MATH_OPERATIONS = Object.freeze(['addition', 'subtraction', 'multiplication']);

function frozenConfig(config) {
  const copy = structuredClone(config);
  copy.operations = Object.freeze([...copy.operations]);
  return Object.freeze(copy);
}

function sampleInteger(min, max, random) {
  return min + Math.floor(Math.min(0.999999999999, Math.max(0, random())) * (max - min + 1));
}

export function createQuestion(config, random = Math.random) {
  const operations = config.operations?.length ? config.operations : ['addition'];
  const operation = operations[sampleInteger(0, operations.length - 1, random)];
  const customRange = config.customRangeEnabled;
  const low = customRange ? config.operandMin : operation === 'multiplication' && config.digits >= 3 ? 2 : 1;
  const high = customRange ? config.operandMax : operation === 'multiplication' && config.digits >= 3 ? 99 : (10 ** config.digits) - 1;
  const first = sampleInteger(low, high, random);
  const second = sampleInteger(low, high, random);
  const [a, b] = operation === 'subtraction' ? [Math.max(first, second), Math.min(first, second)] : [first, second];
  const symbol = operation === 'addition' ? '+' : operation === 'subtraction' ? '−' : '×';
  const answer = operation === 'addition' ? a + b : operation === 'subtraction' ? a - b : a * b;
  return Object.freeze({ operation, a, b, answer, prompt: `${a} ${symbol} ${b} =` });
}

export function createSetupState(config) {
  return { status: 'setup', config: frozenConfig(config), rung: 0, wrong: 0, question: null, feedback: '', endReason: null };
}

export function startMathRun(config, random = Math.random) {
  const fixedConfig = frozenConfig(config);
  return { status: 'running', config: fixedConfig, rung: 0, wrong: 0, question: createQuestion(fixedConfig, random), feedback: '', endReason: null };
}

export function expireMathRun(state, elapsedMs) {
  if (state.status !== 'running' || elapsedMs < state.config.timeLimitSeconds * 1000) return state;
  return { ...state, status: 'lost', feedback: 'Time is up.', endReason: 'time' };
}

export function pauseMathRun(state) {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

export function resumeMathRun(state) {
  return state.status === 'paused' ? { ...state, status: 'running' } : state;
}

export function submitMathAnswer(state, input, { elapsedMs = 0, random = Math.random } = {}) {
  const timelyState = expireMathRun(state, elapsedMs);
  if (timelyState !== state) return timelyState;
  if (state.status !== 'running') return state;
  const value = String(input).trim();
  if (!value) return state;
  if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) return { ...state, feedback: 'Numbers only' };
  if (Number(value) === state.question.answer) {
    const rung = state.rung + 1;
    return rung >= state.config.correctToWin
      ? { ...state, status: 'won', rung, feedback: 'Ladder cleared!', endReason: 'win' }
      : { ...state, rung, question: createQuestion(state.config, random), feedback: 'Correct!' };
  }
  const wrong = state.wrong + 1;
  return wrong >= state.config.wrongToLose
    ? { ...state, status: 'lost', wrong, feedback: 'Splat!', endReason: 'wrong' }
    : { ...state, wrong, question: createQuestion(state.config, random), feedback: 'Wrong. New question.' };
}
