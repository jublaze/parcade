# Illuminate Quiz Rules and Browser Plan

**Status:** implemented in Parcade. This document records the accepted behavior and source adaptations.

## Source references

The read-only source is `the original Illuminate reference`, SHA-256 `7153426F8ADA3633870E50BB9376D6967BF3EC179CD5B3A220EE95886C895B7E`; its example data is `questions.json`, SHA-256 `FA709EE2FBF802281A62FDD15A5134BE3EE89D3B0C444860A7A8C195525F0FE5`. The source also has `templates/layout.html`, `home.html`, `quiz.html`, `review.html`, `results.html`, and `static/style.css`. These files are read-only references; do not run or import the Flask app as part of rules work.

Parcade will port the source's numeric quiz workflow. It will not become a generic quiz engine: no multiple-choice grading, arbitrary expressions, scripts, HTML prompts, remote fetching, accounts, or server uploads.

## Built-in multiplication practice

The library also offers two built-in practice choices: **1-digit × 1-digit** and **1-digit × 2-digits**. These choices are generated locally and are separate from uploaded quizzes; they do not add entries to the saved library or change the uploaded JSON schema. Each Start and Retry creates a fresh untimed round of ten questions with stable question IDs 1–10. Answers are exact integers and use the existing review, flag, grading, and results flow.

For 1-digit × 1-digit, a round samples ten distinct unordered multiplication facts from factors 1–9, treating reversed operands as the same fact. It then independently chooses a fair display orientation for each non-square fact, so either factor can appear first; square facts retain their single orientation. For 1-digit × 2-digits, the first factor is 1–9 and the second is 10–99; no fact repeats within the round. Generated prompts and answers are ordinary numeric quiz records held only in the current attempt. Choosing practice returns through the normal setup screen; opening another library quiz always uses that uploaded quiz's original questions.

## Quiz data

An imported quiz is a UTF-8 JSON object with a title, optional time limit, and one or more numeric questions. Questions are sorted by their positive integer `id`; that stable sorted order is the displayed and navigable order. Required question fields are `id`, `prompt`, and finite numeric `answer`. `skill`, `type`, `unit`, and `tolerance` are optional. Missing `skill` and `unit` become empty strings, missing `type` defaults to `numeric`, and missing `tolerance` defaults to `0.01`. Only `numeric` questions are supported. Nonempty `choices` or any unsupported type rejects the quiz rather than suggesting a choice mode that does not work.

```json
{
  "quiz_id": "percentages-practice",
  "title": "Percentages Practice",
  "time_limit_seconds": 0,
  "questions": [
    {
      "id": 1,
      "skill": "Percent discount",
      "prompt": "A crate costs $20. What is its price after 20% off?",
      "type": "numeric",
      "answer": 16,
      "unit": "dollars",
      "tolerance": 0.01
    }
  ]
}
```

`quiz_id` is a browser-library extension. If absent, import assigns a local UUID. An explicit ID must be a trimmed, nonempty string of at most 80 characters; a duplicate explicit ID in the current library or import batch rejects the whole batch. Reimporting a legacy quiz without an ID creates a distinct library entry. No imported file is executed or sent elsewhere.

## Validation and local library

Import one or more JSON files in a single batch. Validate every file and the resulting whole library before changing it; any invalid file, duplicate ID, or size/count overflow rejects the batch atomically and leaves the previous library intact. Bounds are:

| Item | Limit |
|---|---:|
| One source file | 512 KiB |
| Files in one batch | 20 |
| Quiz library entries | 50 |
| Normalized library JSON | 2 MiB UTF-8 |
| Quiz title | 1–120 trimmed characters |
| Time limit | `0` (untimed) or integer 5–3,600 seconds |
| Questions per quiz | 1–200 |
| Question ID | Unique integer 1–1,000,000 |
| Prompt | 1–2,000 characters |
| Skill | 0–120 characters |
| Unit | 0–40 characters |
| Numeric answer | Finite number with absolute value at most `1e12` |
| Tolerance | Finite number from 0 through `1e6`, default `0.01` |

Reject malformed JSON, non-object records, missing required fields, duplicate or out-of-range IDs, wrong types, non-finite numbers, invalid numeric strings, unsupported question types, and any total bound violation. Do not coerce strings to numbers in quiz definitions. Normalize accepted records to the supported schema and measure the normalized library using UTF-8 JSON bytes before committing the batch.

Store the library and selected quiz in local browser storage. If storage reads or writes fail, retain current state in memory for this page session and show a visible accessible notice. Corrupt stored data must fall back to a usable built-in example without deleting recoverable in-memory settings. The bundled example is compatible with the source's ten-question percentages quiz and can be downloaded as a JSON example. Removing a quiz affects only the local library; reject removal of the last remaining quiz unless the built-in example is restored.

## Question order, navigation, and attempt state

