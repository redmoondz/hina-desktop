import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnalyticsSummary } from "../../types/electron";
import { UsageDashboard } from "../UsageDashboard";
import { Button } from "../ui/button";

export default function HinaDictationStats() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await window.electronAPI.getAnalyticsSummary();
      if (id !== requestId.current) return;
      setSummary(next);
      setError("");
    } catch (cause) {
      if (id === requestId.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const unsubscribe = window.electronAPI?.onAnalyticsChanged?.(() => void refresh());
    const invalidatePendingReads = () => {
      requestId.current += 1;
    };
    return () => {
      invalidatePendingReads();
      unsubscribe?.();
    };
  }, [refresh]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("insights.yourUsage")}</h2>
        <span className="text-xs text-muted-foreground">{t("insights.onDevice")}</span>
      </div>
      {error ? (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{t("insights.loadError")}</p>
          <p className="break-words text-xs">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : (
        <UsageDashboard summary={summary} />
      )}
      <p className="text-xs text-muted-foreground">{t("insights.onDevicePrivacy")}</p>
    </section>
  );
}
