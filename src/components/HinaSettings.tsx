import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/settingsStore";
import LocalWhisperPicker from "./LocalWhisperPicker";
import HinaConnectorSettings from "./settings/HinaConnectorSettings";
import HinaConfigSettings from "./settings/HinaConfigSettings";
import HinaGpuSettings from "./settings/HinaGpuSettings";
import HinaDictationStats from "./settings/HinaDictationStats";
import { Toggle } from "./ui/toggle";
import { MicrophoneSettings } from "./ui/MicrophoneSettings";
import { HotkeyInput } from "./ui/HotkeyInput";
import { Button } from "./ui/button";
import LanguageSelector from "./ui/LanguageSelector";
import TitleBar from "./TitleBar";
import logo from "../assets/icon.png";

function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function HinaSettings() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [autoStart, setAutoStart] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void window.electronAPI
      ?.getAutoStartEnabled?.()
      .then((state) => setAutoStart(state.enabled))
      .catch((error: unknown) => setStatus(String(error)));
  }, []);

  async function toggleAutoStart(enabled: boolean) {
    try {
      const result = await window.electronAPI.setAutoStartEnabled?.(enabled);
      if (!result?.success) throw new Error(result?.error || t("hinaSettings.actionFailed"));
      setAutoStart(enabled);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <TitleBar className="sticky top-0 z-20" />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-8">
        <header className="space-y-2">
          <img src={logo} alt="" width={56} height={56} className="mb-4 rounded-xl" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t("hinaSettings.trayApp")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("hinaSettings.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("hinaSettings.description")}</p>
        </header>

        <SettingsCard title={t("hinaSettings.shortcuts")}>
          <p className="text-xs text-muted-foreground">{t("hinaSettings.shortcutsDescription")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium">{t("hinaSettings.dictation")}</p>
              <HotkeyInput value={settings.dictationKey} onChange={settings.setDictationKey} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium">{t("hinaSettings.assistant")}</p>
              <HotkeyInput
                value={settings.voiceAgentKey}
                onChange={(key) => {
                  void settings
                    .setVoiceAgentKey(key)
                    .then((result) => {
                      if (!result.success)
                        setStatus(result.message || t("hinaSettings.actionFailed"));
                    })
                    .catch((error: unknown) => setStatus(String(error)));
                }}
              />
            </div>
          </div>
          <label className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {t("hinaSettings.activation")}
            <select
              className="rounded-md border border-border bg-background p-2"
              value={settings.activationMode}
              onChange={(event) => settings.setActivationMode(event.target.value as "tap" | "push")}
            >
              <option value="tap">{t("hinaSettings.tap")}</option>
              <option value="push">{t("hinaSettings.push")}</option>
            </select>
          </label>
        </SettingsCard>

        <SettingsCard title={t("hinaSettings.microphone")}>
          <MicrophoneSettings
            microphoneSelectionMode={settings.microphoneSelectionMode}
            selectedMicDeviceId={settings.selectedMicDeviceId}
            selectedMicDeviceLabel={settings.selectedMicDeviceLabel}
            micWarmHoldSeconds={settings.micWarmHoldSeconds}
            onSelectionModeChange={settings.setMicrophoneSelectionMode}
            onDeviceSelect={settings.setSelectedMicDevice}
            onMicWarmHoldSecondsChange={settings.setMicWarmHoldSeconds}
          />
        </SettingsCard>

        <SettingsCard title={t("hinaSettings.localModels")}>
          <p className="text-xs text-muted-foreground">
            {t("hinaSettings.localModelsDescription")}
          </p>
          <label className="block space-y-2 text-xs">
            <span>{t("hinaSettings.language")}</span>
            <LanguageSelector
              value={settings.preferredLanguage}
              onChange={settings.setPreferredLanguage}
            />
          </label>
          <LocalWhisperPicker
            selectedModel={settings.whisperModel}
            onModelSelect={(model) => {
              settings.setLocalTranscriptionProvider("whisper");
              settings.setWhisperModel(model);
            }}
          />
          <HinaGpuSettings />
        </SettingsCard>

        <HinaConnectorSettings />
        <HinaDictationStats />
        <HinaConfigSettings />

        <SettingsCard title={t("hinaSettings.preferences")}>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span className="space-y-1">
              <span className="block">Pause media while recording</span>
              <span className="block text-xs text-muted-foreground">
                Resume only media paused by Hina after recording stops.
              </span>
            </span>
            <Toggle
              ariaLabel="Pause media while recording"
              checked={settings.pauseMediaOnDictation}
              onChange={settings.setPauseMediaOnDictation}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            <span className="space-y-1">
              <span className="block">Keep transcription in clipboard</span>
              <span className="block text-xs text-muted-foreground">
                Insert text into the focused field and keep a copy in the clipboard. When off,
                restore the previous clipboard.
              </span>
            </span>
            <Toggle
              ariaLabel="Keep transcription in clipboard"
              checked={settings.keepTranscriptionInClipboard}
              onChange={settings.setKeepTranscriptionInClipboard}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t("hinaSettings.autoStart")}
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(event) => void toggleAutoStart(event.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t("hinaSettings.theme")}
            <select
              className="rounded-md border border-border bg-background p-2"
              value={settings.theme}
              onChange={(event) =>
                settings.setTheme(event.target.value as "auto" | "light" | "dark")
              }
            >
              <option value="auto">{t("hinaSettings.system")}</option>
              <option value="light">{t("hinaSettings.light")}</option>
              <option value="dark">{t("hinaSettings.dark")}</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">{t("hinaSettings.closeHint")}</p>
        </SettingsCard>
        {status && (
          <p role="status" className="text-sm text-destructive">
            {status}
          </p>
        )}
      </div>
    </main>
  );
}
