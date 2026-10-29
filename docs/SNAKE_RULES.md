# Snake Rules and Product Plan

## Game rules

- The board is a bounded 20-by-20 grid. The snake cannot wrap around its edges.
- A new game starts with a three-cell snake centered on the board and heading right.
- The game advances on a fixed 120 ms tick.
- Eating food adds one cell to the snake and 10 points to the score.
- Food is placed uniformly at random among currently empty cells.
- Hitting a wall or the snake's body loses the game. Moving into the tail cell is allowed when that move does not grow the snake, because the tail vacates on that tick.
- The player may queue up to two valid direction changes. Validate each change against the last queued direction, or the current heading if the queue is empty. Reject reversals, duplicate directions, and repeated key presses. Consume at most one queued turn per tick.
- Pause on window blur or document visibility loss. Do not resume automatically or catch up elapsed time. Clear queued directions on pause. Starting or resuming requires an explicit player action.
- Restart creates a fresh game state, timer, and input queue while preserving the best score.
- Store the best score in localStorage. If storage is unavailable, continue playing with an in-memory best score and no error shown to the player.
- Filling all 400 board cells wins the game.

## Controls

- Arrow keys and WASD steer the snake.
- Space starts from ready, pauses while running, and resumes while paused.
- R restarts during a game, including after a win or loss.
- Escape returns to the arcade selector after pausing and cleaning up the active game.
- Touch directional buttons provide the same steering controls. Touch controls also provide start, pause/resume, restart, and return-to-arcade actions.

## Settings

Source defaults use a 20-by-20 board and 120 ms ticks. Easy uses 24-by-24 and 180 ms; Hard uses 14-by-14 and 80 ms. Custom values are bounded to board sizes 12–40 and ticks 40–1,000 ms. The three-cell snake remains centered and heads right; the original 20-board starting cells stay unchanged. The overall best score is shared across settings. Opening settings pauses a running game. Cancel keeps the same run paused; Apply abandons it without affecting best score and prepares a fresh ready game.

## States and selector behavior

- `ready`: a new game is prepared; the timer is stopped and explicit start is required.
- `running`: ticks advance and input is accepted.
- `paused`: the timer is stopped, queued input is cleared, and explicit resume is required.
- `lost`: a collision ended the game; ticks and gameplay input stop.
- `won`: all cells are occupied; ticks and gameplay input stop.
- The arcade selector is outside the game state machine. Entering Snake creates a fresh `ready` game. Returning to the selector from any game state stops and cleans up its timer and input handlers. Re-entering Snake starts a fresh `ready` game; the stored best score remains.

## Implementation direction

- Use vanilla JavaScript ES modules with lightweight Vite tooling.
- Keep game-state logic pure and cover it with Node's built-in test runner.
- Use original, lively retro arcade visuals. Make the layout responsive and controls accessible to keyboard, touch, and assistive technology.
