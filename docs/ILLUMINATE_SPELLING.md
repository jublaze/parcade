# Audio spelling quizzes

Implementation plan: Extend Illuminate's `normalizeQuiz` and `gradeAttempt` in model.js, reuse its atomic imports and local library store, and add a spelling presentation inside mountIlluminate. spelling.js owns validation and session selection; audio.js owns browser speech and file playback. Numeric quiz paths remain compatible. The browser runtime needs no new dependencies. A versioned grade-level bank and sample weekly list ship with the app.

Weekly mode tests exactly ten assigned words, shuffled by default. Mixed includes all ten plus five distinct bank words by default. Grade practice defaults to ten bank words. Counts are configurable up to the available bank size. Missed-word retry includes incorrect submissions only; skips are separate and excluded from the scoring denominator. Results and attempt numbers stay in memory, matching existing Illuminate attempts. Imported quiz definitions persist in the existing browser library.

## Creating a weekly quiz

Copy [spelling-example.json](../src/illuminate/spelling-example.json), change quiz_id and title, and replace all ten entries in words. Import it through Illuminate's existing Choose quiz files control. Use type `spelling`, a positive integer grade, a language tag (for example en-US), and settings.extraWordBank matching a registered bank. Weekly words must be distinct after Unicode NFC, trimming, and case normalization. Optional entry fields: numeric id, category (weekly in an assigned list), sentence, audio. Sentences must contain the word; provide context for homophones. Text and sentences are never displayed during an unanswered question.

Audio references use `/audio/` paths resolved beneath the deployment base with a .mp3, .wav, .ogg, or .m4a suffix; place files in `public/audio/`. URLs, traversal, query strings and data URLs are rejected. File existence and decoding are checked at playback; a failed recording falls back to speech. These are deployment resources, not files bundled inside an imported JSON. Recorded clips supply word audio; sentences use TTS.

Add future banks as version-controlled resources and register them in spelling.js's WORD_BANKS map. Each bank has id, grade, language, and distinct word objects with context sentences. This starter grade-four bank is an authored practice collection, not a district curriculum or standardized grade assessment. Teachers should review list suitability.

## Audio and QA

Speech uses the browser Web Speech API, language-matched voices (preferring installed local voices), and a default rate of 0.9. Each question plays word, brief pause, optional sentence, word. Hear Word, Hear Sentence, and Replay cancel previous playback. Recorded audio takes priority for words. Navigation, pause, blur, and unmount cancel playback. Errors and timeouts show a generic retry/skip notice without exposing the word. Skip is never a wrong answer.

Voice availability and quality depend on browser and installed OS voices. Installed local voices and deployment audio can work without internet once the site is loaded; the app has no service worker or offline site cache. Some browser voices require internet. Touch browsers may require Hear Word after Start to unlock audio. Browser APIs cannot prove the speakers are audible: check volume and output device manually. Input requests disabled spellcheck, writing suggestions (`writingsuggestions="false"`), autocomplete, autocorrect, and automatic capitalization; OS keyboards may still offer suggestions.

Reference: [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis), [speech error events](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisErrorEvent/error).

Human QA remains required for real English pronunciation, homophones, recorded clips, touch playback and a complete 15-word mixed round on target devices. Automated audio mocks verify requests and cancellation, not audible sound quality.

