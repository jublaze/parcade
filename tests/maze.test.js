import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAZE_HEIGHT, MAZE_LENGTH, MAZE_TRAPS_PER_LEVEL, MAZE_WIDTH,
  PERSIST_TRAPS, REFRESH_TRAPS, createMazeState, mazeTickMs, pauseMaze,
  placeMazeTraps, restartMaze, resumeMaze, setMazeDirection, startMaze, tickMaze,
} from '../src/maze/game.js';

const randomRowFour = () => 4 / MAZE_HEIGHT;
const running = (overrides = {}) => startMaze({ ...createMazeState({ random: randomRowFour }), ...overrides, status: 'ready' });
const nearRightEdge = (trapMode = REFRESH_TRAPS, traps = []) => running({
  level: 1,
  trapMode,
  snake: Array.from({ length: MAZE_LENGTH }, (_, i) => ({ x: 48 - i, y: 4 })),
  direction: 'right',
  pendingDirection: 'right',
  traps,
});

test('starts level one with ten distinct logical cells at x=0 through -9 and three safe traps', () => {
  const state = createMazeState({ random: randomRowFour });
  assert.equal(state.status, 'ready');
  assert.equal(state.level, 1);
  assert.deepEqual(state.snake.map(({ x }) => x), [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]);
  assert.equal(new Set(state.snake.map(({ x, y }) => `${x},${y}`)).size, MAZE_LENGTH);
  assert.ok(state.snake.every(({ y }) => y === 4));
  assert.equal(state.traps.length, MAZE_TRAPS_PER_LEVEL);
  assert.ok(state.traps.every(({ x, y }) => x >= 5 && x < MAZE_WIDTH && y >= 0 && y < MAZE_HEIGHT));
});

test('advances the off-board tail into visible columns without shifting the head', () => {
  let state = startMaze(createMazeState({ random: randomRowFour }));
  for (let i = 0; i < 9; i += 1) state = tickMaze(state, randomRowFour);
  assert.equal(state.snake.length, 10);
  assert.equal(state.snake[0].x, 9);
  assert.equal(state.snake.at(-1).x, 0);
  assert.equal(state.snake.filter(({ x }) => x < 0).length, 0);
});

test('latest pending direction replaces earlier input and reversals check the current heading', () => {
  let state = running();
  state = setMazeDirection(state, 'up');
  assert.equal(state.pendingDirection, 'up');
  state = setMazeDirection(state, 'down');
  assert.equal(state.pendingDirection, 'down');
  assert.equal(setMazeDirection(state, 'left'), state);
  state = tickMaze(state);
  assert.equal(state.direction, 'down');
  state = setMazeDirection(state, 'up');
  assert.equal(state.pendingDirection, 'down');
});

test('level transition resets the snake to x=0 and speed bottoms out at 40 ms', () => {
  const state = tickMaze(nearRightEdge(), randomRowFour);
  assert.equal(state.level, 2);
  assert.equal(state.snake.length, 10);
  assert.deepEqual(state.snake[0], { x: 0, y: 4 });
  assert.deepEqual(state.snake.at(-1), { x: -9, y: 4 });
  assert.equal(state.direction, 'right');
  assert.equal(state.pendingDirection, 'right');
  assert.equal(mazeTickMs(1), 80);
  assert.equal(mazeTickMs(41), 40);
  assert.equal(mazeTickMs(100), 40);
});

test('refresh mode replaces traps while persistent mode retains them and adds three', () => {
  const old = [{ x: 15, y: 14 }, { x: 16, y: 14 }];
  const refresh = tickMaze(nearRightEdge(REFRESH_TRAPS, old), randomRowFour);
  const persist = tickMaze(nearRightEdge(PERSIST_TRAPS, old), randomRowFour);
  assert.equal(refresh.traps.length, 3);
  assert.ok(old.every((cell) => !refresh.traps.some((trap) => trap.x === cell.x && trap.y === cell.y)));
  assert.equal(persist.traps.length, 5);
  assert.ok(old.every((cell) => persist.traps.some((trap) => trap.x === cell.x && trap.y === cell.y)));
});

test('walls, traps, body, and the current tail cell are lethal before tail movement', () => {
  const wall = running({ snake: [{ x: 49, y: 4 }, ...Array.from({ length: 9 }, (_, i) => ({ x: 48 - i, y: 4 }))] });
  assert.equal(tickMaze(wall).deathReason, 'wall');
  const trap = running({ snake: [{ x: 10, y: 4 }, ...Array.from({ length: 9 }, (_, i) => ({ x: 9 - i, y: 4 }))], traps: [{ x: 11, y: 4 }] });
  assert.equal(tickMaze(trap).deathReason, 'trap');
  const body = running({ snake: [{ x: 10, y: 4 }, { x: 11, y: 4 }, ...Array.from({ length: 8 }, (_, i) => ({ x: 11 - i, y: 5 }))] });
  assert.equal(tickMaze(body).deathReason, 'snake');
  const tail = running({ snake: [{ x: 10, y: 4 }, ...Array.from({ length: 8 }, (_, i) => ({ x: 10 - i, y: 5 })), { x: 11, y: 4 }] });
  assert.equal(tickMaze(tail).deathReason, 'snake');
});

test('trap placement is unique, avoids safe columns and occupied cells, and caps when saturated', () => {
  const placed = placeMazeTraps([{ x: 5, y: 0 }], [], 3, () => 0);
  assert.equal(placed.added.length, 3);
  assert.equal(new Set(placed.traps.map(({ x, y }) => `${x},${y}`)).size, 3);
  assert.ok(placed.traps.every(({ x, y }) => x >= 5 && !(x === 5 && y === 0)));
  const saturated = Array.from({ length: (MAZE_WIDTH - 5) * MAZE_HEIGHT }, (_, i) => ({ x: Math.floor(i / MAZE_HEIGHT) + 5, y: i % MAZE_HEIGHT }));
  const capped = placeMazeTraps([], saturated, 3);
  assert.equal(capped.added.length, 0);
  assert.equal(capped.shortage, 3);
  assert.equal(capped.traps.length, saturated.length);
});

test('pause clears pending direction, resume is explicit, and restart preserves selected mode', () => {
  let state = setMazeDirection(running({ trapMode: PERSIST_TRAPS }), 'up');
  state = pauseMaze(state);
  assert.equal(state.status, 'paused');
  assert.equal(state.pendingDirection, state.direction);
  assert.equal(tickMaze(state), state);
  state = resumeMaze(state);
  assert.equal(state.status, 'running');
  assert.equal(state.pendingDirection, 'right');
  const fresh = restartMaze({ ...state, level: 8 }, { random: randomRowFour });
  assert.equal(fresh.status, 'ready');
  assert.equal(fresh.level, 1);
  assert.equal(fresh.trapMode, PERSIST_TRAPS);
  assert.equal(fresh.snake.length, MAZE_LENGTH);
  assert.equal(fresh.traps.length, 3);
});
