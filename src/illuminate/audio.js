// One active operation: cancellation settles pending playback and stops its sequence.
export function createAudioService({ synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance, AudioClass = globalThis.Audio, timeoutMs = 20000, pauseMs = 300, baseUrl = import.meta.env?.BASE_URL ?? '/' } = {}) {
  let generation = 0; let cancelPending = null; let recording = null; let current = null;
  function stop() {
    generation++;
    cancelPending?.(); cancelPending = null;
    synth?.cancel();
    if (recording) { recording.pause(); recording = null; }
  }
  function play(text, audio, language, rate, token) {
    return new Promise((resolve, reject) => {
      if (token !== generation) { resolve(false); return; }
      let timer; let settled = false;
      const finish = (error) => {
        if (settled) return; settled = true;
        clearTimeout(timer);
        if (cancelPending === cancel) cancelPending = null;
        if (error) reject(new Error('Audio unavailable')); else resolve(token === generation);
      };
      const cancel = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(false); };
      cancelPending = cancel;
      timer = setTimeout(() => finish(true), timeoutMs);
      try {
        if (audio && AudioClass) {
          const clip = new AudioClass(`${baseUrl}${audio.slice(1)}`); recording = clip; clip.playbackRate = rate;
          clip.onended = () => { if (recording === clip) recording = null; finish(); };
          clip.onerror = () => finish(true);
          Promise.resolve(clip.play()).catch(() => finish(true));
        } else {
          if (!synth || !Utterance) { finish(true); return; }
          const utterance = new Utterance(text); utterance.lang = language; utterance.rate = rate;
          const voices = synth.getVoices().filter((voice) => voice.lang.toLowerCase().split('-')[0] === language.toLowerCase().split('-')[0]);
          utterance.voice = voices.find((voice) => voice.lang === language && voice.localService) ?? voices.find((voice) => voice.lang === language) ?? voices.find((voice) => voice.localService) ?? voices[0] ?? null;
          utterance.onend = () => finish(); utterance.onerror = () => finish(true);
          synth.speak(utterance);
        }
      } catch { finish(true); }
    });
  }
  async function word(entry, language, rate, token) {
    try { return await play(entry.word, entry.audio, language, rate, token); }
    catch {
      if (token !== generation) return false;
      if (recording) { recording.pause(); recording = null; }
      if (!entry.audio) throw new Error('Audio unavailable');
      return play(entry.word, null, language, rate, token);
    }
  }
  async function run(entry, { language = 'en-US', rate = 0.9, sequence = false, sentenceOnly = false } = {}) {
    stop(); if (!sentenceOnly) current = { entry, language, rate }; const token = generation;
    try {
      if (sentenceOnly) return await play(entry.sentence, null, language, rate, token);
      if (!await word(entry, language, rate, token)) return false;
      if (sequence) {
        await new Promise((resolve) => { const timer = setTimeout(resolve, pauseMs); cancelPending = () => { clearTimeout(timer); resolve(); }; });
        if (token !== generation) return false;
        cancelPending = null;
        if (entry.sentence && !await play(entry.sentence, null, language, rate, token)) return false;
        return await word(entry, language, rate, token);
      }
      return true;
    } catch { if (token !== generation) return false; stop(); throw new Error('Audio unavailable'); }
  }
  return {
    stop, isAvailable: (entry) => Boolean((synth && Utterance) || (entry?.audio && AudioClass)),
    speakWord: (entry, options) => run(entry, options),
    speakSentence: (sentence, options) => run({ sentence }, { ...options, sentenceOnly: true }),
    repeat: () => current ? run(current.entry, { language: current.language, rate: current.rate }) : Promise.resolve(false),
  };
}
