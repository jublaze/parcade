# Game Settings Plan

**Status:** implemented for Classic Snake, Snake Maze, and Snakeholm. This document records the settings behavior and source-default constraints.

This document specifies settings for the existing Classic Snake, Snake Maze, and Snakeholm games. Preset source defaults must reproduce current behavior exactly. Settings are game-specific; they must not merge the games into a shared engine or alter their movement, collision, scoring, or world-generation rules.

## Shared behavior

- Each game offers **Easy**, **Source defaults**, **Hard**, and **Custom**. Selecting a preset fills the form; it does not silently apply. **Source defaults** restores that game's values below without clearing Classic best score or Snakeholm history.
- Store applied settings separately per game in browser-local storage. Validate the complete draft before applying. Invalid or out-of-range fields, non-integers, and cross-field constraint failures keep the current configuration unchanged and show an accessible field-level explanation.
- If storage cannot be read or written, retain the source defaults and any applied settings in memory for the current page session, show a brief settings-storage notice, and keep play available.
- A game run receives an immutable settings snapshot. A settings change never alters an active board or timer in place. Display the active configuration name and relevant values in the game HUD or settings summary.
- Opening settings during play pauses the active game and suspends its timer. **Cancel** discards the draft and leaves the same run paused; resuming is explicit and uses the unchanged configuration. **Apply** validates and saves the new configuration, abandons the paused run without creating a terminal record, and prepares a fresh run with the new snapshot. Classic returns to ready with score zero and its best preserved; Maze returns to a fresh level-one mode screen; Snakeholm returns to name entry without logging the interrupted run. Starting play remains explicit.
- From a pregame screen, **Apply** saves the configuration and returns to that game's pregame screen. **Reset to Source defaults** changes the draft; it takes effect only after Apply. Do not put form controls in a keyboard shortcut's way: text fields retain typing and focused controls retain native Enter/Space behavior. Provide touch-sized buttons and readable labels at 320 px.

## Classic Snake

| Preset | Board | Tick |
|---|---:|---:|
| Easy | 24 × 24 | 180 ms |
| Source defaults | 20 × 20 | 120 ms |
| Hard | 14 × 14 | 80 ms |

Custom settings allow a square board from **12 through 40** cells per side and a fixed tick from **40 through 1,000 ms**. The configured board remains bounded. Center the same three-cell snake, heading right; preserve the source default's exact initial placement on the 20-cell board. The tick is fixed for the whole run.

Keep existing food placement, turn queue, wall and body collisions, tail-vacancy rule, one-cell growth, +10 score, win condition, and controls unchanged. The best score remains one local value shared across configurations; show it as an overall best, not a difficulty-specific record. Scores from different board sizes and speeds are therefore directly compared by the existing absolute score rule.

## Snake Maze

| Preset | Start tick | Floor | Change per level | Traps per level | Trap policy |
|---|---:|---:|---:|---:|---|
| Easy | 120 ms | 60 ms | 0 ms | 1 | Refresh |
| Source defaults | 80 ms | 40 ms | 1 ms | 3 | Refresh |
| Hard | 60 ms | 30 ms | 2 ms | 6 | Persist + add |

Custom ranges are **40–500 ms** for start tick, **20–500 ms** for floor, **0–10 ms** for per-level reduction, and **0–30** traps per level. Floor must be no greater than start tick. For level `n`, use `max(floor, start - (n - 1) × reduction)`. The source preset thus retains its current `max(40, 80 - (level - 1))` behavior.

Keep the bounded 50-by-15 board, ten distinct logical snake segments including the off-board tail, safe first five trap columns, source movement and current-heading reversal checks, collision with the full current snake, and level transition. Trap policy remains either refresh or persist-and-add; placement remains capped to available cells and reports any shortage. A zero trap value disables new placement; it does not clear traps already retained by Persist + add.

The currently applied trap policy is part of the persisted Maze configuration. The mode screen is seeded from that saved value; choosing a different policy there is a draft until **Apply/Start** accepts it. Once accepted, the selected policy remains the user's saved choice when the death screen returns to the mode screen. Untouched Source defaults still begin with Refresh selected, so the first run remains source-faithful. **Reset to Source defaults** restores Refresh. This replaces the old transient selection reset only after the player explicitly applies another policy; it avoids silently discarding a saved preference.

## Snakeholm

| Preset | Tick | Active time | Starting population | Obstacles | Initial traps | Food every | Barbarian |
|---|---:|---:|---:|---:|---:|---:|---|
| Easy | 180 ms | 180 s | 8 | 30 | 2 | 6 ticks | Off |
| Source defaults | 120 ms | 120 s | 5 | 55 | 5 | 10 ticks | On |
| Hard | 80 ms | 90 s | 3 | 90 | 10 | 15 ticks | On |

Custom bounds are **40–1,000 ms** per tick, **15–600 seconds** active time, **1–100** starting population, **0–300** obstacles, **0–300** initial traps, and food cadence **1–100 ticks**. Barbarian is a boolean. Integer values are required.

Keep the bounded 30-by-30 board, home selection and 3-by-3 safety buffer, source runner/population semantics, food and trap branch behavior, barbarian movement, collision order, and active-time handling. Obstacle, trap, food, and barbarian placement remains bounded and saturation-safe; when requested counts exceed available cells, place only what fits and report each shortage. Settings do not make a blocked cell walkable or change the order of a tick.

## Implementation boundary

Implement separate per-game forms and immutable configuration snapshots. A small shared validator or safe local-settings reader is acceptable; game rules and state transitions remain in their existing game-specific modules. Do not add settings to a run midway, change the source presets to match a difficulty preset, or treat automated checks as human acceptance.
