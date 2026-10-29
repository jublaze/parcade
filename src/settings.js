export const CLASSIC_PRESETS = Object.freeze({
  easy: { label: 'Easy', values: { preset: 'easy', boardSize: 24, tickMs: 180 } },
  source: { label: 'Source defaults', values: { preset: 'source', boardSize: 20, tickMs: 120 } },
  hard: { label: 'Hard', values: { preset: 'hard', boardSize: 14, tickMs: 80 } },
  custom: { label: 'Custom', values: { preset: 'custom', boardSize: 20, tickMs: 120 } },
});
export const CLASSIC_FIELDS = [
  { key: 'boardSize', label: 'Square board (cells per side)', min: 12, max: 40 },
  { key: 'tickMs', label: 'Tick interval (ms)', min: 40, max: 1000 },
];
export const CLASSIC_SOURCE = CLASSIC_PRESETS.source.values;

export const MAZE_PRESETS = Object.freeze({
  easy: { label: 'Easy', values: { preset: 'easy', startMs: 120, floorMs: 60, levelStepMs: 0, trapsPerLevel: 1, trapMode: 'refresh' } },
  source: { label: 'Source defaults', values: { preset: 'source', startMs: 80, floorMs: 40, levelStepMs: 1, trapsPerLevel: 3, trapMode: 'refresh' } },
  hard: { label: 'Hard', values: { preset: 'hard', startMs: 60, floorMs: 30, levelStepMs: 2, trapsPerLevel: 6, trapMode: 'persist' } },
  custom: { label: 'Custom', values: { preset: 'custom', startMs: 80, floorMs: 40, levelStepMs: 1, trapsPerLevel: 3, trapMode: 'refresh' } },
});
export const MAZE_FIELDS = [
  { key: 'startMs', label: 'Starting tick (ms)', min: 40, max: 500 },
  { key: 'floorMs', label: 'Speed floor (ms)', min: 20, max: 500 },
  { key: 'levelStepMs', label: 'Speed-up per level (ms)', min: 0, max: 10 },
  { key: 'trapsPerLevel', label: 'New traps per level', min: 0, max: 30 },
  { key: 'trapMode', label: 'Trap layout', type: 'select', options: [{ value: 'refresh', label: 'Refresh each level' }, { value: 'persist', label: 'Persist + add' }] },
];
export const MAZE_SOURCE = MAZE_PRESETS.source.values;

export const HOLM_PRESETS = Object.freeze({
  easy: { label: 'Easy', values: { preset: 'easy', tickMs: 180, timeLimitSeconds: 180, startingPopulation: 8, obstacles: 30, traps: 2, foodEveryTicks: 6, barbarianEnabled: false } },
  source: { label: 'Source defaults', values: { preset: 'source', tickMs: 120, timeLimitSeconds: 120, startingPopulation: 5, obstacles: 55, traps: 5, foodEveryTicks: 10, barbarianEnabled: true } },
  hard: { label: 'Hard', values: { preset: 'hard', tickMs: 80, timeLimitSeconds: 90, startingPopulation: 3, obstacles: 90, traps: 10, foodEveryTicks: 15, barbarianEnabled: true } },
  custom: { label: 'Custom', values: { preset: 'custom', tickMs: 120, timeLimitSeconds: 120, startingPopulation: 5, obstacles: 55, traps: 5, foodEveryTicks: 10, barbarianEnabled: true } },
});
export const HOLM_FIELDS = [
  { key: 'tickMs', label: 'Tick interval (ms)', min: 40, max: 1000 },
  { key: 'timeLimitSeconds', label: 'Active time (seconds)', min: 15, max: 600 },
  { key: 'startingPopulation', label: 'Starting population', min: 1, max: 100 },
  { key: 'obstacles', label: 'Obstacles', min: 0, max: 300 },
  { key: 'traps', label: 'Initial traps', min: 0, max: 300 },
  { key: 'foodEveryTicks', label: 'Food cadence (ticks)', min: 1, max: 100 },
  { key: 'barbarianEnabled', label: 'Start with barbarian enabled', type: 'checkbox' },
];
export const HOLM_SOURCE = HOLM_PRESETS.source.values;

