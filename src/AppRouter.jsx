import React, { Suspense, useEffect } from "react";
import App from "./App.jsx";
import AgentDictationPillOverlay from "./components/dictation/AgentDictationPillOverlay.tsx";
import { useControlPanelWindowDrag } from "./hooks/useControlPanelWindowDrag";
import { useTheme } from "./hooks/useTheme";
import { usePolicyStore } from "./stores/policyStore";
import { initializeLocalRenderer } from "./helpers/hinaRendererStartup";
import { isControlPanelWindow } from "./utils/windowContext.ts";

const HinaSettings = React.lazy(() => import("./components/HinaSettings.tsx"));

export default function AppRouter() {
  useTheme();
  const isControlPanel = isControlPanelWindow();
  useControlPanelWindowDrag(isControlPanel);

  useEffect(() => {
    usePolicyStore.setState({ status: "unmanaged", managed: false, policy: null });
    void initializeLocalRenderer({
      storage: localStorage,
      api: window.electronAPI,
      isControlPanel,
    });
  }, [isControlPanel]);

  if (new URLSearchParams(window.location.search).get("agent-dictation-pill") === "true") {
    return <AgentDictationPillOverlay />;
  }

  return isControlPanel ? (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HinaSettings />
    </Suspense>
  ) : (
    <App />
  );
}
