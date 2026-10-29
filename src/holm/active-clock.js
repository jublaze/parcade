export function createActiveClock(now = () => performance.now()) {
  let accumulated = 0;
  let startedAt = null;
  return {
    start() { if (startedAt === null) startedAt = now(); },
    pause() { if (startedAt !== null) { accumulated += Math.max(0, now() - startedAt); startedAt = null; } },
    reset() { accumulated = 0; startedAt = null; },
    elapsed() { return accumulated + (startedAt === null ? 0 : Math.max(0, now() - startedAt)); },
    running() { return startedAt !== null; },
  };
}
