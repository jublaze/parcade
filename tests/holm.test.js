import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLM_HEIGHT, HOLM_OBSTACLE_COUNT, HOLM_START_TRAPS, HOLM_TIME_LIMIT_MS, HOLM_WIDTH, pauseHolmGame, restartHolmGame, resumeHolmGame, setBarbarianEnabled, setRunnerDirection, startHolmGame, tickHolmGame, validatePlayerName } from '../src/holm/game.js';
import { createActiveClock } from '../src/holm/active-clock.js';
import { placementNoticeText } from '../src/holm/notices.js';

const zero = () => 0;
const game = (overrides = {}) => ({ ...startHolmGame('Test', { barbarianEnabled: false, random: zero }), ...overrides, status: 'running' });
const pos = (x, y) => ({ x, y });

test('validates trimmed nonempty names of at most twenty Unicode characters', () => {
  assert.deepEqual(validatePlayerName('  Ada  '), { valid: true, name: 'Ada', error: '' });
  assert.equal(validatePlayerName('  ').valid, false);
  assert.equal(validatePlayerName('🧭'.repeat(21)).valid, false);
  assert.equal(validatePlayerName('🧭'.repeat(20)).valid, true);
});

test('creates a bounded world, safe home buffer, five traps, and first runner at population four', () => {
  const state = startHolmGame('Ada', { random: zero });
  assert.equal(state.status, 'running'); assert.equal(state.home.x, 13); assert.equal(state.home.y, 13);
  assert.equal(state.obstacles.length, HOLM_OBSTACLE_COUNT); assert.equal(state.traps.length, HOLM_START_TRAPS);
  assert.equal(state.population, 4); assert.deepEqual(state.runnerPos, state.home); assert.equal(state.barbarianEnabled, true);
  assert.ok(state.barbarianPos); assert.ok(state.obstacles.every((cell) => Math.abs(cell.x - 13) > 1 || Math.abs(cell.y - 13) > 1));
  assert.ok(state.traps.every((cell) => cell.x >= 2 && !state.obstacles.some((item) => item.x === cell.x && item.y === cell.y)));
  for (const cells of [state.obstacles, state.traps, [state.home, state.runnerPos, state.barbarianPos]]) for (const cell of cells) assert.ok(cell.x >= 0 && cell.x < HOLM_WIDTH && cell.y >= 0 && cell.y < HOLM_HEIGHT);
});

test('supports direct direction reversals, pause/resume, restart, and safe barbarian toggles', () => {
  let state = game({ runnerDirection: 'right' }); state = setRunnerDirection(state, 'left'); assert.equal(state.runnerDirection, 'left');
  state = pauseHolmGame(state); assert.equal(state.status, 'paused'); assert.equal(resumeHolmGame(state).status, 'running');
  state = setBarbarianEnabled(state, true, zero); assert.equal(state.barbarianEnabled, true); assert.ok(state.barbarianPos);
  state = setBarbarianEnabled(state, false); assert.equal(state.barbarianPos, null);
  const fresh = restartHolmGame({ ...state, barbarianEnabled: false }); assert.equal(fresh.status, 'name'); assert.equal(fresh.barbarianEnabled, true);
});

test('food spawns on the tenth tick before barbarian and runner movement', () => {
  const state = game({ ticks: 9, runnerPos: pos(10, 10), home: pos(20, 20), runnerDirection: 'right', obstacles: [], traps: [], food: [], barbarianEnabled: false });
  const next = tickHolmGame(state, { elapsedMs: 0, random: () => .9 });
  assert.equal(next.ticks, 10); assert.equal(next.food.length, 1); assert.deepEqual(next.runnerPos, pos(11, 10));
});

test('food increases population and traps while runner stays in its old cell', () => {
  const state = game({ runnerPos: pos(10, 10), home: pos(20, 20), runnerDirection: 'right', obstacles: [], traps: [pos(3, 3)], food: [pos(11, 10)] });
  const next = tickHolmGame(state, { random: zero });
  assert.deepEqual(next.runnerPos, pos(10, 10)); assert.equal(next.population, state.population + 1); assert.equal(next.traps.length, 2); assert.equal(next.food.length, 0);
});

test('trap collision removes the trap and consumes a life before respawn', () => {
  const state = game({ runnerPos: pos(10, 10), home: pos(20, 20), runnerDirection: 'right', obstacles: [], traps: [pos(11, 10)], food: [] });
  const next = tickHolmGame(state, { random: zero });
  assert.equal(next.population, state.population - 1); assert.deepEqual(next.runnerPos, state.home); assert.equal(next.traps.length, 0); assert.equal(next.lastCollision, 'trap');
});

test('wall and obstacle collisions consume population', () => {
  for (const [runnerPos, direction, obstacles, expected] of [[pos(29, 12), 'right', [], 'wall'], [pos(10, 10), 'right', [pos(11, 10)], 'obstacle']]) {
    const state = game({ runnerPos, runnerDirection: direction, home: pos(20, 20), obstacles, traps: [], food: [] });
    const next = tickHolmGame(state, { random: zero }); assert.equal(next.population, state.population - 1); assert.equal(next.lastCollision, expected); assert.deepEqual(next.runnerPos, state.home);
  }
});

