# Snakeholm Rules and Browser Plan

## Source reference

Reference behavior was read from `the original Snakeholm reference` (SHA-256 `E4A8FFDFFA0D38E8905721A89B6D1B119F62A67F146E600405CED654245DE03A`). The reference file remains unchanged. Do not read, import, modify, or migrate its private score data file. Browser history is a new local-only record store.

## World and starting state

- The bounded board is 30 by 30 cells and advances every 120 ms.
- A run requires a trimmed, non-empty player name of at most 20 characters.
- Pick the home cell uniformly from x=13–17 and y=13–17. Place 55 obstacles outside the 3-by-3 buffer around home and outside home itself.
- Start with five traps. Traps cannot occupy columns 0 or 1 and cannot overlap home, obstacles, food, the runner, or a barbarian when one exists.
- The barbarian is enabled by default and starts in an available cell that excludes home, obstacles, traps, food, and the runner.
- Starting population is five. Spawning the first runner at home consumes one, leaving population four. Each runner spawn consumes one population. Food adds one population and one trap.
- The runner starts at home with a random cardinal direction. Arrow keys set its direction directly. Reversals are allowed; there is no turn queue.

## Tick order and movement

Each active tick follows this order:

1. If 120,000 ms of active play have elapsed, end the run for time before doing any more tick work.
2. Increment the tick count. On each tenth tick, spawn one food item in a free cell.
3. If enabled, move the barbarian. It makes up to eight random cardinal attempts and accepts the first in-bounds cell that is not an obstacle. The reference does not exclude home, traps, food, or the runner during this move, so the barbarian can overlap them.
4. If there is no runner, try to spawn one at home, consuming one population; if population is zero, end the run.
5. Move the runner one cell. A wall, barbarian, or obstacle costs one population and attempts to respawn at home. Entering a trap removes the trap, costs one population, and attempts to respawn. A successful normal move onto the barbarian also costs one population and attempts to respawn.
6. Entering food removes it, adds one population, and adds one trap. The runner stays on its previous cell for that tick; it does not move onto the food or respawn. This follows the executed source branch, whose old respawn call is commented out.

The source moves the barbarian before the runner. If the barbarian moves onto the runner's current cell, an ordinary runner move can escape; if the runner then moves onto the barbarian, it dies. Keep this order and branch behavior. Do not make a same-cell overlap fatal before the runner gets its move.

An active runner may remain alive at population zero. The run ends only when time expires or a runner must spawn while population is zero. End and record the run once.

## Spawning and settings

- Food appears once every ten ticks and cannot initially overlap home, obstacles, traps, existing food, the runner, or the barbarian.
- Every population increase spawns the same number of traps. A runner entering a trap removes that trap before it loses population and attempts respawn.
- B toggles the barbarian. Turning it off removes it. Turning it on attempts one spawn in an available cell that excludes home, obstacles, traps, food, and runner.
- The reference uses retry loops for random obstacle, trap, food, and barbarian placement. In the browser, enumerate eligible cells and choose without replacement. Cap placement at available cells: skip surplus traps or food when no cell is free; if no barbarian cell is free, leave it absent and show its off/unavailable state. Never hang on saturated layouts.

## Browser behavior and local records

- Add Snakeholm as a separate arcade game. Keep existing Snake and Snake Maze behavior independent. Provide name entry, play, paused, and game-over views.
- Support arrows and WASD, touch steering, pause/resume, restart, home, and a visible barbarian setting. Reversals remain allowed.
- The source has no pause. In the browser, blur/hidden-tab and explicit pause suspend both movement and the 120-second active-play clock. Resume requires an explicit action, continues from the same positions, and performs no movement catch-up. Use a monotonic active-time clock so background or rendering delays do not add extra movement ticks, while active elapsed time still counts toward the limit.
- A restart returns to name entry with a fresh world. Returning home stops timers and input. An interrupted run is not added to history because it did not end by time or exhausted population.
- At time or population end, append exactly one local record containing the trimmed name, final population, and timestamp. Keep records in browser-local storage, show local history, and offer JSON download of those records. Do not import or read the reference score data, transmit records, or write a CSV. If storage is unavailable, keep the current run usable and explain that history could not be saved.
- Keep the board, touch controls, and status accessible at small widths. Show the complete 30-by-30 board in a responsive view without document-wide horizontal overflow.
- Keep Snakeholm's model and tests separate from the other games. Test initial population and world constraints, name validation, tick ordering, barbarian overlap and escape, food's stationary runner branch, trap destruction and population cost, last-runner-at-zero behavior, both end conditions and one-time logging, placement saturation, pause-time accounting, restart, local storage fallback, and arcade cleanup.

## Settings

Applied settings provide Easy, Source defaults, Hard, and Custom presets for tick interval, active-time limit, starting population, obstacle count, initial traps, food cadence, and the starting barbarian preference. Source defaults preserve the values above. Custom values are bounded as specified in `GAME_SETTINGS.md`; board size, home buffer, movement, collision, and tick order remain unchanged. The existing in-run B key and checkbox toggle only the current run and do not rewrite the saved starting preference. Settings opened during play pause the run. Cancel leaves it paused; Apply abandons it without a history record and returns to name entry with the new settings.
