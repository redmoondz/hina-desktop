// One player per renderer: previews and assistant replies share stop/replacement semantics.
let generation = 0;
let audio: HTMLAudioElement | null = null;
let subscribed = false;
let finishPlayback: (() => void) | null = null;

export function storedSpeechOptions() {
  const number = (key: string, fallback: number, low: number, high: number) => {
    const raw = localStorage.getItem(key);
    const value = raw === null ? fallback : Number(raw);
    return Number.isFinite(value) && value >= low && value <= high ? value : fallback;
  };
  return {
    engine:
      localStorage.getItem("hinaSpeechEngine") === "xtts"
        ? ("xtts" as const)
        : ("windows" as const),
    language: localStorage.getItem("hinaSpeechLanguage") || "ru-RU",
    voice:
      localStorage.getItem("hinaSpeechEngine") === "xtts"
        ? localStorage.getItem("hinaSpeechXttsVoice") || undefined
        : localStorage.getItem("hinaSpeechVoice") || undefined,
    reference: localStorage.getItem("hinaSpeechReference") || undefined,
    device:
      localStorage.getItem("hinaSpeechDevice") === "cuda" ? ("cuda" as const) : ("cpu" as const),
    speed: number("hinaSpeechSpeed", 1, 0.5, 2),
    temperature: number("hinaSpeechTemperature", 0.65, 0.1, 1),
    volume: number("hinaSpeechVolume", 1, 0, 1),
  };
}

function clearPlayback() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  finishPlayback?.();
  finishPlayback = null;
}

function subscribeToOtherPlayers() {
  if (subscribed || !window.electronAPI.onHinaSpeechPlaybackStop) return;
  window.electronAPI.onHinaSpeechPlaybackStop(() => {
    generation++;
    clearPlayback();
  });
  subscribed = true;
}

export async function stopHinaReply() {
  subscribeToOtherPlayers();
  generation++;
  clearPlayback();
  return window.electronAPI.hinaSpeechStop?.() ?? { ok: true };
}

export async function speakHinaReply(text: string, options = storedSpeechOptions()) {
  subscribeToOtherPlayers();
  const current = ++generation;
  clearPlayback();
  const result = await window.electronAPI.hinaSpeechSpeak({ text, ...options });
  if (current !== generation) return { ok: true, stopped: true };
  if (!result.ok || result.stopped || !result.audio) return result;
  const binary = atob(result.audio);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  const player = new Audio(url);
  audio = player;
  player.volume = options.volume;
  return new Promise<{ ok: boolean; stopped?: boolean; error?: string }>((resolve) => {
    let done = false;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      player.pause();
      player.onended = player.onerror = null;
      URL.revokeObjectURL(url);
      if (audio === player) audio = null;
      if (finishPlayback === cancel) finishPlayback = null;
      resolve(error ? { ok: false, error } : { ok: true, stopped: current !== generation });
    };
    const cancel = () => finish();
    finishPlayback = cancel;
    player.onended = () => finish();
    player.onerror = () => finish("Could not play locally generated XTTS audio.");
    void player
      .play()
      .catch(() => finish("Audio playback could not start. Try the voice preview."));
  });
}
