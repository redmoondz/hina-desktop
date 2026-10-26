import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSettings } from "../stores/settingsStore";
import { sessionSurfaceTransition } from "../helpers/hinaSessionSurface";

const ACTIVE_KEY = "hinaActiveSession";
export function useHinaSessions(enabled) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(() =>
    enabled ? localStorage.getItem(ACTIVE_KEY) : null
  );
  const activeRef = useRef(activeId);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(0);
  const sendingRef = useRef(0);
  const generations = useRef(0);
  const refreshInFlight = useRef(false);
  const spokenRequests = useRef(new Map());
  const setActive = useCallback((id) => {
    activeRef.current = id;
    setActiveId(id);
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }, []);
  const request = useCallback(
    async (sessionAction, extra = {}) => {
      if (localStorage.getItem("hinaConnectorEnabled") !== "true") {
        throw new Error(t("hinaSessions.configureConnector"));
      }
      const settings = getSettings();
      const token = await window.electronAPI.getDictationAgentCustomKey?.();
      const result = await window.electronAPI.hinaConnectorRequest({
        url: settings.dictationAgentRemoteUrl || "http://127.0.0.1:3210",
        token: token || settings.dictationAgentCustomApiKey,
        transport: localStorage.getItem("hinaConnectorTransport") === "wsl" ? "wsl" : "local",
        sessionAction,
        timeoutSeconds: Number(localStorage.getItem("hinaConnectorTimeoutSeconds") || 300),
        ...extra,
      });
      if (!result.ok) throw new Error(result.error || t("hinaSessions.connectionError"));
      return result;
    },
    [t]
  );
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const generation = generations.current;
    try {
      const result = await request("list");
      // A list requested before a new submission must not overwrite its result.
      if (generation === generations.current) setSessions(result.sessions || []);
      setError("");
    } catch (failure) {
      setError(failure.message);
    } finally {
      refreshInFlight.current = false;
    }
  }, [request]);
  useEffect(() => {
    if (!enabled) return undefined;
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, [enabled, refresh]);
  const send = useCallback(
    async (text, options = {}) => {
      const id = activeRef.current || crypto.randomUUID();
      setActive(id);
      const requestId = crypto.randomUUID();
      if (options.spoken) spokenRequests.current.set(requestId, id);
      const content = options.selectedContext?.text
        ? `${text}\n\n${options.selectedContext.text}`
        : text;
      sendingRef.current += 1;
      setSending(sendingRef.current);
      generations.current += 1;
      try {
        const result = await request("send", { sessionId: id, requestId, text: content });
        setSessions((current) => [
          result.session,
          ...current.filter((session) => session.id !== id),
        ]);
        // Closing while the submission was crossing IPC still archives its task.
        if (activeRef.current !== id) await request("close", { sessionId: id });
        setError("");
      } catch (failure) {
        setError(failure.message);
      } finally {
        generations.current += 1;
        sendingRef.current -= 1;
        setSending(sendingRef.current);
      }
    },
    [request, setActive]
  );
  const close = useCallback(() => {
    const id = activeRef.current;
    setActive(sessionSurfaceTransition({ activeId: id, visible: true }, "close").activeId);
    if (id) void request("close", { sessionId: id }).catch((failure) => setError(failure.message));
  }, [request, setActive]);
  useEffect(() => {
    for (const item of sessions) {
      for (const turn of item.messages) {
        if (
          !spokenRequests.current.has(turn.id) ||
          !["completed", "failed", "unknown"].includes(turn.status)
        )
          continue;
        spokenRequests.current.delete(turn.id);
        if (
          !turn.reply ||
          activeRef.current !== item.id ||
          localStorage.getItem("hinaSpeechEnabled") === "false"
        )
          continue;
        void window.electronAPI
          .hinaSpeechSpeak?.({
            text: turn.reply,
            language: localStorage.getItem("hinaSpeechLanguage") || "ru-RU",
            voice: localStorage.getItem("hinaSpeechVoice") || undefined,
          })
          .catch(() => setError(t("hinaSettings.speechFailed")));
      }
    }
  }, [sessions, t]);
  const session = sessions.find((item) => item.id === activeId);
  const busy =
    sending > 0 ||
    Boolean(
      session?.messages.some((turn) => turn.status === "running" || turn.status === "queued")
    );
  return {
    enabled,
    sessions,
    session,
    activeId,
    send,
    close,
    select: setActive,
    busy,
    error,
    refresh,
  };
}
