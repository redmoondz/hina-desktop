import { useCallback, useEffect, useRef, useState } from "react";
import { openMicrophone, type MicrophoneLevel } from "../helpers/microphoneProcessing";

export function useMicrophoneTest(deviceKey: string) {
  const [status, setStatus] = useState<"idle" | "opening" | "recording" | "stopping">("idle");
  const [level, setLevel] = useState<MicrophoneLevel>({ rms: 0, peak: 0, gain: 1 });
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const capture = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const url = useRef("");

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    capture.current?.getTracks().forEach((track) => track.stop());
    capture.current = null;
    recorder.current = null;
  }, []);

  const reset = useCallback(() => {
    generation.current++;
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
    release();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = "";
  }, [release]);

  useEffect(() => {
    reset();
    setPlaybackUrl("");
    setStatus("idle");
    setLevel({ rms: 0, peak: 0, gain: 1 });
    return reset;
  }, [deviceKey, reset]);

  const stop = useCallback(() => {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    setStatus("stopping");
    active.stop();
    // Stop using the device immediately; onstop still delivers the final blob.
    capture.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const start = useCallback(async () => {
    if (capture.current || recorder.current) return;
    reset();
    const current = generation.current;
    setFailed(false);
    setPlaybackUrl("");
    setStatus("opening");
    try {
      const stream = await openMicrophone((reading) => {
        if (generation.current === current) setLevel(reading);
      });
      if (generation.current !== current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      capture.current = stream;
      const active = new MediaRecorder(stream);
      recorder.current = active;
      const chunks: Blob[] = [];
      active.ondataavailable = ({ data }) => {
        if (data.size) chunks.push(data);
      };
      active.onstop = () => {
        if (generation.current !== current) return;
        const blob = new Blob(chunks, { type: active.mimeType });
        release();
        if (blob.size) {
          url.current = URL.createObjectURL(blob);
          setPlaybackUrl(url.current);
        } else setFailed(true);
        setStatus("idle");
        setLevel({ rms: 0, peak: 0, gain: 1 });
      };
      active.onerror = () => {
        if (generation.current !== current) return;
        reset();
        setFailed(true);
        setStatus("idle");
      };
      active.start(250);
      setStatus("recording");
      timer.current = setTimeout(stop, 60_000);
      stream.getAudioTracks()[0].addEventListener("ended", stop, { once: true });
    } catch {
      if (generation.current !== current) return;
      release();
      setFailed(true);
      setStatus("idle");
    }
  }, [release, reset, stop]);

  return { status, level, playbackUrl, failed, start, stop };
}
