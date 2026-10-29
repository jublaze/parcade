export const BOARD_SIZE = 20;
export const TICK_MS = 120;
export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
});

const opposite = { up: 'down', right: 'left', down: 'up', left: 'right' };
const sameCell = (a, b) => a.x === b.x && a.y === b.y;

export function chooseFood(snake, random = Math.random, boardSize = BOARD_SIZE) {
  const occupied = new Set(snake.map(({ x, y }) => y * boardSize + x));
  const available = boardSize * boardSize - occupied.size;
  if (available <= 0) return null;
  let index = Math.floor(random() * available);
  for (let y = 0; y < boardSize; y += 1) {
    for (let x = 0; x < boardSize; x += 1) {
      if (occupied.has(y * boardSize + x)) continue;
      if (index === 0) return { x, y };
      index -= 1;
    }
  }
  return null;
}

export function createGameState({ random = Math.random, best = 0, config = { boardSize: BOARD_SIZE, tickMs: TICK_MS, preset: 'source' } } = {}) {
  const { boardSize = BOARD_SIZE, tickMs = TICK_MS, preset = 'source' } = config;
  const headX = boardSize === BOARD_SIZE ? 11 : Math.floor(boardSize / 2) + 1;
  const headY = boardSize === BOARD_SIZE ? 9 : Math.floor((boardSize - 1) / 2);
  const snake = [{ x: headX, y: headY }, { x: headX - 1, y: headY }, { x: headX - 2, y: headY }];
  return {
    status: 'ready',
    snake,
    direction: 'right',
    turns: [],
    food: chooseFood(snake, random, boardSize),
    score: 0,
    best,
    boardSize,
    tickMs,
    configPreset: preset,
    config: Object.freeze({ boardSize, tickMs, preset }),
  };
}

export function queueDirection(state, next) {
  if (state.status !== 'running' || !DIRECTIONS[next] || state.turns.length >= 2) return state;
  const last = state.turns.at(-1) ?? state.direction;
  if (next === last || opposite[last] === next) return state;
  return { ...state, turns: [...state.turns, next] };
}

export function startGame(state) {
  if (state.status !== 'ready' && state.status !== 'paused') return state;
  return { ...state, status: 'running', turns: [] };
}

export function pauseGame(state) {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', turns: [] };
}

export function restartGame(state, options = {}) {
  return createGameState({ ...options, best: state.best, config: state.config ?? options.config });
}

export function tick(state, random = Math.random) {
  if (state.status !== 'running') return state;
  const direction = state.turns[0] ?? state.direction;
  const vector = DIRECTIONS[direction];
  const head = state.snake[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  const growing = sameCell(nextHead, state.food);
  const bodyToCheck = growing ? state.snake : state.snake.slice(0, -1);

  if (
    nextHead.x < 0 || nextHead.x >= (state.boardSize ?? BOARD_SIZE) ||
    nextHead.y < 0 || nextHead.y >= (state.boardSize ?? BOARD_SIZE) ||
    bodyToCheck.some((cell) => sameCell(cell, nextHead))
  ) {
    return { ...state, status: 'lost', turns: [], direction };
  }

  const snake = [nextHead, ...state.snake];
  if (!growing) snake.pop();
  const score = state.score + (growing ? 10 : 0);
  const best = Math.max(state.best, score);
  const boardSize = state.boardSize ?? BOARD_SIZE;
  const won = snake.length === boardSize * boardSize;
  return {
    ...state,
    status: won ? 'won' : 'running',
    snake,
    direction,
    turns: state.turns.slice(state.turns.length > 0 ? 1 : 0),
    food: growing && !won ? chooseFood(snake, random, boardSize) : state.food,
    score,
    best,
  };
}
