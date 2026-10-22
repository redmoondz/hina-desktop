import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

type Voice = { id: string; name: string; language: string };

export default function HinaSpeechSettings() {
  const { t } = useTranslation();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [language, setLanguage] = useState(localStorage.getItem("hinaSpeechLanguage") || "ru-RU");
  const [voice, setVoice] = useState(localStorage.getItem("hinaSpeechVoice") || "");
  const [enabled, setEnabled] = useState(localStorage.getItem("hinaSpeechEnabled") !== "false");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try {
      const result = await window.electronAPI.hinaSpeechVoices();
      if (!result.ok) throw new Error(result.error);
      setVoices(result.voices || []);
      setStatus(result.voices?.length ? "" : t("hinaSettings.speechNoVoices"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("hinaSettings.speechFailed"));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
    const imported = () => {
      setLanguage(localStorage.getItem("hinaSpeechLanguage") || "ru-RU");
      setVoice(localStorage.getItem("hinaSpeechVoice") || "");
      setEnabled(localStorage.getItem("hinaSpeechEnabled") !== "false");
    };
    window.addEventListener("hina-preferences-imported", imported);
    return () => {
      window.removeEventListener("hina-preferences-imported", imported);
    };
    // Refresh uses the current locale only for error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const available = voices.filter((item) => item.language === language);
  const languages = [...new Set(voices.map((item) => item.language))].sort();
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">{t("hinaSettings.speechTitle")}</h2>
      <p className="text-xs text-muted-foreground">{t("hinaSettings.speechDescription")}</p>
      <label className="flex items-center justify-between gap-3 text-sm">
        {t("hinaSettings.speechEnabled")}
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            localStorage.setItem("hinaSpeechEnabled", String(event.target.checked));
            if (!event.target.checked) void window.electronAPI.hinaSpeechStop();
          }}
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span>{t("hinaSettings.speechLanguage")}</span>
        <select
          aria-label={t("hinaSettings.speechLanguage")}
          className="w-full rounded border border-border bg-background p-2"
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value);
            setVoice("");
            localStorage.setItem("hinaSpeechLanguage", event.target.value);
            localStorage.removeItem("hinaSpeechVoice");
          }}
        >
          {!languages.includes(language) && (
            <option value={language}>
              {language} — {t("hinaSettings.speechUnavailable")}
            </option>
          )}
          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        <span>{t("hinaSettings.speechVoice")}</span>
        <select
          aria-label={t("hinaSettings.speechVoice")}
          className="w-full rounded border border-border bg-background p-2"
          value={voice}
          onChange={(event) => {
            setVoice(event.target.value);
            localStorage.setItem("hinaSpeechVoice", event.target.value);
          }}
        >
          <option value="">{t("hinaSettings.speechAutomatic")}</option>
          {voice && !available.some((item) => item.id === voice) && (
            <option value={voice}>
              {voice} — {t("hinaSettings.speechUnavailable")}
            </option>
          )}
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {!available.length && (
        <p className="text-xs text-muted-foreground">{t("hinaSettings.speechNoVoices")}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
          {t("hinaSettings.speechRefresh")}
        </Button>
        <Button
          size="sm"
          disabled={!available.length || busy}
          onClick={() => {
            setBusy(true);
            void window.electronAPI
              .hinaSpeechSpeak({
                text: t("hinaSettings.speechSample"),
                language,
                voice: voice || undefined,
              })
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
          onClick={() => void window.electronAPI.hinaSpeechStop()}
        >
          {t("hinaSettings.speechStop")}
        </Button>
      </div>
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
