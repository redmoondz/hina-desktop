import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/settingsStore";
import type { CudaWhisperStatus, WhisperServerStatus } from "../types/electron";
import LocalWhisperPicker from "./LocalWhisperPicker";
import HinaConnectorSettings from "./settings/HinaConnectorSettings";
import { MicrophoneSettings } from "./ui/MicrophoneSettings";
import { HotkeyInput } from "./ui/HotkeyInput";
import { Button } from "./ui/button";
import LanguageSelector from "./ui/LanguageSelector";
import TitleBar from "./TitleBar";

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
  const [cuda, setCuda] = useState<CudaWhisperStatus | null>(null);
  const [server, setServer] = useState<WhisperServerStatus | null>(null);
  const [autoStart, setAutoStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const refreshGpu = useCallback(async () => {
    const [pack, runtime] = await Promise.all([
      window.electronAPI?.getCudaWhisperStatus?.(),
      window.electronAPI?.whisperServerStatus?.(),
    ]);
    if (pack) setCuda(pack);
    if (runtime) setServer(runtime);
  }, []);

  useEffect(() => {
    void refreshGpu().catch((error: unknown) => setStatus(String(error)));
    void window.electronAPI
      ?.getAutoStartEnabled?.()
      .then((state) => setAutoStart(state.enabled))
      .catch((error: unknown) => setStatus(String(error)));
    const unsubscribe = window.electronAPI?.onWhisperGpuStatusChanged?.(() => {
      void refreshGpu().catch((error: unknown) => setStatus(String(error)));
    });
    const unsubscribeProgress = window.electronAPI?.onCudaDownloadProgress?.((progress) => {
      setDownloadProgress(progress.percentage);
    });
    return () => {
      unsubscribe?.();
      unsubscribeProgress?.();
    };
  }, [refreshGpu]);

  async function installCuda() {
    setBusy(true);
    setStatus("");
    setDownloadProgress(0);
    try {
      const result = await window.electronAPI.downloadCudaWhisperBinary();
      if (!result.success) throw new Error(result.error || t("hinaSettings.actionFailed"));
      await refreshGpu();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      setDownloadProgress(null);
    }
  }

  async function toggleAutoStart(enabled: boolean) {
    try {
      const result = await window.electronAPI.setAutoStartEnabled?.(enabled);
      if (!result?.success) throw new Error(result?.error || t("hinaSettings.actionFailed"));
      setAutoStart(enabled);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  const gpuStatus = server?.gpuAccelerated
    ? t("hinaSettings.gpuActive", { backend: server.gpuBackend?.toUpperCase() })
    : cuda?.gpuFailed
      ? t("hinaSettings.gpuFallback")
      : cuda?.downloaded
        ? t("hinaSettings.gpuReady")
        : t("hinaSettings.cpuReady");

  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <TitleBar className="sticky top-0 z-20" />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-8">
        <header className="space-y-2">
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
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>{gpuStatus}</p>
            {cuda?.gpuInfo.gpuName && <p>{cuda.gpuInfo.gpuName}</p>}
            {cuda?.gpuFailReason && <p>{cuda.gpuFailReason}</p>}
            {downloadProgress !== null && (
              <p role="status">
                {t("hinaSettings.downloading", { progress: Math.round(downloadProgress) })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {cuda?.gpuInfo.hasNvidiaGpu && (!cuda.downloaded || cuda.needsUpdate) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void installCuda()}
                >
                  {t("hinaSettings.installCuda")}
                </Button>
              )}
              {cuda?.gpuFailed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void window.electronAPI
                      .whisperGpuRetry()
                      .then(refreshGpu)
                      .catch((error: unknown) => setStatus(String(error)));
                  }}
                >
                  {t("hinaSettings.retryGpu")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void refreshGpu().catch((error: unknown) => setStatus(String(error)))
                }
              >
                {t("hinaSettings.refresh")}
              </Button>
            </div>
          </div>
        </SettingsCard>

        <HinaConnectorSettings />

        <SettingsCard title={t("hinaSettings.preferences")}>
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
