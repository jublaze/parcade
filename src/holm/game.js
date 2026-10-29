export const HOLM_WIDTH = 30;
export const HOLM_HEIGHT = 30;
export const HOLM_TICK_MS = 120;
export const HOLM_TIME_LIMIT_MS = 120_000;
export const HOLM_START_POPULATION = 5;
export const HOLM_START_TRAPS = 5;
export const HOLM_OBSTACLE_COUNT = 55;
export const HOLM_FOOD_EVERY_TICKS = 10;
export const HOLM_DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

const directionNames = Object.keys(HOLM_DIRECTIONS);
const cellKey = ({ x, y }) => `${x},${y}`;
const inBounds = ({ x, y }) => x >= 0 && x < HOLM_WIDTH && y >= 0 && y < HOLM_HEIGHT;

function randomIndex(length, random) {
  if (length <= 1) return 0;
  const value = Number(random());
  return Math.min(length - 1, Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) * length)));
}

function sample(cells, count, random) {
  const available = [...cells];
  const selected = [];
  const limit = Math.min(Math.max(0, count), available.length);
  for (let index = 0; index < limit; index += 1) {
    const swapWith = index + randomIndex(available.length - index, random);
    [available[index], available[swapWith]] = [available[swapWith], available[index]];
    selected.push(available[index]);
  }
  return { selected, shortage: count - selected.length };
}

function boardCells(predicate = () => true) {
  const cells = [];
  for (let y = 0; y < HOLM_HEIGHT; y += 1) {
    for (let x = 0; x < HOLM_WIDTH; x += 1) {
      const cell = { x, y };
      if (predicate(cell)) cells.push(cell);
    }
  }
  return cells;
}

function occupiedKeys(state, { includeBarbarian = true, includeRunner = true } = {}) {
  const cells = [state.home, ...state.obstacles, ...state.traps, ...state.food];
  if (includeRunner && state.runnerPos) cells.push(state.runnerPos);
  if (includeBarbarian && state.barbarianPos) cells.push(state.barbarianPos);
  return new Set(cells.filter(Boolean).map(cellKey));
}

function freeCells(state, { safeTrapColumns = false, includeBarbarian = true, includeRunner = true } = {}) {
  const occupied = occupiedKeys(state, { includeBarbarian, includeRunner });
  return boardCells((cell) => (!safeTrapColumns || cell.x >= 2) && !occupied.has(cellKey(cell)));
}

function addTraps(state, count, random) {
  const result = sample(freeCells(state, { safeTrapColumns: true }), count, random);
  return {
    ...state,
    traps: [...state.traps, ...result.selected],
    trapPlacementShortage: state.trapPlacementShortage + result.shortage,
  };
}

function spawnBarbarian(state, random) {
  const cells = freeCells(state, { includeBarbarian: false });
  const { selected } = sample(cells, 1, random);
  if (!selected.length) return { ...state, barbarianEnabled: false, barbarianPos: null, barbarianUnavailable: true };
  return { ...state, barbarianEnabled: true, barbarianPos: selected[0], barbarianUnavailable: false };
}

function spawnRunner(state, random, timestamp) {
  if (state.population <= 0) return endGame({ ...state, runnerPos: null }, 'population', timestamp);
  return {
    ...state,
    population: state.population - 1,
    runnerPos: { ...state.home },
    runnerDirection: directionNames[randomIndex(directionNames.length, random)],
  };
}

function endGame(state, reason, timestamp) {
  if (state.status === 'over') return state;
  return {
    ...state,
    status: 'over',
    endReason: reason,
    runnerPos: null,
    record: { name: state.playerName, finalPopulation: state.population, timestamp },
  };
}

export function validatePlayerName(value) {
  const name = String(value ?? '').trim();
  const length = Array.from(name).length;
  if (!name) return { valid: false, name, error: 'Enter a name to begin.' };
  if (length > 20) return { valid: false, name, error: 'Use 20 characters or fewer.' };
  return { valid: true, name, error: '' };
}

export function createNameState({ barbarianEnabled = true, config = null } = {}) {
  const settings = Object.freeze({ tickMs: config?.tickMs ?? HOLM_TICK_MS, timeLimitSeconds: config?.timeLimitSeconds ?? 120, startingPopulation: config?.startingPopulation ?? HOLM_START_POPULATION, obstacles: config?.obstacles ?? HOLM_OBSTACLE_COUNT, traps: config?.traps ?? HOLM_START_TRAPS, foodEveryTicks: config?.foodEveryTicks ?? HOLM_FOOD_EVERY_TICKS, barbarianEnabled: config?.barbarianEnabled ?? barbarianEnabled, preset: config?.preset ?? 'source' });
  return {
    status: 'name',
    playerName: '',
    barbarianEnabled: config?.barbarianEnabled ?? barbarianEnabled,
    config: settings,
    barbarianUnavailable: false,
    population: settings.startingPopulation,
    ticks: 0,
    home: null,
    obstacles: [],
    traps: [],
    food: [],
    runnerPos: null,
    runnerDirection: 'up',
    barbarianPos: null,
    trapPlacementShortage: 0,
    foodPlacementShortage: 0,
    endReason: null,
    record: null,
  };
}

