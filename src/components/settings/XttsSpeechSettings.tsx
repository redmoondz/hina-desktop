import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { speakHinaReply, stopHinaReply } from "../../helpers/hinaSpeechPlayback";

const LANGUAGES = [
  "ru",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "pl",
  "tr",
  "nl",
  "cs",
  "ar",
  "zh-cn",
  "hu",
  "ko",
  "ja",
  "hi",
];
export default function XttsSpeechSettings() {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [pythonPath, setPythonPath] = useState("");
  const [device, setDevice] = useState(localStorage.getItem("hinaSpeechDevice") || "cpu");
  const [language, setLanguage] = useState(
    (localStorage.getItem("hinaSpeechLanguage") || "ru").toLowerCase().startsWith("zh")
      ? "zh-cn"
      : (localStorage.getItem("hinaSpeechLanguage") || "ru").toLowerCase().split("-")[0]
  );
  const [voice, setVoice] = useState(localStorage.getItem("hinaSpeechXttsVoice") || "");
  const [reference, setReference] = useState(localStorage.getItem("hinaSpeechReference") || "");
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [speed, setSpeed] = useState(Number(localStorage.getItem("hinaSpeechSpeed") || 1));
  const [temperature, setTemperature] = useState(
    Number(localStorage.getItem("hinaSpeechTemperature") || 0.65)
  );
  const [volume, setVolume] = useState(Number(localStorage.getItem("hinaSpeechVolume") || 1));
  const refreshStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.hinaXttsStatus();
      setInstalled(result.installed);
      setInstalling(result.installing);
      if (result.error) setStatus(result.error);
    } catch {
      setStatus(t("hinaSettings.xttsStatusFailed"));
    }
  }, [t]);
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);
  useEffect(() => {
    if (!installing) return;
    const timer = window.setInterval(() => void refreshStatus(), 2000);
    return () => window.clearInterval(timer);
  }, [installing, refreshStatus]);
  async function loadVoices() {
    setBusy(true);
    try {
      const result = await window.electronAPI.hinaXttsVoices(device === "cuda" ? "cuda" : "cpu");
      if (!result.ok) throw new Error(result.error);
      setVoices(result.voices || []);
      setStatus(t("hinaSettings.xttsReady"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }
  const control = "w-full rounded border border-border bg-background p-2";
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("hinaSettings.xttsDescription")}</p>
      <label className="block space-y-1 text-xs">
        <span>{t("hinaSettings.xttsDevice")}</span>
        <select
          className={control}
          value={device}
          disabled={busy || installing}
          onChange={(event) => {
            setDevice(event.target.value);
            localStorage.setItem("hinaSpeechDevice", event.target.value);
            void stopHinaReply();
          }}
        >
          <option value="cpu">CPU</option>
          <option value="cuda">NVIDIA CUDA</option>
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{t("hinaSettings.xttsRequirements")}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={installing}
        onClick={() => {
          void window.electronAPI
            .hinaXttsSelectFile("python")
            .then((result) => {
              if (!result.canceled && result.path) setPythonPath(result.path);
            })
            .catch(() => setStatus(t("hinaSettings.xttsStatusFailed")));
        }}
      >
        {t("hinaSettings.xttsPython")}
      </Button>
      {pythonPath && <p className="break-all text-xs">{pythonPath}</p>}
      <p className="text-xs text-muted-foreground">{t("hinaSettings.xttsLicense")}</p>
      <Button
        variant="link"
        size="sm"
        onClick={() => void window.electronAPI.openExternal("https://tts-hub.github.io/cpml")}
      >
        {t("hinaSettings.xttsReadLicense")}
      </Button>
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={accepted}
          disabled={installing}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        {t("hinaSettings.xttsAcceptLicense")}
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!accepted || installing || busy}
          onClick={() => {
            setStatus("");
            void window.electronAPI
              .hinaXttsInstall({
                acceptLicense: accepted,
                device: device === "cuda" ? "cuda" : "cpu",
                pythonPath: pythonPath || undefined,
              })
              .then((result) => {
                if (!result.ok) setStatus(result.error || t("hinaSettings.speechFailed"));
                void refreshStatus();
              })
              .catch(() => setStatus(t("hinaSettings.speechFailed")));
          }}
        >
          {installing ? t("hinaSettings.xttsInstalling") : t("hinaSettings.xttsInstall")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!installed || busy || installing}
          onClick={() => void loadVoices()}
        >
          {t("hinaSettings.xttsCheck")}
        </Button>
      </div>
      <p role="status" className="text-xs">
        {installing
          ? t("hinaSettings.xttsInstalling")
          : installed
            ? t("hinaSettings.xttsInstalled")
            : t("hinaSettings.xttsNotInstalled")}
      </p>
      <label className="block space-y-1 text-xs">
        <span>{t("hinaSettings.speechLanguage")}</span>
        <select
          className={control}
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value);
            localStorage.setItem("hinaSpeechLanguage", event.target.value);
          }}
        >
          {LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {code === "ru" ? "Русский" : code === "en" ? "English" : code}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span>{t("hinaSettings.speechVoice")}</span>
        <select
          className={control}
          value={reference ? "__reference__" : voice}
          onChange={(event) => {
            if (event.target.value === "__reference__") return;
            setVoice(event.target.value);
            setReference("");
            localStorage.setItem("hinaSpeechXttsVoice", event.target.value);
            localStorage.removeItem("hinaSpeechReference");
          }}
        >
          <option value="">{t("hinaSettings.speechAutomatic")}</option>
          {reference && <option value="__reference__">{t("hinaSettings.xttsReference")}</option>}
          {voice && !voices.some((item) => item.id === voice) && (
            <option value={voice}>{voice}</option>
          )}
          {voices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || installing}
        onClick={() => {
          void window.electronAPI
            .hinaXttsSelectFile("reference")
            .then((result) => {
              if (!result.canceled && result.path) {
                setReference(result.path);
                localStorage.setItem("hinaSpeechReference", result.path);
              }
            })
            .catch(() => setStatus(t("hinaSettings.xttsStatusFailed")));
        }}
      >
        {t("hinaSettings.xttsChooseReference")}
      </Button>
      {reference && <p className="break-all text-xs">{reference}</p>}
      <p className="text-xs text-muted-foreground">{t("hinaSettings.xttsReferenceHelp")}</p>
      {(
        [
          ["speechSpeed", speed, setSpeed, "hinaSpeechSpeed", 0.5, 2, 0.05],
          ["speechTemperature", temperature, setTemperature, "hinaSpeechTemperature", 0.1, 1, 0.05],
          ["speechVolume", volume, setVolume, "hinaSpeechVolume", 0, 1, 0.05],
        ] as const
      ).map(([key, value, setter, storageKey, min, max, step]) => (
        <label key={key} className="block text-xs">
          <span>
            {t(`hinaSettings.${key}`)}: {value.toFixed(2)}
          </span>
          <input
            className="block w-full"
            dir="ltr"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(event) => {
              setter(Number(event.target.value));
              localStorage.setItem(storageKey, event.target.value);
            }}
          />
        </label>
      ))}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!installed || busy || installing}
          onClick={() => {
            setBusy(true);
            setStatus("");
            const sample =
              language === "ru"
                ? "Привет! Я Хина. Мой голос создаётся локально на вашем компьютере."
                : language === "en"
                  ? "Hello! I am Hina. My voice is generated locally on your computer."
                  : t("hinaSettings.speechSample");
            void speakHinaReply(sample)
              .then((result) =>
                setStatus(
                  result.ok
                    ? t("hinaSettings.speechTestOk")
                    : result.error || t("hinaSettings.speechFailed")
                )
              )
              .catch(() => setStatus(t("hinaSettings.speechFailed")))
              .finally(() => setBusy(false));
          }}
        >
          {t("hinaSettings.speechTest")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void stopHinaReply().catch(() => setStatus(t("hinaSettings.speechFailed")))
          }
        >
          {t("hinaSettings.speechStop")}
        </Button>
      </div>
      {status && (
        <p role="status" className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  );
}