test('barbarian moves before runner; overlap can be escaped, next-cell collision costs a life', () => {
  const escaped = game({ runnerPos: pos(10, 10), runnerDirection: 'right', home: pos(20, 20), obstacles: [], traps: [], food: [], barbarianEnabled: true, barbarianPos: pos(10, 10) });
  // Random first tries left; the barbarian leaves the runner cell before the runner advances.
  const next = tickHolmGame(escaped, { random: () => .5 });
  assert.equal(next.population, escaped.population); assert.deepEqual(next.runnerPos, pos(11, 10));
  const collision = game({ runnerPos: pos(10, 10), runnerDirection: 'right', home: pos(20, 20), obstacles: [], traps: [], food: [], barbarianEnabled: true, barbarianPos: pos(12, 10) });
  const died = tickHolmGame(collision, { random: () => .5 }); assert.equal(died.population, collision.population - 1); assert.equal(died.lastCollision, 'barbarian');
});

test('a runner remains alive at zero population until the next collision requires respawn', () => {
  const state = game({ population: 0, runnerPos: pos(10, 10), runnerDirection: 'right', home: pos(20, 20), obstacles: [], traps: [], food: [] });
  const survived = tickHolmGame(state, { random: zero }); assert.equal(survived.status, 'running'); assert.deepEqual(survived.runnerPos, pos(11, 10));
  const died = tickHolmGame({ ...state, runnerDirection: 'right', runnerPos: pos(29, 10) }, { random: zero, timestamp: 'end' });
  assert.equal(died.status, 'over'); assert.equal(died.endReason, 'population'); assert.equal(died.record.finalPopulation, 0); assert.equal(died.record.timestamp, 'end');
  assert.equal(tickHolmGame(died, { elapsedMs: HOLM_TIME_LIMIT_MS, timestamp: 'later' }).record.timestamp, 'end');
});

test('time expiry occurs before tick, food, or barbarian movement and records once', () => {
  const state = game({ ticks: 9, food: [], barbarianEnabled: false });
  const end = tickHolmGame(state, { elapsedMs: HOLM_TIME_LIMIT_MS, timestamp: 'limit' });
  assert.equal(end.status, 'over'); assert.equal(end.endReason, 'time'); assert.equal(end.ticks, 9); assert.equal(end.record.timestamp, 'limit');
  assert.equal(tickHolmGame(end, { elapsedMs: HOLM_TIME_LIMIT_MS + 10, timestamp: 'twice' }).record.timestamp, 'limit');
});

test('barbarian retries at most eight times and never moves into walls or obstacles', () => {
  const obstacles = [pos(11, 10), pos(9, 10), pos(10, 9), pos(10, 11)];
  const state = game({ runnerPos: pos(20, 20), home: pos(20, 20), runnerDirection: 'up', obstacles, traps: [], food: [], barbarianEnabled: true, barbarianPos: pos(10, 10) });
  let calls = 0; const next = tickHolmGame(state, { random: () => { calls += 1; return 0; } });
  assert.ok(calls <= 20); assert.deepEqual(next.barbarianPos, pos(10, 10));
});

test('placement saturation caps traps and avoids duplicate occupied cells', () => {
  const state = game({ home: pos(15, 15), runnerPos: pos(15, 15), obstacles: Array.from({ length: HOLM_WIDTH * HOLM_HEIGHT }, (_, i) => pos(i % 30, Math.floor(i / 30))).filter((cell) => cell.x !== 15 || cell.y !== 15), traps: [], food: [], barbarianEnabled: false });
  const next = tickHolmGame({ ...state, runnerPos: pos(14, 15), runnerDirection: 'right', food: [pos(15, 15)] }, { random: zero });
  assert.equal(next.traps.length, 0); assert.ok(next.trapPlacementShortage >= 1);
  assert.ok(next.traps.every((trap, i) => next.traps.findIndex((cell) => cell.x === trap.x && cell.y === trap.y) === i));
});

test('a full board skips tenth-tick food safely and exposes its shortage alongside other warnings', () => {
  const obstacles = Array.from({ length: HOLM_WIDTH * HOLM_HEIGHT }, (_, index) => pos(index % HOLM_WIDTH, Math.floor(index / HOLM_WIDTH)));
  const full = game({ ticks: 9, runnerPos: pos(29, 29), runnerDirection: 'up', home: pos(13, 13), obstacles, traps: [], food: [], population: 4, barbarianEnabled: false });
  const next = tickHolmGame(full, { random: zero, timestamp: 'saturated' });
  assert.equal(next.ticks, 10); assert.equal(next.foodPlacementShortage, 1); assert.deepEqual(next.food, []);
  assert.equal(next.status, 'running'); assert.ok(next.runnerPos.x >= 0 && next.runnerPos.x < HOLM_WIDTH && next.runnerPos.y >= 0 && next.runnerPos.y < HOLM_HEIGHT);
  const notice = placementNoticeText({ ...next, barbarianUnavailable: true, trapPlacementShortage: 2 });
  assert.match(notice, /barbarian/); assert.match(notice, /2 extra trap/); assert.match(notice, /1 food placement/);
});

test('active clock excludes paused time and resumes without catch-up', () => {
  let now = 100; const clock = createActiveClock(() => now);
  clock.start(); now += 500; assert.equal(clock.elapsed(), 500);
  clock.pause(); now += 50_000; assert.equal(clock.elapsed(), 500);
  clock.start(); now += 300; assert.equal(clock.elapsed(), 800);
  clock.reset(); assert.equal(clock.elapsed(), 0); assert.equal(clock.running(), false);
});
