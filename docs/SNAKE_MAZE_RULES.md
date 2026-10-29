# Snake Maze Rules and Browser Plan

## Source reference

Reference behavior was read from `the original Snake Maze reference` (SHA-256 `62FE9C665B049036577754676A7879CC98C43A384C69F6757144CE079488F9D4`). The reference file remains unchanged. The existing Parcade Snake game and its rules remain unchanged.

## Maze rules

- The board is a bounded 50-column by 15-row grid. Keep all columns playable on every screen size. On narrow screens, show a contained full-board view and provide a zoomed, horizontally pannable board if the cells need to be larger. Scrolling the board must not create document-wide horizontal overflow.
- A run starts at level 1 with a fixed logical snake length of 10. The head starts at column 0 in a uniformly selected row and heads right. The reference constructs the nine trailing cells at columns -1 through -9; preserve those distinct off-board positions in the browser model and clip them at the board edge. Do not shift the head right or collapse the off-board cells into duplicates. The tail enters the board as the snake advances.
- The head advances one cell per tick. The tick interval is `max(40, 80 - (level - 1))` milliseconds. On reaching column 49, advance one level, reset the head to column 0 in a newly selected row, and reseed the ten-cell snake. Level speed uses the new level.
- A wall, trap, or any cell occupied by the snake causes death. Check the entire current snake, including its tail, before moving; entering the tail cell is fatal even if it would otherwise vacate on that tick. Death stops movement and shows the death screen.
- There is no food, growth, score, or other win condition in the reference. The run continues through levels until a collision.
- Trap mode is selected before each run. The default mode refreshes the layout at each new level. The other mode keeps existing traps and adds more. A fresh run clears all traps.
- Add three traps per level where possible. Traps may only occupy columns 5–49 and cannot overlap the new snake or existing traps. In refresh mode, clear traps before placing that level's three. In persist-and-add mode, retain existing traps before adding three.
- Direction input accepts arrows. Reject a reversal against the current heading. Keep only one pending direction: each accepted direction replaces the prior pending direction, and the pending direction is applied on the next tick. There is no turn queue. The source checks against the current heading, not against a pending turn.

## Browser behavior

- Add Snake Maze as a separate arcade game; retain the existing Snake entry and behavior. Its mode screen offers **Refresh each level** and **Persist + add**, with refresh selected by default, matching the source menu. Starting a run begins at level 1 with the selected mode. On death, R, Enter, Space, or the menu action returns to mode selection; selection resets to the default as in the source.
- When the mode screen opens, focus starts on its heading. Up/Down or W/S there changes the selected mode; Enter/Space starts or resumes when focus is outside a control. Focused buttons use native Enter/Space activation, and Up/Down or W/S on a focused mode choice changes the mode and moves focus with it.
- Support arrows and WASD, plus accessible touch direction buttons. Keep one latest pending turn and the source's no-reversal rule.
- Add explicit pause/resume, restart, settings/mode, and return-to-arcade controls for keyboard and touch. Pause, blur, or hidden-tab handling stops the timer, clears the pending turn, and requires explicit resume. Resume starts a fresh interval; do not simulate missed ticks. A restart begins a fresh level-1 run in the selected mode. Returning to the arcade stops and disposes of game input and timers.
- Applied settings add Easy, Source defaults, Hard, and Custom presets for starting/floor tick, speed-up per level, traps per level, and trap policy. Source defaults retain 80 ms, 40 ms floor, 1 ms level step, three traps, and Refresh. Bounded custom fields and the floor-at-or-below-start constraint are defined in `GAME_SETTINGS.md`. Settings apply starts a fresh level-one mode screen; Cancel leaves the paused run unchanged. The saved trap policy seeds the mode screen and remains selected after death.
- Place traps by enumerating eligible cells and sampling without replacement. Add up to three per level, capped by the number of available cells. If the board is saturated, place fewer and show a brief notice; never retry random coordinates indefinitely.
- Preserve bounded-board collisions and fixed logical snake length while rendering off-board tail cells clipped. The board's zoom/pan viewport may move independently of the 50-column game grid.
- Keep the mode/state model and rules tests specific to Snake Maze. Test first-level setup, off-board tail stages, current-heading reversal checks, replacement of pending direction, edge-level transition and speed floor, both trap modes, all collision types including the tail, placement saturation, pause/resume without catch-up, restart, and cleanup on arcade return.

