import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SectionHeader } from "../ui/SettingsSection";
import {
  checkConnection,
  enableConnection,
  saveConnection,
  controlPanelUrl,
} from "../../helpers/hinaPortableSettings";

export default function HinaConnectorSettings() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [url, setUrl] = useState(settings.dictationAgentRemoteUrl || "http://127.0.0.1:3210");
  const [token, setToken] = useState("");
  const [transport, setTransport] = useState<"local" | "wsl">(
    localStorage.getItem("hinaConnectorTransport") === "wsl" ? "wsl" : "local"
  );
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    localStorage.getItem("hinaConnectorTimeoutSeconds") || "300"
  );
  const [controlUrl, setControlUrl] = useState(
    localStorage.getItem("hinaControlUrl") || "http://127.0.0.1:18789/"
  );

  useEffect(() => {
    let active = true;
    let checking = false;
    const verify = async () => {
      if (checking) return;
      checking = true;
      const store = useSettingsStore.getState();
      try {
        const key = await window.electronAPI.getDictationAgentCustomKey?.();
        if (!key) {
          if (active) {
            setEnabled(false);
            setStatus(t("hinaSettings.connectorUnconfigured"));
          }
          return;
        }
        await checkConnection(
          {
            url: store.dictationAgentRemoteUrl || "http://127.0.0.1:3210",
            token: key,
            transport: localStorage.getItem("hinaConnectorTransport") || "local",
          },
          window.electronAPI
        );
        if (active) {
          enableConnection(
            {
              url: store.dictationAgentRemoteUrl || "http://127.0.0.1:3210",
              transport: localStorage.getItem("hinaConnectorTransport") || "local",
            },
            store,
            localStorage
          );
          setEnabled(true);
          setStatus(t("hinaSettings.connectorConnected"));
        }
      } catch (error) {
        if (active) {
          setEnabled(false);
          setStatus(error instanceof Error ? error.message : t("hinaSettings.actionFailed"));
        }
      } finally {
        checking = false;
      }
    };
    const refresh = () => {
      setTimeoutSeconds(localStorage.getItem("hinaConnectorTimeoutSeconds") || "300");
      setUrl(useSettingsStore.getState().dictationAgentRemoteUrl || "http://127.0.0.1:3210");
      setTransport(localStorage.getItem("hinaConnectorTransport") === "wsl" ? "wsl" : "local");
      setControlUrl(localStorage.getItem("hinaControlUrl") || "http://127.0.0.1:18789/");
      setEnabled(localStorage.getItem("hinaConnectorEnabled") === "true");
      setStatus("");
      void verify();
    };
    void verify();
    const timer = window.setInterval(() => void verify(), 30000);
    window.addEventListener("hina-preferences-imported", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("hina-preferences-imported", refresh);
    };
  }, [t]);

  async function openControl() {
    try {
      const address = controlPanelUrl(controlUrl.trim());
      localStorage.setItem("hinaControlUrl", address);
      const result = await window.electronAPI.openExternal(address);
      if (!result.success) throw new Error(result.error || "Could not open OpenClaw Control.");
      setStatus("Opened OpenClaw Control in your browser.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  async function connect() {
    setBusy(true);
    setStatus(t("hinaSettings.connectorChecking"));
    try {
      const key = await checkConnection({ url, token, transport }, window.electronAPI);
      await saveConnection(
        { url, token: key, transport },
        settings,
        localStorage,
        window.electronAPI
      );
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
      <p className="text-xs text-muted-foreground">
        Connector and OpenClaw Control use different addresses and tokens. On Windows, select WSL if
        the Connector runs there. Connecting checks service identity and authentication without
        sending an agent command.
      </p>
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
      <label className="block space-y-1 text-xs">
        <span>{t("hinaSettings.timeoutLabel")}</span>
        <Input
          dir="ltr"
          aria-label={t("hinaSettings.timeoutLabel")}
          type="number"
          min={1}
          max={3600}
          step={1}
          value={timeoutSeconds}
          onChange={(event) => {
            const value = event.target.value;
            setTimeoutSeconds(value);
            const seconds = Number(value);
            if (Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600)
              localStorage.setItem("hinaConnectorTimeoutSeconds", value);
          }}
          onBlur={() => {
            const seconds = Number(timeoutSeconds);
            if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
              setTimeoutSeconds(localStorage.getItem("hinaConnectorTimeoutSeconds") || "300");
              setStatus(t("hinaSettings.timeoutInvalid"));
            }
          }}
        />
        <span className="block text-muted-foreground">{t("hinaSettings.timeoutHint")}</span>
      </label>
      <p role="status" className="text-xs text-muted-foreground">
        {status ||
          t(enabled ? "hinaSettings.connectorEnabled" : "hinaSettings.connectorUnconfigured")}
      </p>
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-medium">OpenClaw Control</h3>
        <label className="block space-y-1 text-xs">
          <span>Dashboard address</span>
          <Input
            dir="ltr"
            aria-label="OpenClaw Control address"
            value={controlUrl}
            onChange={(event) => setControlUrl(event.target.value)}
            onBlur={() => {
              try {
                localStorage.setItem("hinaControlUrl", controlPanelUrl(controlUrl.trim()));
              } catch {
                setStatus("Use an HTTP or HTTPS dashboard address without tokens.");
              }
            }}
            placeholder="http://127.0.0.1:18789/"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Opens your existing gateway dashboard in the browser. Authenticate there separately. This
          address must be reachable from Windows; WSL Connector transport does not proxy the
          dashboard.
        </p>
        <Button variant="outline" size="sm" onClick={() => void openControl()}>
          Open OpenClaw Control
        </Button>
      </div>
    </div>
  );
}
