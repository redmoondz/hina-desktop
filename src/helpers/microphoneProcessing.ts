import microphoneGainWorkletUrl from "./microphoneGainWorklet.js?worker&url";
import { useSettingsStore } from "../stores/settingsStore";
import { resolvePreferredMicrophone } from "./microphoneSelection";

export interface MicrophoneLevel {
  rms: number;
  peak: number;
  gain: number;
}

/** Owns the input stream. Existing capture teardown stops the returned track,
 * which also releases the worklet, context, subscription and original tracks. */
export async function processMicrophoneStream(
  input: MediaStream,
  onLevel?: (level: MicrophoneLevel) => void
): Promise<MediaStream> {
  let context: AudioContext | undefined;
  let unsubscribe: (() => void) | undefined;
  let disposeProcessing: (() => void) | undefined;
  try {
    context = new AudioContext();
    await context.audioWorklet.addModule(microphoneGainWorkletUrl);
    const readSettings = () => {
      const { micAutoBoost, micGainPercent } = useSettingsStore.getState();
      return { micAutoBoost, micGainPercent };
    };
    const source = context.createMediaStreamSource(input);
    const processor = new AudioWorkletNode(context, "microphone-gain", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
      outputChannelCount: [1],
      processorOptions: readSettings(),
    });
    const destination = context.createMediaStreamDestination();
    source.connect(processor);
    processor.connect(destination);
    processor.port.onmessage = ({ data }: MessageEvent<MicrophoneLevel>) => onLevel?.(data);
    unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (
        state.micAutoBoost !== previous.micAutoBoost ||
        state.micGainPercent !== previous.micGainPercent
      ) {
        processor.port.postMessage(readSettings());
      }
    });
    const track = destination.stream.getAudioTracks()[0];
    const raw = input.getAudioTracks()[0];
    const stopTrack = track.stop.bind(track);
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const name of ["ended", "mute", "unmute"]) raw.removeEventListener(name, forward);
      unsubscribe?.();
      source.disconnect();
      processor.disconnect();
      processor.port.close();
      input.getTracks().forEach((track) => track.stop());
      stopTrack();
      void context?.close().catch(() => {});
    };
    // Keep device identity and health events visible to microphone recovery.
    track.getSettings = () => raw.getSettings();
    Object.defineProperty(track, "muted", { get: () => raw.muted });
    const forward = (event: Event) => {
      if (event.type === "ended") dispose();
      track.dispatchEvent(new Event(event.type));
    };
    for (const name of ["ended", "mute", "unmute"]) raw.addEventListener(name, forward);
    track.stop = dispose;
    disposeProcessing = dispose;
    // A wedged Windows output device can leave resume pending indefinitely.
    // Bound startup and release the mic rather than recording a silent stream.
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => {
          resumeTimer = setTimeout(
            () => reject(new Error("Microphone audio processing did not start")),
            1500
          );
        }),
      ]);
    } finally {
      clearTimeout(resumeTimer);
    }
    return destination.stream;
  } catch (error) {
    if (disposeProcessing) disposeProcessing();
    else {
      unsubscribe?.();
      input.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
    }
    throw error;
  }
}

/** Same device selection and native processing policy as dictation. */
export async function openMicrophone(onLevel?: (level: MicrophoneLevel) => void) {
  const resolution = await resolvePreferredMicrophone({ settings: useSettingsStore.getState() });
  const deviceId = resolution.device?.deviceId;
  const input = await navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
      channelCount: 2,
    },
  });
  return processMicrophoneStream(input, onLevel);
}
