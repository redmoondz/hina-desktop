import { useSettingsStore } from "../../stores/settingsStore";
import { useMicrophoneTest } from "../../hooks/useMicrophoneTest";
import { Toggle } from "./toggle";
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "./SettingsSection";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Button } from "./button";
import { RefreshCw, Mic } from "../icons";
import { isBuiltInMicrophone } from "../../utils/audioDeviceUtils";
import { resolveSystemDefaultMicDevice } from "../../helpers/microphoneSelection";
import { resolveMicDeviceSelection } from "../../helpers/micDeviceSelection";
import { MIC_WARM_HOLD_CHOICES } from "../../stores/settingsStore";

interface AudioDevice {
  kind: "audioinput";
  deviceId: string;
  label: string;
  isBuiltIn: boolean;
}

interface MicrophoneSettingsProps {
  microphoneSelectionMode: "system" | "built-in" | "specific";
  selectedMicDeviceId: string;
  selectedMicDeviceLabel: string;
  micWarmHoldSeconds: number;
  onSelectionModeChange: (mode: "system" | "built-in" | "specific") => void;
  onDeviceSelect: (deviceId: string, label: string) => void;
  onMicWarmHoldSecondsChange: (seconds: number) => void;
}

export const MicrophoneSettings: React.FC<MicrophoneSettingsProps> = ({
  microphoneSelectionMode,
  selectedMicDeviceId,
  selectedMicDeviceLabel,
  micWarmHoldSeconds,
  onSelectionModeChange,
  onDeviceSelect,
  onMicWarmHoldSecondsChange,
}) => {
  const { t } = useTranslation();
  const autoBoost = useSettingsStore((s) => s.micAutoBoost);
  const gainPercent = useSettingsStore((s) => s.micGainPercent);
  const setAutoBoost = useSettingsStore((s) => s.setMicAutoBoost);
  const setGainPercent = useSettingsStore((s) => s.setMicGainPercent);
  const test = useMicrophoneTest(`${microphoneSelectionMode}:${selectedMicDeviceId}`);
  const levelPercent = Math.round(
    Math.max(0, Math.min(100, ((20 * Math.log10(Math.max(test.level.rms, 0.001)) + 60) / 60) * 100))
  );
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemDefaultLabel, setSystemDefaultLabel] = useState("");

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Acquiring the mic just to read labels interrupts other audio (pauses
      // music on macOS), so only do it when labels are missing (no permission yet).
      let allDevices = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = allDevices.some((d) => d.kind === "audioinput" && d.label);
      if (!hasLabels) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        allDevices = await navigator.mediaDevices.enumerateDevices();
      }

      const audioInputs = allDevices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          kind: "audioinput" as const,
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          isBuiltIn: isBuiltInMicrophone(d.label),
        }));

      setDevices(audioInputs);
      const resolvedSelection = resolveMicDeviceSelection(
        audioInputs,
        selectedMicDeviceId,
        selectedMicDeviceLabel
      );
      if (
        resolvedSelection.device &&
        (resolvedSelection.status === "remapped" || !selectedMicDeviceLabel)
      ) {
        onDeviceSelect(resolvedSelection.device.deviceId, resolvedSelection.device.label);
      }
      const nativeDefault = await window.electronAPI?.getSystemDefaultMicrophone?.();
      const resolvedDefault = resolveSystemDefaultMicDevice(audioInputs, nativeDefault);
      setSystemDefaultLabel(nativeDefault?.name || resolvedDefault.device?.label || "");
    } catch {
      setError(t("microphoneSettings.errors.unableToAccess"));
    } finally {
      setIsLoading(false);
    }
  }, [onDeviceSelect, selectedMicDeviceId, selectedMicDeviceLabel, t]);

  useEffect(() => {
    loadDevices();

    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [loadDevices]);

  const builtInDevice = devices.find((d) => d.isBuiltIn);
  const selectedDevice = devices.find((d) => d.deviceId === selectedMicDeviceId);
  const selectorValue =
    microphoneSelectionMode === "system"
      ? "__system__"
      : microphoneSelectionMode === "built-in"
        ? "__built-in__"
        : selectedMicDeviceId || "__specific__";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">
            {t("microphoneSettings.inputDevice")}
          </label>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadDevices}
            disabled={isLoading}
            className="size-7"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <Select
            value={selectorValue}
            onValueChange={(value) => {
              if (value === "__system__") {
                onSelectionModeChange("system");
                return;
              }
              if (value === "__built-in__") {
                onSelectionModeChange("built-in");
                return;
              }
              const device = devices.find((candidate) => candidate.deviceId === value);
              if (!device) return;
              onDeviceSelect(value, device.label);
              onSelectionModeChange("specific");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("microphoneSettings.selectPlaceholder")}>
                {microphoneSelectionMode === "system"
                  ? `${t("microphoneSettings.systemDefault")}${systemDefaultLabel ? ` — ${systemDefaultLabel}` : ""}`
                  : microphoneSelectionMode === "built-in"
                    ? t("microphoneSettings.preferBuiltIn.label")
                    : selectedDevice?.label || t("microphoneSettings.unknownDevice")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__system__">{t("microphoneSettings.systemDefault")}</SelectItem>
              <SelectItem value="__built-in__">
                {t("microphoneSettings.preferBuiltIn.label")}
              </SelectItem>
              {devices
                .filter((device) => device.deviceId !== "default")
                .map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                    {device.isBuiltIn && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t("microphoneSettings.builtIn")}
                      </span>
                    )}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        <p className="text-xs text-muted-foreground">{t("microphoneSettings.helpText")}</p>
      </div>

      {microphoneSelectionMode === "built-in" && builtInDevice && (
        <div className="p-3 bg-success/10 dark:bg-success/20 border border-success/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-success dark:text-success" />
            <span className="text-sm text-success dark:text-success">
              {t("microphoneSettings.using", { device: builtInDevice.label })}
            </span>
          </div>
        </div>
      )}

      {microphoneSelectionMode === "built-in" && !builtInDevice && devices.length > 0 && (
        <div className="p-3 bg-warning/10 dark:bg-warning/20 border border-warning/30 rounded-lg">
          <p className="text-sm text-warning dark:text-warning">
            {t("microphoneSettings.noBuiltInDetected")}
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-border p-4">
        <SettingsRow
          label={t("microphoneSettings.processing.autoBoost")}
          description={t("microphoneSettings.processing.autoBoostDescription")}
        >
          <Toggle
            checked={autoBoost}
            onChange={setAutoBoost}
            ariaLabel={t("microphoneSettings.processing.autoBoost")}
          />
        </SettingsRow>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="microphone-gain" className="text-sm font-medium">
              {t("microphoneSettings.processing.manualGain")}
            </label>
            <output
              htmlFor="microphone-gain"
              className="text-sm tabular-nums text-muted-foreground"
            >
              {autoBoost ? t("microphoneSettings.processing.automatic") : `${gainPercent}%`}
            </output>
          </div>
          <input
            dir="ltr"
            id="microphone-gain"
            type="range"
            min={0}
            max={400}
            step={5}
            value={gainPercent}
            onChange={(event) => setGainPercent(Number(event.target.value))}
            disabled={autoBoost}
            className="w-full accent-primary disabled:opacity-40"
          />
          <div className="relative h-4 text-xs text-muted-foreground" dir="ltr" aria-hidden="true">
            <span className="absolute left-0">0%</span>
            <span className="absolute left-1/4 -translate-x-1/2">100%</span>
            <span className="absolute right-0">400%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("microphoneSettings.processing.scope")}
          </p>
        </div>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">{t("microphoneSettings.processing.test")}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={test.status === "opening" || test.status === "stopping"}
              onClick={() => (test.status === "recording" ? test.stop() : void test.start())}
            >
              {t(
                `microphoneSettings.processing.${test.status === "recording" ? "stop" : test.status === "opening" ? "opening" : "start"}`
              )}
            </Button>
          </div>
          <div
            role="meter"
            aria-label={t("microphoneSettings.processing.level")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={test.status === "recording" ? levelPercent : 0}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full transition-[width] duration-75 ${test.level.peak >= 0.95 ? "bg-destructive" : test.level.peak >= 0.8 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${test.status === "recording" ? levelPercent : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t(
              `microphoneSettings.processing.${test.status === "recording" ? (test.level.peak >= 0.95 ? "tooLoud" : "recording") : "testHelp"}`
            )}
          </p>
          {test.failed && (
            <p role="alert" className="text-sm text-destructive">
              {t("microphoneSettings.processing.error")}
            </p>
          )}
          {test.playbackUrl && (
            <audio
              className="w-full [color-scheme:light] dark:[color-scheme:dark]"
              controls
              src={test.playbackUrl}
              aria-label={t("microphoneSettings.processing.playback")}
            />
          )}
        </div>
      </div>

      <SettingsRow
        label={t("microphoneSettings.warmHold.label")}
        description={t("microphoneSettings.warmHold.description")}
      >
        <Select
          value={String(micWarmHoldSeconds)}
          onValueChange={(value) => onMicWarmHoldSecondsChange(Number(value))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Derived from the store's whitelist so a new option can't silently
                snap to 0 in the setter; its label key is the value itself. */}
            {MIC_WARM_HOLD_CHOICES.map((seconds) => (
              <SelectItem key={seconds} value={String(seconds)}>
                {t(`microphoneSettings.warmHold.options.${seconds}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      {micWarmHoldSeconds > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("microphoneSettings.warmHold.privacyNote")}
        </p>
      )}
    </div>
  );
};

export default MicrophoneSettings;
