export const MAZE_WIDTH = 50;
export const MAZE_HEIGHT = 15;
export const MAZE_LENGTH = 10;
export const MAZE_TRAPS_PER_LEVEL = 3;
export const SAFE_TRAP_COLUMNS = 5;
export const REFRESH_TRAPS = 'refresh';
export const PERSIST_TRAPS = 'persist';
export const TRAP_MODES = Object.freeze([REFRESH_TRAPS, PERSIST_TRAPS]);

export const MAZE_DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
});

const opposite = Object.freeze({ up: 'down', right: 'left', down: 'up', left: 'right' });
const cellKey = ({ x, y }) => `${x},${y}`;

export function mazeTickMs(level, config = null) {
  const start = config?.startMs ?? 80;
  const floor = config?.floorMs ?? 40;
  const step = config?.levelStepMs ?? 1;
  return Math.max(floor, start - (level - 1) * step);
}

function startingSnake(random) {
  const y = Math.min(MAZE_HEIGHT - 1, Math.max(0, Math.floor(random() * MAZE_HEIGHT)));
  return Array.from({ length: MAZE_LENGTH }, (_, i) => ({ x: i === 0 ? 0 : -i, y }));
}

export function placeMazeTraps(snake, existingTraps = [], requested = MAZE_TRAPS_PER_LEVEL, random = Math.random) {
  const occupied = new Set([...snake, ...existingTraps].filter(({ x, y }) => x >= 0 && x < MAZE_WIDTH && y >= 0 && y < MAZE_HEIGHT).map(cellKey));
  const available = [];
  for (let x = SAFE_TRAP_COLUMNS; x < MAZE_WIDTH; x += 1) {
    for (let y = 0; y < MAZE_HEIGHT; y += 1) {
      const cell = { x, y };
      if (!occupied.has(cellKey(cell))) available.push(cell);
    }
  }

  const count = Math.min(Math.max(0, requested), available.length);
  const added = [];
  for (let i = 0; i < count; i += 1) {
    const remaining = available.length - i;
    const offset = Math.min(remaining - 1, Math.max(0, Math.floor(random() * remaining)));
    const selected = i + offset;
    [available[i], available[selected]] = [available[selected], available[i]];
    added.push(available[i]);
  }
  return {
    traps: [...existingTraps, ...added],
    added,
    shortage: requested - added.length,
  };
}

function createLevelState({ level, trapMode, existingTraps, random, config }) {
  const snake = startingSnake(random);
  const baseTraps = trapMode === REFRESH_TRAPS ? [] : existingTraps;
  const placement = placeMazeTraps(snake, baseTraps, config?.trapsPerLevel ?? MAZE_TRAPS_PER_LEVEL, random);
  return {
    level,
    trapMode,
    snake,
    direction: 'right',
    pendingDirection: 'right',
    traps: placement.traps,
    placementShortage: placement.shortage,
    config,
  };
}

export function createMazeState({ trapMode = REFRESH_TRAPS, random = Math.random, config = null } = {}) {
  const mode = TRAP_MODES.includes(trapMode) ? trapMode : REFRESH_TRAPS;
  const settings = Object.freeze({ startMs: config?.startMs ?? 80, floorMs: config?.floorMs ?? 40, levelStepMs: config?.levelStepMs ?? 1, trapsPerLevel: config?.trapsPerLevel ?? MAZE_TRAPS_PER_LEVEL, trapMode: mode, preset: config?.preset ?? 'source' });
  return {
    status: 'ready',
    ...createLevelState({ level: 1, trapMode: mode, existingTraps: [], random, config: settings }),
    deathReason: null,
  };
}

export function startMaze(state) {
  return state.status === 'ready' ? { ...state, status: 'running' } : state;
}

export function setMazeDirection(state, direction) {
  if (state.status !== 'running' || !MAZE_DIRECTIONS[direction] || opposite[state.direction] === direction) return state;
  if (state.pendingDirection === direction) return state;
  return { ...state, pendingDirection: direction };
}

export function pauseMaze(state) {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', pendingDirection: state.direction };
}

export function resumeMaze(state) {
  return state.status === 'paused' ? { ...state, status: 'running', pendingDirection: state.direction } : state;
}

export function restartMaze(state, options = {}) {
  return createMazeState({ ...options, trapMode: state.trapMode, config: state.config });
}

export function tickMaze(state, random = Math.random) {
  if (state.status !== 'running') return state;
  const direction = state.pendingDirection;
  const vector = MAZE_DIRECTIONS[direction];
  const head = state.snake[0];
  const next = { x: head.x + vector.x, y: head.y + vector.y };

  let deathReason = null;
  if (next.x < 0 || next.x >= MAZE_WIDTH || next.y < 0 || next.y >= MAZE_HEIGHT) deathReason = 'wall';
  else if (state.traps.some((cell) => cellKey(cell) === cellKey(next))) deathReason = 'trap';
  else if (state.snake.some((cell) => cellKey(cell) === cellKey(next))) deathReason = 'snake';
  if (deathReason) return { ...state, status: 'dead', direction, pendingDirection: direction, deathReason };

  const snake = [next, ...state.snake.slice(0, MAZE_LENGTH - 1)];
  if (next.x !== MAZE_WIDTH - 1) return { ...state, snake, direction, pendingDirection: direction };

  return {
    ...state,
    ...createLevelState({ level: state.level + 1, trapMode: state.trapMode, existingTraps: state.traps, random, config: state.config }),
    status: 'running',
    deathReason: null,
  };
}
