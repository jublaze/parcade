# Math Ladder Rules and Browser Plan

**Status:** implemented in Parcade. The source rules, browser settings, and adaptations below describe the shipped Math Ladder game.

## Source reference

The read-only reference is `the original Math Ladder reference`, SHA-256 `9B6E97ECEE5C6795323AF289620B963662238641171E2C5FDE66BD6DA11DA1FF` (513 lines). The source remains unchanged. Math Ladder has no score-history requirement; this browser adaptation stores only its settings.

## Source rules and defaults

- The ladder has six correct-answer rungs. Solve one question to advance one rung. The source loses after three incorrect integer answers.
- The menu defaults to Addition, maximum two digits, and 45 seconds. Source menu choices are Addition, Subtraction, or Multiplication; 1–4 maximum digits; and a timer chosen from 5, 30, 45, 60, 90, 120, 180, 240, or 300 seconds.
- In source digit mode, each operand is an integer from 1 through `10^digits - 1`, inclusive. Addition asks for their sum. Subtraction orders the two operands high-to-low, so answers are nonnegative and may be zero.
- For multiplication with one or two digits, operands use the same digit range. At three or four digits, the source deliberately caps both factors to 2–99 inclusive. This keeps its multiplication questions smaller than its addition questions.
- The timer is cumulative for the whole run; a new question does not reset it. On a correct answer, show **Correct**, advance the rung, clear the entry, and create the next question unless the sixth rung wins. On a wrong integer answer, show **Wrong**, increment the run's wrong count, and create a new question unless the configured limit loses the run.
- Blank submission is ignored. A non-integer produces **Numbers only**, does not consume an error, and clears the entry. The source input normally accepts only digits and, for subtraction, a leading minus; the explicit invalid-integer behavior remains useful for browser/mobile keyboards.
- Winning enters the `WIN` state and displays fireworks. Reaching the wrong-answer limit or expiring the timer enters `SPLAT`. Enter from either terminal state returns to the menu. Escape quits the Pygame process.
- The source creates a fresh menu after a terminal return, so its visible values reset to the defaults. It does not save scores or player names.

## Browser settings

The browser default must exactly match the source values: **Addition**, **2 digits**, **45 seconds**, **6 correct answers to win**, and **3 wrong answers to lose**. Proposed presets are:

| Preset | Operations | Digits | Time | Correct to win | Wrong to lose |
|---|---|---:|---:|---:|---:|
| Easy | Addition, Subtraction | 1 | 90 s | 6 | 5 |
| Source defaults | Addition | 2 | 45 s | 6 | 3 |
| Hard | Mixed: all three | 3 | 45 s | 8 | 2 |
| Custom | Player-selected | Player-selected | Player-selected | Player-selected | Player-selected |

Keep these editable fields and persist applied settings locally. These Easy and Hard values are proposed browser presets; only Source defaults are inherited from the Pygame version.

Custom bounds are:

| Setting | Default | Allowed values |
|---|---:|---:|
| Operation | Addition | Addition, Subtraction, Multiplication; choose one or more |
| Maximum digits | 2 | Integer 1–4 |
| Timer | 45 seconds | Integer 5–300 seconds |
| Correct answers to win | 6 | Integer 1–50 |
| Wrong answers to lose | 3 | Integer 1–20 |
| Custom operand minimum | Off | Optional integer 0–9,999 |
| Custom operand maximum | Off | Optional integer minimum–9,999, at least the minimum |

When custom operand bounds are off, use the source digit ranges and multiplication cap exactly. When both bounds are on, draw operands uniformly from that inclusive range; these bounds override source digit sampling and the 2–99 multiplication shortcut. For Subtraction, sort the sampled operands high-to-low. If more than one operation is selected, choose uniformly among the selected operations for each new question. Mixed operation selection and custom operand bounds are deliberate browser extensions, not source behavior. The initial selection remains Addition only.

Reject incomplete custom ranges, non-integers, values outside the stated bounds, and minimum greater than maximum. Do not mutate an active run when a setting changes. Opening settings pauses the run. Cancel leaves it paused and unchanged. Apply validates, saves, and abandons the current ladder without a score record, returning to setup for a fresh run with the new immutable configuration. Restart also returns to setup; the player explicitly starts the next attempt. Returning to the arcade abandons the attempt without a record.

## Browser controls and timing

- Retain the setup menu's operation, digits, and timer choices; add the target, wrong-answer limit, custom range, and preset controls. Provide visible settings summaries and a reset to the source defaults.
- Use a focused numeric answer field, physical number keys, Backspace, and Enter. Supply a real mobile numeric keypad and visible **Clear**, **Backspace**, and **Submit** controls. Focused fields and buttons retain normal text entry and native Enter/Space activation.
- Blank submit stays silent. Invalid non-integer input shows **Numbers only** without advancing the wrong count. Correct and incorrect integer answers follow the same rung, counter, and new-question rules as the source.
- Use a monotonic active-time clock. Pause on explicit request, window blur, or hidden document; pause suspends both questions and timer, requires explicit resume, and does not simulate missed ticks. Rendering delays during active play still count against the deadline.
- Check elapsed time before accepting an answer. If the deadline has passed, end as `SPLAT`; a late correct answer cannot win. This ordering is a deliberate browser improvement: the Pygame loop processes key events before its next timer update.
- Enter from `WIN` or `SPLAT` opens setup. Escape returns to the Parcade selector and cleans up the timer and listeners, rather than quitting the browser. Applied settings persist across terminal returns; this deliberately replaces the source menu's reset-to-default behavior. **Source defaults** restores the original values.

## Presentation and accessibility

Keep the ladder, current question, remaining time, wrong-answer count, answer field, and feedback readable and usable at 320 px without document-wide horizontal overflow. Use visible keyboard focus, labels, and a restrained live announcement for each answer result and terminal state, not every timer frame. Keep controls reachable by touch with full-size hit areas.

Make the win celebration finite (at most three seconds), then leave the win state and replay prompt visible. Honor `prefers-reduced-motion` by skipping particle movement and showing a brief static success treatment. Do not require emoji fonts, external assets, remote services, player names, or score storage.

## Source adaptations

The operation and source-digit rules, multiplication factor cap, ladder progression, cumulative timer, answer feedback, and wrong-answer loss remain faithful. Persisted settings, custom operand ranges, mixed operations, pause/visibility handling, pre-answer deadline enforcement, finite reduced-motion celebration, browser-safe setup/restart, and returning to the arcade are explicit browser adaptations. Keep Math Ladder's question/state model separate from Snake, Snake Maze, and Snakeholm.