export const MATH_PRESETS = Object.freeze({
  easy: { label: 'Easy', values: { preset: 'easy', operations: ['addition', 'subtraction'], digits: 1, timeLimitSeconds: 90, correctToWin: 6, wrongToLose: 5, customRangeEnabled: false, operandMin: null, operandMax: null } },
  source: { label: 'Source defaults', values: { preset: 'source', operations: ['addition'], digits: 2, timeLimitSeconds: 45, correctToWin: 6, wrongToLose: 3, customRangeEnabled: false, operandMin: null, operandMax: null } },
  hard: { label: 'Hard', values: { preset: 'hard', operations: ['addition', 'subtraction', 'multiplication'], digits: 3, timeLimitSeconds: 45, correctToWin: 8, wrongToLose: 2, customRangeEnabled: false, operandMin: null, operandMax: null } },
  custom: { label: 'Custom', values: { preset: 'custom', operations: ['addition'], digits: 2, timeLimitSeconds: 45, correctToWin: 6, wrongToLose: 3, customRangeEnabled: false, operandMin: null, operandMax: null } },
});
export const MATH_FIELDS = [
  { key: 'operations', label: 'Operations (choose one or more)', type: 'multi-checkbox', options: [{ value: 'addition', label: 'Addition' }, { value: 'subtraction', label: 'Subtraction' }, { value: 'multiplication', label: 'Multiplication' }] },
  { key: 'digits', label: 'Maximum digits', min: 1, max: 4 },
  { key: 'timeLimitSeconds', label: 'Timer (seconds)', min: 5, max: 300 },
  { key: 'correctToWin', label: 'Correct answers to win', min: 1, max: 50 },
  { key: 'wrongToLose', label: 'Wrong answers to lose', min: 1, max: 20 },
  { key: 'customRangeEnabled', label: 'Use custom operand range', type: 'checkbox' },
  { key: 'operandMin', label: 'Custom operand minimum', min: 0, max: 9999, optional: true },
  { key: 'operandMax', label: 'Custom operand maximum', min: 0, max: 9999, optional: true },
];
export const MATH_SOURCE = MATH_PRESETS.source.values;

function integer(value, min, max) {
  const number = typeof value === 'number' ? value : String(value).trim() === '' ? NaN : Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}
function result(value, error = '', field = '') { return { valid: !error, value, error, field }; }
function presetName(value) { return ['easy', 'source', 'hard', 'custom'].includes(value) ? value : 'custom'; }
export function validateClassicConfig(draft) {
  const boardSize = integer(draft.boardSize, 12, 40); if (boardSize === null) return result(null, 'Board size must be a whole number from 12 to 40.', 'boardSize');
  const tickMs = integer(draft.tickMs, 40, 1000); if (tickMs === null) return result(null, 'Tick interval must be a whole number from 40 to 1,000 ms.', 'tickMs');
  return result({ preset: presetName(draft.preset), boardSize, tickMs });
}
export function validateMazeConfig(draft) {
  const fields = [['startMs',40,500,'Starting tick'],['floorMs',20,500,'Speed floor'],['levelStepMs',0,10,'Speed-up'],['trapsPerLevel',0,30,'Traps per level']];
  const values = {};
  for (const [key,min,max,label] of fields) { values[key] = integer(draft[key],min,max); if (values[key] === null) return result(null, `${label} must be a whole number from ${min} to ${max}.`, key); }
  if (values.floorMs > values.startMs) return result(null, 'Speed floor cannot exceed the starting tick.', 'floorMs');
  if (!['refresh','persist'].includes(draft.trapMode)) return result(null, 'Choose a valid trap layout.', 'trapMode');
  return result({ preset: presetName(draft.preset), ...values, trapMode: draft.trapMode });
}
export function validateHolmConfig(draft) {
  const fields = [['tickMs',40,1000,'Tick interval'],['timeLimitSeconds',15,600,'Active time'],['startingPopulation',1,100,'Starting population'],['obstacles',0,300,'Obstacles'],['traps',0,300,'Initial traps'],['foodEveryTicks',1,100,'Food cadence']];
  const values = {};
  for (const [key,min,max,label] of fields) { values[key] = integer(draft[key],min,max); if (values[key] === null) return result(null, `${label} must be a whole number from ${min} to ${max}.`, key); }
  if (typeof draft.barbarianEnabled !== 'boolean') return result(null, 'Choose whether the barbarian starts enabled.', 'barbarianEnabled');
  return result({ preset: presetName(draft.preset), ...values, barbarianEnabled: draft.barbarianEnabled });
}
export function validateMathConfig(draft) {
  const operations = Array.isArray(draft.operations) ? [...new Set(draft.operations)] : [];
  if (operations.length < 1 || operations.some((operation) => !['addition', 'subtraction', 'multiplication'].includes(operation))) return result(null, 'Choose at least one valid operation.', 'operations');
  const fields = [['digits',1,4,'Maximum digits'],['timeLimitSeconds',5,300,'Timer'],['correctToWin',1,50,'Correct answers'],['wrongToLose',1,20,'Wrong answers']];
  const values = {};
  for (const [key,min,max,label] of fields) { values[key] = integer(draft[key],min,max); if (values[key] === null) return result(null, `${label} must be a whole number from ${min} to ${max}.`, key); }
  if (typeof draft.customRangeEnabled !== 'boolean') return result(null, 'Choose whether to use a custom operand range.', 'customRangeEnabled');
  let operandMin = null; let operandMax = null;
  if (draft.customRangeEnabled) {
    operandMin = integer(draft.operandMin,0,9999);
    operandMax = integer(draft.operandMax,0,9999);
    if (operandMin === null) return result(null, 'Custom minimum must be a whole number from 0 to 9,999.', 'operandMin');
    if (operandMax === null) return result(null, 'Custom maximum must be a whole number from 0 to 9,999.', 'operandMax');
    if (operandMin > operandMax) return result(null, 'Custom maximum must be at least the minimum.', 'operandMax');
  }
  return result({ preset: presetName(draft.preset), operations, ...values, customRangeEnabled: draft.customRangeEnabled, operandMin, operandMax });
}
