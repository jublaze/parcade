import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZE, chooseFood, createGameState, pauseGame, queueDirection, restartGame, startGame, tick } from '../src/game.js';

const run = (extra = {}) => startGame(createGameState({ random: () => 0, ...extra }));
const withSnake = (snake, food, direction = 'right', turns = []) => ({ status: 'running', snake, food, direction, turns, score: 0, best: 0 });

test('starts centered with length three, heading right, and a free food cell', () => {
  const state = createGameState({ random: () => 0.5 });
  assert.equal(state.status, 'ready');
  assert.equal(state.snake.length, 3);
  assert.deepEqual(state.snake[0], { x: 11, y: 9 });
  assert.equal(state.direction, 'right');
  assert.equal(state.food.x >= 0 && state.food.x < 20 && state.food.y >= 0 && state.food.y < 20, true);
  assert.equal(state.snake.some((cell) => cell.x === state.food.x && cell.y === state.food.y), false);
});

test('food selection maps every random slot to a distinct empty cell and returns null on a full board', () => {
  const occupied = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!((x === 0 && y === 0) || (x === 19 && y === 19))) occupied.push({ x, y });
    }
  }
  assert.deepEqual(chooseFood(occupied, () => 0), { x: 0, y: 0 });
  assert.deepEqual(chooseFood(occupied, () => 0.999999), { x: 19, y: 19 });
  assert.equal(chooseFood([...occupied, { x: 0, y: 0 }, { x: 19, y: 19 }]), null);
});

test('queues two validated turns and consumes only one per tick', () => {
  let state = queueDirection(run(), 'up');
  state = queueDirection(state, 'left');
  assert.deepEqual(state.turns, ['up', 'left']);
  assert.equal(queueDirection(state, 'down'), state);
  assert.equal(queueDirection(state, 'left'), state);
  state = tick(state, () => 0);
  assert.equal(state.direction, 'up');
  assert.deepEqual(state.turns, ['left']);
});

test('rejects immediate and queued reversals, duplicate turns, and input while stopped', () => {
  const state = run();
  assert.equal(queueDirection(state, 'left'), state);
  const queued = queueDirection(state, 'up');
  assert.equal(queueDirection(queued, 'down'), queued);
  assert.equal(queueDirection(queued, 'up'), queued);
  assert.equal(queueDirection(pauseGame(queued), 'down').turns.length, 0);
});

test('food grows the snake by one, scores ten, and preserves the best', () => {
  const next = tick(withSnake([{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }], { x: 2, y: 0 }), () => 0.5);
  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 10);
  assert.equal(next.best, 10);
  assert.notDeepEqual(next.food, { x: 2, y: 0 });
});

test('allows entry into the vacating tail cell without growth', () => {
  const state = withSnake([{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }], { x: 8, y: 8 }, 'left');
  const next = tick(state);
  assert.equal(next.status, 'running');
  assert.deepEqual(next.snake[0], { x: 2, y: 1 });
  assert.deepEqual(next.snake.at(-1), { x: 2, y: 2 });
});

test('loses on growth into the tail, other self collision, and wall collision', () => {
  const tail = withSnake([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 0, y: 2 }, { x: 0, y: 1 }], { x: 0, y: 1 }, 'left');
  assert.equal(tick(tail).status, 'lost');
  const self = withSnake([{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 }, { x: 4, y: 2 }], { x: 10, y: 10 });
  assert.equal(tick(self).status, 'lost');
  const wall = withSnake([{ x: 19, y: 3 }, { x: 18, y: 3 }, { x: 17, y: 3 }], { x: 0, y: 0 });
  assert.equal(tick(wall).status, 'lost');
});

test('wins when the last open cell is eaten', () => {
  const path = [];
  for (let y = 0; y < BOARD_SIZE - 1; y += 1) {
    const row = Array.from({ length: BOARD_SIZE }, (_, x) => ({ x, y }));
    path.push(...(y % 2 === 0 ? row : row.reverse()));
  }
  path.push(...Array.from({ length: BOARD_SIZE - 1 }, (_, x) => ({ x, y: 19 })));
  const snake = path.reverse();
  const food = { x: 19, y: 19 };
  const next = tick(withSnake(snake, food));
  assert.equal(next.status, 'won');
  assert.equal(next.snake.length, 400);
  assert.equal(next.score, 10);
  assert.equal(next.food, food);
});

test('pause clears input, resume is explicit, and restart preserves best with a clean run', () => {
  const paused = pauseGame(queueDirection(run({ best: 50 }), 'up'));
  assert.equal(paused.status, 'paused');
  assert.deepEqual(paused.turns, []);
  const resumed = startGame(paused);
  assert.equal(resumed.status, 'running');
  const restarted = restartGame({ ...resumed, best: 80 }, { random: () => 0.5 });
  assert.equal(restarted.status, 'ready');
  assert.equal(restarted.score, 0);
  assert.equal(restarted.best, 80);
  assert.deepEqual(restarted.turns, []);
  assert.equal(tick(paused), paused);
});
