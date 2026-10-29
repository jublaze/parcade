import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, startGame } from '../src/game.js';
import { createMazeState, mazeTickMs } from '../src/maze/game.js';
import { startHolmGame, tickHolmGame } from '../src/holm/game.js';
import { CLASSIC_SOURCE, HOLM_SOURCE, MAZE_SOURCE, MATH_SOURCE, validateClassicConfig, validateHolmConfig, validateMazeConfig, validateMathConfig } from '../src/settings.js';
import { readSavedConfig, writeSavedConfig } from '../src/settings-core.js';

const zero = () => 0;

test('Classic configuration accepts bounded integers and rejects malformed values', () => {
  assert.deepEqual(validateClassicConfig({ preset: 'custom', boardSize: '40', tickMs: '1000' }), { valid: true, value: { preset: 'custom', boardSize: 40, tickMs: 1000 }, error: '', field: '' });
  assert.equal(validateClassicConfig({ boardSize: '11', tickMs: '120' }).valid, false);
  assert.equal(validateClassicConfig({ boardSize: '20.5', tickMs: '120' }).valid, false);
  assert.deepEqual(CLASSIC_SOURCE, { preset: 'source', boardSize: 20, tickMs: 120 });
});

test('Classic snapshots apply board dimensions while source defaults retain the original placement', () => {
  const source = createGameState({ random: zero, config: CLASSIC_SOURCE });
  assert.deepEqual(source.snake[0], { x: 11, y: 9 });
  const custom = startGame(createGameState({ random: zero, config: { preset: 'custom', boardSize: 12, tickMs: 200 } }));
  assert.equal(custom.boardSize, 12); assert.equal(custom.tickMs, 200);
  assert.equal(custom.snake[0].x, 7); assert.equal(custom.snake[0].y, 5);
});

test('Maze config validates floor relation and applies speed and trap count to a new run', () => {
  assert.equal(validateMazeConfig({ startMs: '40', floorMs: '41', levelStepMs: '0', trapsPerLevel: '0', trapMode: 'refresh' }).field, 'floorMs');
  assert.equal(validateMazeConfig({ startMs: '500', floorMs: '20', levelStepMs: '10', trapsPerLevel: '30', trapMode: 'persist' }).valid, true);
  const config = { ...MAZE_SOURCE, startMs: 120, floorMs: 60, levelStepMs: 2, trapsPerLevel: 1 };
  const game = createMazeState({ config, trapMode: 'persist', random: zero });
  assert.equal(mazeTickMs(3, game.config), 116); assert.equal(game.traps.length, 1); assert.equal(game.trapMode, 'persist');
});

test('Snakeholm validates all fields and uses configured world, food cadence, population, and active-time limit', () => {
  assert.equal(validateHolmConfig({ ...HOLM_SOURCE, timeLimitSeconds: '14' }).field, 'timeLimitSeconds');
  assert.equal(validateHolmConfig({ ...HOLM_SOURCE, obstacles: '301' }).field, 'obstacles');
  const config = { ...HOLM_SOURCE, preset: 'custom', startingPopulation: 9, obstacles: 7, traps: 2, foodEveryTicks: 2, timeLimitSeconds: 15, barbarianEnabled: false };
  const started = startHolmGame('Ada', { config, barbarianEnabled: false, random: zero });
  assert.equal(started.population, 8); assert.equal(started.obstacles.length, 7); assert.equal(started.traps.length, 2); assert.equal(started.barbarianPos, null);
  const next = tickHolmGame({ ...started, ticks: 1 }, { elapsedMs: 0, random: zero });
  assert.equal(next.ticks, 2); assert.equal(next.food.length, 1);
  const ended = tickHolmGame(started, { elapsedMs: 15000, timestamp: 'limit' });
  assert.equal(ended.endReason, 'time');
});

test('settings session cache wins over stale disk data and survives blocked storage reads and writes', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const stored = new Map([['parcade.settings.cache-test', JSON.stringify({ preset: 'easy', boardSize: 24, tickMs: 180 })]]);
  globalThis.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: () => { throw new Error('storage blocked'); },
  };
  try {
    const key = 'parcade.settings.cache-test';
    const validate = (value) => validateClassicConfig(value);
    const before = readSavedConfig(key, CLASSIC_SOURCE, validate);
    assert.equal(before.config.preset, 'easy');
    assert.equal(writeSavedConfig(key, { preset: 'custom', boardSize: 30, tickMs: 240 }), false);
    const after = readSavedConfig(key, CLASSIC_SOURCE, validate);
    assert.deepEqual(after.config, { preset: 'custom', boardSize: 30, tickMs: 240 });
    assert.equal(after.available, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('Math Ladder defaults and preset settings preserve source defaults and validate extensions', () => {
  assert.deepEqual(MATH_SOURCE, { preset: 'source', operations: ['addition'], digits: 2, timeLimitSeconds: 45, correctToWin: 6, wrongToLose: 3, customRangeEnabled: false, operandMin: null, operandMax: null });
  assert.equal(validateMathConfig({ ...MATH_SOURCE, operations: [] }).field, 'operations');
  assert.equal(validateMathConfig({ ...MATH_SOURCE, digits: '5' }).field, 'digits');
  assert.equal(validateMathConfig({ ...MATH_SOURCE, correctToWin: '0' }).field, 'correctToWin');
  assert.equal(validateMathConfig({ ...MATH_SOURCE, customRangeEnabled: true, operandMin: '', operandMax: '10' }).field, 'operandMin');
  assert.equal(validateMathConfig({ ...MATH_SOURCE, customRangeEnabled: true, operandMin: '11', operandMax: '10' }).field, 'operandMax');
  assert.deepEqual(validateMathConfig({ ...MATH_SOURCE, preset: 'custom', customRangeEnabled: true, operandMin: '0', operandMax: '9999' }).value, { ...MATH_SOURCE, preset: 'custom', customRangeEnabled: true, operandMin: 0, operandMax: 9999 });
});
