import { useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SectionHeader } from "../ui/SettingsSection";

export default function HinaConnectorSettings() {
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
    setStatus("Checking Hina Connector...");
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
      setStatus("Connected. Voice Assistant now uses the existing Hina agent.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <SectionHeader
        title="Hina Connector"
        description="Connect Voice Assistant to your existing OpenClaw Hina agent. Speech recognition keeps its own settings."
      />
      <label className="block text-xs space-y-1">
        <span>Connector location</span>
        <select
          className="w-full rounded border border-border bg-background p-2"
          value={transport}
          onChange={(event) => setTransport(event.target.value as "local" | "wsl")}
        >
          <option value="local">Windows / local machine</option>
          <option value="wsl">WSL default distribution (Windows)</option>
        </select>
      </label>
      <label className="block text-xs space-y-1">
        <span>Connector URL</span>
        <Input
          dir="ltr"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="http://127.0.0.1:3210"
        />
      </label>
      <label className="block text-xs space-y-1">
        <span>Bearer token {enabled ? "(leave empty to keep saved token)" : ""}</span>
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
          Test and connect Hina
        </Button>
        {enabled && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              localStorage.removeItem("hinaConnectorEnabled");
              setEnabled(false);
              setStatus(
                "Hina integration disabled. Choose a provider below to use another assistant."
              );
            }}
          >
            Disable Hina integration
          </Button>
        )}
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {status || (enabled ? "Hina integration enabled" : "Hina integration not configured")}
      </p>
    </div>
  );
}
