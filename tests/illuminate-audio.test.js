import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioService } from '../src/illuminate/audio.js';
function setup({ fail = false, hang = false, AudioClass } = {}) {
  const spoken = []; let cancellations = 0;
  const synth = { cancel: () => cancellations++, getVoices: () => [{ lang: 'en-US', localService: true }], speak: (u) => { spoken.push(u); if (!hang) queueMicrotask(() => fail ? u.onerror() : u.onend()); } };
  const audio = createAudioService({ synth, Utterance: class { constructor(text) { this.text = text; } }, AudioClass, pauseMs: 0, timeoutMs: 25 });
  return { audio, spoken, cancellations: () => cancellations };
}
test('audio speaks word, context and word; repeat is word-only with language and rate', async () => {
  const { audio, spoken } = setup();
  assert.equal(await audio.speakWord({ word: 'their', sentence: 'Their bags are full.' }, { sequence: true }), true);
  assert.deepEqual(spoken.map((u) => u.text), ['their', 'Their bags are full.', 'their']);
  await audio.repeat(); assert.equal(spoken.at(-1).text, 'their'); assert.equal(spoken.at(-1).rate, 0.9); assert.equal(spoken.at(-1).lang, 'en-US');
  await audio.speakSentence('Another sentence.'); assert.equal(spoken.at(-1).text, 'Another sentence.');
  await audio.repeat(); assert.equal(spoken.at(-1).text, 'their');
});
test('rapid replay cancels and settles old speech without uncontrolled queues', async () => {
  const { audio, spoken, cancellations } = setup({ hang: true });
  const first = audio.speakWord({ word: 'first' }, { sequence: true });
  const second = audio.speakWord({ word: 'second' });
  assert.equal(await first, false); assert.equal(spoken.length, 2);
  audio.stop(); assert.equal(await second, false); assert.equal(cancellations(), 3);
});
test('speech errors, missing API and silent timeout reject generically', async () => {
  for (const options of [{ fail: true }, { hang: true }]) {
    const { audio } = setup(options); await assert.rejects(audio.speakWord({ word: 'secret' }), /^Error: Audio unavailable$/);
  }
  const missing = createAudioService({ synth: null, Utterance: null, AudioClass: null });
  assert.equal(missing.isAvailable(), false); await assert.rejects(missing.speakWord({ word: 'secret' }), /Audio unavailable/);
});
test('recording overrides TTS, cancellation pauses clips, and decode failure falls back', async () => {
  const clips = [];
  class Clip { constructor(url) { this.url = url; clips.push(this); } play() { queueMicrotask(() => this.onended()); return Promise.resolve(); } pause() { this.paused = true; } }
  const { audio, spoken } = setup({ AudioClass: Clip });
  await audio.speakWord({ word: 'curious', audio: '/audio/one.mp3' }); assert.equal(spoken.length, 0); assert.equal(clips[0].playbackRate, 0.9);
  class BadClip extends Clip { play() { return Promise.reject(new Error('decode')); } }
  const fallback = setup({ AudioClass: BadClip }); await fallback.audio.speakWord({ word: 'curious', audio: '/audio/bad.mp3' }); assert.equal(fallback.spoken[0].text, 'curious');
  class HangingClip extends Clip { play() { return Promise.resolve(); } }
  const hanging = setup({ AudioClass: HangingClip }); const pending = hanging.audio.speakWord({ word: 'curious', audio: '/audio/one.mp3' }); hanging.audio.stop(); assert.equal(await pending, false); assert.equal(clips.at(-1).paused, true);
});

test('recorded clips resolve under the deployment base', async () => {
  let source;
  class Clip { constructor(url) { source = url; } play() { queueMicrotask(() => this.onended()); return Promise.resolve(); } pause() {} }
  const audio = createAudioService({ AudioClass: Clip, baseUrl: '/parcade/' });
  await audio.speakWord({ word: 'test', audio: '/audio/test.mp3' });
  assert.equal(source, '/parcade/audio/test.mp3');
});