Starting or retrying a quiz creates a fresh attempt with questions in ascending ID order, empty answers, no flagged questions, elapsed active time zero, and no prior result. Show the current question number, total, skill, prompt, answer field, and its current flag/answered state. Answer status is based on a trimmed nonempty answer, matching the source review page. Flagging and unflagging are separate from answering.

Previous, Next, question-number navigation, and Review preserve the current field value before navigation. Enter saves the current answer and moves to the next question; on the last question it opens Review. Enter never finalizes the quiz. Review lists question number, skill, answered/blank status, flag state, and a link back to each question. The player explicitly chooses **Submit quiz** from Review to finalize. If that timely action occurs before the deadline, first flush the visible answer, then lock the attempt and create one result. Retry starts a new attempt with no inherited answers or flags. Returning to the library abandons the attempt without adding a result record.

The results page shows correct count, total, rounded percentage, elapsed active time, each raw answer, correct answer with unit, and flag state. Numeric grading is inclusive absolute tolerance: `abs(parsed_answer - correct_answer) <= tolerance`. Wrong answers and blanks count as incorrect in the final report. Each attempt is finalized once; duplicate submit actions cannot create duplicate results. Attempts and results stay in memory by default; do not add a score history or export private answers without a later approved request.

## Answer parsing

Trim surrounding whitespace. Accept plain decimals such as `16.00`, one leading `$` such as `$1,234.50`, correctly grouped thousands (first group 1–3 digits, later groups exactly three), and one trailing `%` such as `75%`. After removing only those valid markers and separators, require the entire remaining string to match a signed decimal or exponent form. Accept finite values only; do not use permissive prefix parsing (`parseFloat("12abc")` must not grade as 12). Empty input is blank. Invalid input is shown as invalid and does not create a result until final submission; it never crashes or silently becomes zero. Percent is a display/input marker only: do not divide by 100, matching the source. The source removes every `$` and comma before calling `float`; validating a single leading currency marker and correctly grouped commas is an intentional browser tightening that rejects malformed strings the Python source happens to accept.

## Timing and expiry

`time_limit_seconds: 0` means no limit. Other limits count active time across questions, review, and navigation. Use a monotonic clock; pause the active-time clock while the page is blurred or hidden and require an explicit resume. Visibility changes never cause movement or elapsed-time catch-up. A disabled or unavailable browser timer cannot extend the deadline: check monotonic elapsed time before accepting an answer, navigation, or manual final submission.

While the deadline has not passed, each answer input event saves the current field value in attempt state. Before a timely navigation or the explicit Submit quiz action, flush the current field again. At or after the deadline, check elapsed time before processing any input, navigation, or submit event; finalize once using the last answer values saved while timely, and ignore the late event's field value. This includes a draft typed before the deadline even if the player never pressed Save or navigated. Once finalized, disable later edits. This resolves a source bug: the original layout redirects expiry to `GET /submit`, while the Flask route accepts `POST /submit`, producing a method error. The browser finalizes locally and never uses that broken GET path. Timer expiry from a question or review page leads to the same locked results view as manual submission.

## Browser controls and accessibility

Use Parcade's existing vanilla JavaScript/Vite stack, with no backend. Provide an accessible local quiz library, import and example-download controls, quiz setup summary, question navigator, review, results, retry, and return-to-library actions. Render titles, skills, prompts, and answers as text; never interpret uploaded text as HTML. Report batch errors without partially importing entries. Keep settings and attempt controls keyboard-operable with visible focus, labels, status announcements for question/answer/final-state changes, and no timer announcement every second.

Use a labeled decimal input and support physical number keys, decimal point, minus sign, Backspace, and Enter to save/navigate as described above. On mobile, show a real keypad with digits, decimal, minus, Backspace, Clear, and Submit. Focused inputs and buttons retain native editing and activation. Touch targets and all question/review/results controls must remain visible and usable at 320 px with no page-wide horizontal overflow. Support prefers-reduced-motion; any success or score animation must be finite and nonessential.

## Source adaptations

The browser preserves the source's sorted numeric question order, numeric-only grading, dollars/commas/percent input, absolute tolerance, answered/blank and flagged review, final score report, retry, and untimed value zero. It adds a bounded local quiz library and strict whole-batch validation, local UUIDs for legacy files without IDs, safe text-only rendering, in-memory storage fallback, visible pause/resume for blur and hidden tabs, monotonic active time, answer flushing before navigation, and robust local deadline finalization. It intentionally fixes the source's GET-to-POST timer-expiry mismatch and does not import Flask, execute uploaded code, or send quiz data to a server.

## Audio spelling extension

Quiz files with `type: "spelling"` use the schema and modes in [ILLUMINATE_SPELLING.md](ILLUMINATE_SPELLING.md). Existing numeric files continue to use the schema and behavior above. Spelling has immediate feedback, unscored skips and missed-word retry; numeric review, timing and grading remain unchanged.
