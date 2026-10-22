import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SectionHeader } from "../ui/SettingsSection";

export default function HinaConnectorSettings() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [url, setUrl] = useState(settings.dictationAgentRemoteUrl || "http://127.0.0.1:3210");
  const [token, setToken] = useState("");
  const [transport, setTransport] = useState<"local" | "wsl">(
    localStorage.getItem("hinaConnectorTransport") === "wsl" ? "wsl" : "local"
  );
  const [enabled, setEnabled] = useState(localStorage.getItem("hinaConnectorEnabled") === "true");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    setStatus(t("hinaSettings.connectorChecking"));
    try {
      const key = token || (await window.electronAPI.getDictationAgentCustomKey?.()) || "";
      const result = await window.electronAPI.hinaConnectorRequest({
        url,
        token: key,
        check: true,
        transport,
      });
      if (!result.ok) throw new Error(result.error);
      await window.electronAPI.saveDictationAgentCustomKey?.(key);
      settings.setDictationAgentCustomApiKey(key);
      settings.setDictationAgentRemoteUrl(url);
      settings.setDictationAgentModel("hina");
      settings.setDictationAgentMode("self-hosted");
      settings.setUseDictationAgent(true);
      localStorage.setItem("hinaConnectorEnabled", "true");
      localStorage.setItem("hinaConnectorTransport", transport);
      setEnabled(true);
      setToken("");
      setStatus(t("hinaSettings.connectorConnected"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("hinaSettings.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <SectionHeader
        title={t("hinaSettings.connectorTitle")}
        description={t("hinaSettings.connectorDescription")}
      />
      <label className="block text-xs space-y-1">
        <span>{t("hinaSettings.connectorLocation")}</span>
        <select
          className="w-full rounded border border-border bg-background p-2"
          value={transport}
          onChange={(event) => setTransport(event.target.value as "local" | "wsl")}
        >
          <option value="local">{t("hinaSettings.localMachine")}</option>
          <option value="wsl">{t("hinaSettings.wsl")}</option>
        </select>
      </label>
      <label className="block text-xs space-y-1">
        <span>{t("hinaSettings.connectorUrl")}</span>
        <Input
          dir="ltr"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="http://127.0.0.1:3210"
        />
      </label>
      <label className="block text-xs space-y-1">
        <span>{t(enabled ? "hinaSettings.tokenSaved" : "hinaSettings.token")}</span>
        <Input
          dir="ltr"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void connect()}>
          {t("hinaSettings.connect")}
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {status ||
          t(enabled ? "hinaSettings.connectorEnabled" : "hinaSettings.connectorUnconfigured")}
      </p>
    </div>
  );
}
