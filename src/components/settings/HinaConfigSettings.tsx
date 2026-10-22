import { useState, type ChangeEvent } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { applySettings, exportSettings, parseSettings } from "../../helpers/hinaPortableSettings";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";

export default function HinaConfigSettings() {
  const { t } = useTranslation();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function download() {
    try {
      const file = exportSettings(
        useSettingsStore.getState(),
        {
          url: useSettingsStore.getState().dictationAgentRemoteUrl || "http://127.0.0.1:3210",
          transport: localStorage.getItem("hinaConnectorTransport") || "local",
          timeoutSeconds: Number(localStorage.getItem("hinaConnectorTimeoutSeconds") || 300),
          controlUrl: localStorage.getItem("hinaControlUrl") || "http://127.0.0.1:18789/",
        },
        {
          enabled: localStorage.getItem("hinaSpeechEnabled") !== "false",
          language: localStorage.getItem("hinaSpeechLanguage") || "ru-RU",
          voice: localStorage.getItem("hinaSpeechVoice") || "",
        }
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "hina-settings.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Settings exported without tokens or passwords.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 65536) throw new Error("Settings file exceeds 64 KB.");
      const config = parseSettings(await file.text());
      const result = await applySettings(
        config,
        useSettingsStore.getState(),
        localStorage,
        window.electronAPI
      );
      window.dispatchEvent(new Event("hina-preferences-imported"));
      setStatus(t(result.connected ? "hinaSettings.importConnected" : "hinaSettings.importSaved"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Portable settings</h2>
      <p className="text-xs text-muted-foreground">{t("hinaSettings.jsonDescription")}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled={busy} onClick={download}>
          Export JSON
        </Button>
        <label className="space-y-1 text-xs">
          <span className="block">Import JSON</span>
          <input
            aria-label="Import JSON settings"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(event) => void upload(event)}
            className="block w-full max-w-64 text-xs"
          />
        </label>
      </div>
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </section>
  );
}