export function startHolmGame(nameValue, { barbarianEnabled = true, random = Math.random, config = null } = {}) {
  const result = validatePlayerName(nameValue);
  if (!result.valid) throw new RangeError(result.error);
  const home = {
    x: 13 + randomIndex(5, random),
    y: 13 + randomIndex(5, random),
  };
  const safeAroundHome = (cell) => Math.abs(cell.x - home.x) > 1 || Math.abs(cell.y - home.y) > 1;
  const settings = createNameState({ barbarianEnabled, config }).config;
  const obstacles = sample(boardCells(safeAroundHome), settings.obstacles, random).selected;
  let state = {
    ...createNameState({ config: settings }),
    status: 'running',
    barbarianEnabled,
    playerName: result.name,
    home,
    obstacles,
    traps: [],
    food: [],
    ticks: 0,
    population: settings.startingPopulation,
  };
  state = addTraps(state, settings.traps, random);
  state = { ...state, barbarianPos: null, barbarianUnavailable: false };
  if (state.barbarianEnabled) state = spawnBarbarian(state, random);
  return spawnRunner(state, random, '');
}

export function setRunnerDirection(state, direction) {
  if (state.status !== 'running' || !HOLM_DIRECTIONS[direction]) return state;
  return { ...state, runnerDirection: direction };
}

export function setBarbarianEnabled(state, enabled, random = Math.random) {
  if (state.status !== 'name' && state.status !== 'running' && state.status !== 'paused') return state;
  if (!enabled) return { ...state, barbarianEnabled: false, barbarianUnavailable: false, barbarianPos: null };
  if (state.status === 'name') return { ...state, barbarianEnabled: true, barbarianUnavailable: false };
  if (state.barbarianPos) return { ...state, barbarianEnabled: true, barbarianUnavailable: false };
  return spawnBarbarian({ ...state, barbarianEnabled: true, barbarianUnavailable: false }, random);
}

export function pauseHolmGame(state) {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

export function resumeHolmGame(state) {
  return state.status === 'paused' ? { ...state, status: 'running' } : state;
}

export function restartHolmGame(state, config = state.config) {
  const settings = config?.preset === 'source' ? { ...config, barbarianEnabled: true } : config;
  return createNameState({ barbarianEnabled: settings?.barbarianEnabled ?? true, config: settings });
}

function moveBarbarian(state, random) {
  if (!state.barbarianEnabled || !state.barbarianPos) return state;
  const directionOrder = ['up', 'down', 'left', 'right'];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const direction = HOLM_DIRECTIONS[directionOrder[randomIndex(directionOrder.length, random)]];
    const next = { x: state.barbarianPos.x + direction.x, y: state.barbarianPos.y + direction.y };
    if (!inBounds(next) || state.obstacles.some((cell) => cellKey(cell) === cellKey(next))) continue;
    return { ...state, barbarianPos: next };
  }
  return state;
}

function spawnFood(state, random) {
  const { selected, shortage } = sample(freeCells(state), 1, random);
  return {
    ...state,
    food: [...state.food, ...selected],
    foodPlacementShortage: state.foodPlacementShortage + shortage,
  };
}

function respawnAfterCollision(state, random, timestamp, reason, removeTrap = false, nextCell = null) {
  const traps = removeTrap ? state.traps.filter((trap) => cellKey(trap) !== cellKey(nextCell)) : state.traps;
  const prepared = { ...state, traps, runnerPos: null };
  if (prepared.population <= 0) return endGame(prepared, 'population', timestamp);
  return { ...prepared, population: prepared.population - 1, lastCollision: reason, runnerPos: { ...prepared.home }, runnerDirection: directionNames[randomIndex(directionNames.length, random)] };
}

function moveRunner(state, random, timestamp) {
  if (!state.runnerPos) return state.population <= 0 ? endGame(state, 'population', timestamp) : spawnRunner(state, random, timestamp);
  const direction = HOLM_DIRECTIONS[state.runnerDirection];
  const next = { x: state.runnerPos.x + direction.x, y: state.runnerPos.y + direction.y };
  if (!inBounds(next)) return respawnAfterCollision(state, random, timestamp, 'wall');
  if (state.barbarianEnabled && state.barbarianPos && cellKey(next) === cellKey(state.barbarianPos)) return respawnAfterCollision(state, random, timestamp, 'barbarian');
  if (state.obstacles.some((cell) => cellKey(cell) === cellKey(next))) return respawnAfterCollision(state, random, timestamp, 'obstacle');
  if (state.traps.some((cell) => cellKey(cell) === cellKey(next))) return respawnAfterCollision(state, random, timestamp, 'trap', true, next);
  if (state.food.some((cell) => cellKey(cell) === cellKey(next))) {
    const eaten = { ...state, food: state.food.filter((cell) => cellKey(cell) !== cellKey(next)), population: state.population + 1 };
    return addTraps(eaten, 1, random);
  }
  const moved = { ...state, runnerPos: next };
  if (moved.barbarianEnabled && moved.barbarianPos && cellKey(moved.runnerPos) === cellKey(moved.barbarianPos)) {
    return respawnAfterCollision(moved, random, timestamp, 'barbarian');
  }
  return moved;
}

export function tickHolmGame(state, { elapsedMs = 0, random = Math.random, timestamp = new Date().toISOString() } = {}) {
  if (state.status !== 'running') return state;
  if (elapsedMs >= (state.config?.timeLimitSeconds ?? 120) * 1000) return endGame(state, 'time', timestamp);
  let next = { ...state, ticks: state.ticks + 1 };
  if (next.ticks % (state.config?.foodEveryTicks ?? HOLM_FOOD_EVERY_TICKS) === 0) next = spawnFood(next, random);
  next = moveBarbarian(next, random);
  return moveRunner(next, random, timestamp);
}
