# Parcade

Parcade is a small arcade with five playable games: classic Snake, Snake Maze, Snakeholm, Math Ladder, and Illuminate Quiz.

## Install and run

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local Vite URL and choose a game. Run checks and create the production build with:

```sh
npm test
npm run test:browser
npm run build
npm run preview
```

Playwright browser tests use Chromium. Install it once with `npx playwright install chromium` if needed.

## Snakeholm

Snakeholm's **Source defaults** use a 30-by-30 board, 120 ms ticks, a two-minute active-play limit, five starting population, 55 obstacles, five traps, food every ten ticks, and the barbarian enabled. Easy, Hard, and Custom settings adjust only those bounded values; world and collision rules stay fixed. Enter a trimmed name up to 20 characters. The first runner costs one population. Food adds one population and one trap, and leaves the runner in its previous cell. Walls, obstacles, traps, and barbarian collisions cost one population; an active runner can continue at zero population until it needs to respawn. Barbarian and food spawn locations are selected from available cells without retry loops. The runtime B key/checkbox still toggles the barbarian; this does not change the saved starting preference. At time or population end, Snakeholm saves the name, final population, and timestamp to local browser storage. The history table and JSON export stay on this device; interrupted runs do not create records.

Arrows or WASD steer, including reversals. Space pauses or resumes, R restarts to name entry, B toggles the barbarian, and Escape returns to the arcade. Focused controls and text fields retain their native keyboard behavior. Mobile players can use the directional buttons and the visible pause, restart, and arcade controls. Browser blur and hidden-tab events pause the active timer; resuming never advances the board for missed ticks.

See [docs/SNAKEHOLM_RULES.md](docs/SNAKEHOLM_RULES.md) for source behavior, adaptations, and edge cases.

## Snake Maze

Snake Maze's **Source defaults** use an 80 ms first-level tick, a 40 ms floor, a 1 ms speed-up per level, three traps per level, and Refresh. Easy, Hard, and Custom adjust those values while keeping the 50-by-15 board and ten-cell snake. The selected trap policy is saved when a run starts. Steer with arrows or WASD; use the on-screen controls on touch devices. Space pauses or resumes, R restarts the selected mode, Escape returns to the arcade, and **Trap mode** selects the next run's layout. **Game settings** edits the speed and trap-count configuration. The board fits the screen by default; on narrow screens, zoom it and pan inside the board viewport without widening the page.

The snake starts with its head at column 0 and its nine trailing cells at logical columns -1 through -9; those tail cells are clipped until they enter the board. Reaching column 49 advances the level and resets the snake. Traps avoid columns 0-4. Colliding with a wall, trap, or any part of the snake ends the run.

See [docs/SNAKE_MAZE_RULES.md](docs/SNAKE_MAZE_RULES.md) for detailed rules.

## Classic Snake

Classic Snake's **Source defaults** use a 20-by-20 board and 120 ms ticks. Easy, Hard, and Custom choose a square board from 12 to 40 cells and a fixed 40-1,000 ms tick. The best score remains one shared local value across configurations. Opening settings pauses a run; Cancel keeps it paused, while Apply starts a fresh ready game with the new configuration. See [docs/SNAKE_RULES.md](docs/SNAKE_RULES.md) for the rules, controls, and states.

Each game offers Easy, Source defaults, Hard, and Custom settings. Applied settings are stored per game on this device. If browser storage is unavailable, the source defaults and current session settings remain playable in memory. Opening settings pauses a running game; Cancel leaves the same run paused, and Apply prepares a fresh game that still requires an explicit start. Settings forms validate bounded integer values before applying. See [docs/GAME_SETTINGS.md](docs/GAME_SETTINGS.md) for exact presets, limits, and behavior.

## Math Ladder

Math Ladder's **Source defaults** use Addition, two-digit operands, a 45-second cumulative timer, six correct answers to win, and three wrong answers to lose. Choose Easy, Source defaults, Hard, or Custom; custom settings allow one or more operations, one to four source digits, a 5-300 second timer, a 1-50 rung target, and a 1-20 miss limit. Optional operand bounds from 0 to 9,999 replace source sampling and the multiplication factor cap. Settings persist locally. Apply abandons the current run and returns to setup; Cancel keeps the same run paused.

Enter submits an answer. Blank answers do nothing; invalid integers show "Numbers only" without costing a miss. The mobile keypad includes number, minus, backspace, clear, and submit controls. Space pauses/resumes, R restarts to setup, and Escape returns to the arcade. Blur and hidden tabs pause the active timer; a late answer cannot beat an expired deadline. See [docs/MATH_LADDER_RULES.md](docs/MATH_LADDER_RULES.md) for source behavior and browser adaptations.

## Illuminate Quiz

Illuminate imports numeric and spelling quiz JSON stored only in this browser. Download [the bundled example](src/illuminate/example.json) to use as a starting point. Choose one or more files; each batch is validated together and either all valid quizzes are added or none are. Imports allow 512 KiB per file, 20 files per batch, 50 library entries, and 2 MiB of normalized library data. The full schema, answer formats, deadlines, and grading rules are in [docs/ILLUMINATE_QUIZ_RULES.md](docs/ILLUMINATE_QUIZ_RULES.md).

Audio spelling offers ten weekly words, Mixed Practice (ten weekly plus five extras by default), and configurable fourth-grade practice. Choose **Open spelling quiz** in Illuminate, or import your own weekly JSON. Answers stay hidden until submission. Results separate weekly and extra scores and support missed-word retry. See [spelling quiz authoring and audio limitations](docs/ILLUMINATE_SPELLING.md) and the [sample ten-word JSON](src/illuminate/spelling-example.json).

The library also has two local multiplication practice choices: 1-digit x 1-digit and 1-digit x 2-digits. Each run creates ten fresh untimed questions; generated rounds stay separate from uploaded quizzes and do not consume library space.

Answers accept full signed decimal or exponent numbers, correctly grouped commas, one leading `$`, and one trailing `%`. Enter saves and advances; the last question opens Review, where **Submit quiz** ends the attempt. Browser blur pauses timed attempts and requires an explicit resume. A late event finalizes with the last answer captured before the deadline. On touch screens, the keypad includes minus, decimal, backspace, clear, and navigation controls. Quiz imports and attempts stay on this device; if storage fails, the library remains in memory for the open page session and a visible notice reports the fallback.

## Human review checklist

- Play Classic Snake by keyboard and touch; test pause, restart, collision, navigation, scoring, and best-score persistence.
- In Snake Maze, try both trap modes, zoom and pan at 320 px, and verify a pause does not advance the run.
- In Snakeholm, enter a valid and invalid name, steer with both directions and touch, toggle the barbarian, pause through blur, restart, reach a natural ending, inspect local history, and download JSON.
- In Math Ladder, solve questions to win and enter wrong answers to lose; verify blank/invalid answers, pause and resume, settings persistence, the mobile keypad, and a 50-rung custom target.
- In Illuminate, import the bundled example and a custom batch; test atomic rejection, keyboard file selection, sorted navigation, flags, review, grading, retry, pause, expiry, storage failure, and the 320 px keypad.
- Confirm all games fit at 320 px with visible keyboard focus, readable status, and no page-wide horizontal overflow.
- Confirm browser storage failure leaves games playable and shows the relevant history or best-score fallback.

## GitHub Pages

The production build uses the `/parcade/` base path for a GitHub Pages project site. Build with `npm ci` and `npm run build`, then deploy the contents of `dist`. Saved data stays in each browser on that site.

