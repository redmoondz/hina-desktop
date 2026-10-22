import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Cloud, CloudUpload, Trophy } from "./icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useHotkey } from "../hooks/useHotkey";
import { useInsightsSyncOptIn } from "../hooks/useInsightsSyncOptIn";
import { useSettings } from "../hooks/useSettings";
import { hasValidatedAuthContext } from "../lib/authRequestContext";
import {
  getAccountAnalyticsSummary,
  subscribeToAnalyticsRefresh,
} from "../services/AnalyticsService";
import { syncService } from "../services/SyncService";
import { buildAnalyticsActivityDays } from "../helpers/analytics";
import { canOfferAnalyticsClaim } from "../services/syncPassPolicy";
import { effectiveLocalHistoryEnabled } from "../stores/policyRules";
import { useLeaderboardParticipationStore } from "../stores/leaderboardParticipationStore";
import { usePolicyStore } from "../stores/policyStore";
import type { AnalyticsSummary } from "../types/electron";
import { cn } from "./lib/utils";
import LeaderboardSkeleton from "./LeaderboardSkeleton";
import { Button } from "./ui/button";
import DictationHotkeyHint from "./ui/DictationHotkeyHint";
import EmptyStateCard from "./ui/EmptyStateCard";
import { PAGE_CONTENT_WIDTH_CLASS } from "./ui/pageWidth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { UsageDashboard } from "./UsageDashboard";

interface InsightsViewProps {
  onSignIn: () => void;
}

const LeaderboardView = lazy(() => import("./LeaderboardView"));

function dateFromLocalKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

// 0 ≤ n < 1, stable per index, so the preview's heatmap is the same on every visit.
function unitHash(index: number) {
  let x = Math.imul(index ^ (index >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
}

// Sample usage for the locked preview: a few months of dictation that is busier on
// weekdays and picks up over time, so the heatmap reads like a real one.
function buildPreviewSummary(): AnalyticsSummary {
  const days = buildAnalyticsActivityDays([]);
  const daily = days.map(({ date }, index) => {
    const progress = index / (days.length - 1);
    const weekday = dateFromLocalKey(date).getDay();
    const chance = weekday === 0 || weekday === 6 ? 0.15 : 0.3 + progress * 0.55;
    const words =
      unitHash(index) < chance
        ? Math.round((0.3 + unitHash(index + days.length) * 0.7) * (400 + progress * 1600))
        : 0;
    return { date, words, dictations: 0, spokenDurationMs: 0 };
  });
  return {
    totalWords: daily.reduce((sum, day) => sum + day.words, 0),
    totalDictations: 1260,
    totalSpokenDurationMs: 0,
    averageWpm: 142,
    currentStreakDays: 12,
    longestStreakDays: 21,
    wpmCoveragePercent: 96,
    daily,
  };
}

// Before the first dictation: the dashboard as it will look, filled with sample
// usage and locked behind a card that says how to start.
function UsagePreview() {
  const { t } = useTranslation();
  const { hotkey } = useHotkey();
  const summary = useMemo(buildPreviewSummary, []);

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none select-none opacity-50 blur-[1px] [mask-image:linear-gradient(to_bottom,#000_45%,transparent)]"
      >
        <UsageDashboard summary={summary} />
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <EmptyStateCard
          icon={BarChart3}
          title={t("insights.emptyTitle")}
          description={t("insights.emptyBody")}
          headingLevel={2}
          className="w-full max-w-sm bg-background/95 shadow-xl dark:bg-surface-1/95"
        >
          <DictationHotkeyHint hotkey={hotkey} className="text-[13px]" />
        </EmptyStateCard>
      </div>
    </div>
  );
}

function YourUsage({
  accountId,
  dataRetentionEnabled,
  isLoaded,
  onSyncErrorChange,
  syncActive,
}: {
  accountId: string | null;
  dataRetentionEnabled: boolean;
  isLoaded: boolean;
  onSyncErrorChange: (error: boolean) => void;
  syncActive: boolean;
}) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Every dictation broadcasts analytics-changed, so loads overlap; only the
  // newest one may write state, or a slow reply overwrites a fresher summary.
  // A superseded load also bails before syncing, so two passes cannot share a
  // batch and leave the winner reading a summary the other has not finished.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setSyncError(false);

    // The device read stands on its own. Folding it into the same catch as the
    // cloud fetch meant a failed local read fell through to a summary of
    // zeros — under a confident "On this device", with no error anywhere — and
    // told the user their history was empty.
    let local: AnalyticsSummary;
    try {
      local = await window.electronAPI.getAnalyticsSummary();
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Reading local Insights failed:", error);
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    if (requestId !== requestIdRef.current) return;
    setLoadFailed(false);

    try {
      if (isLoaded && syncActive) {
        if (!(await syncService.syncAnalyticsNow())) {
          throw new Error("Insights uploads are not enabled for this account");
        }
        const account = await getAccountAnalyticsSummary(accountId);
        if (requestId !== requestIdRef.current) return;
        setSummary(account);
      } else {
        setSummary(local);
      }
    } catch {
      if (requestId !== requestIdRef.current) return;
      // Real device data, and the pill says the cloud is the part that failed.
      setSummary(local);
      setSyncError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [accountId, isLoaded, syncActive]);

  useEffect(() => subscribeToAnalyticsRefresh(load, syncActive), [load, syncActive]);

  useEffect(() => {
    onSyncErrorChange(syncError);
  }, [onSyncErrorChange, syncError]);

  if (loadFailed) {
    return (
      <div className="rounded-lg border border-border bg-card/50 backdrop-blur-sm dark:bg-card/60">
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{t("insights.loadError")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {!dataRetentionEnabled && (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-3.5 py-2.5 flex items-center gap-2.5">
          <span className="text-amber-600 dark:text-amber-400 shrink-0 text-sm">⊘</span>
          <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed">
            {t("insights.dataRetentionDisabled")}
          </p>
        </div>
      )}

      {summary?.totalDictations === 0 ? <UsagePreview /> : <UsageDashboard summary={summary} />}
    </>
  );
}

export default function InsightsView({ onSignIn }: InsightsViewProps) {
  const { t } = useTranslation();
  const { isLoaded, isSignedIn, user } = useAuth();
  const authValidated = hasValidatedAuthContext();
  const { dataRetentionEnabled: personalDataRetentionEnabled, insightsSyncEnabled } = useSettings();
  const dataRetentionEnabled = usePolicyStore((policyState) =>
    effectiveLocalHistoryEnabled(policyState, personalDataRetentionEnabled)
  );
  const { canToggleSync, enableInsightsSync, optInDialog, syncAllowedByPolicy, unclaimedCount } =
    useInsightsSyncOptIn();
  const participationEnabled = useLeaderboardParticipationStore((state) => state.enabled);
  const participationError = useLeaderboardParticipationStore((state) => state.error);
  const participationReady = useLeaderboardParticipationStore((state) => state.ready);
  const participationLeavePending = useLeaderboardParticipationStore((state) => state.leavePending);
  const [activeTab, setActiveTab] = useState("usage");
  const [syncError, setSyncError] = useState(false);
  // A managed workspace that forbids cloud backup forbids these counters with
  // it, so the page stays device-scoped even with the preference left on.
  const syncActive =
    isSignedIn &&
    authValidated &&
    insightsSyncEnabled &&
    syncAllowedByPolicy &&
    dataRetentionEnabled;
  const claimAvailable = canOfferAnalyticsClaim({
    signedIn: isSignedIn,
    syncAllowedByPolicy,
    dataRetentionEnabled,
    insightsSyncEnabled,
    unclaimedCount,
  });
  const showSyncAction =
    activeTab === "usage" && isSignedIn && authValidated && (!syncActive || claimAvailable);
  const syncActionDisabled = !canToggleSync || !dataRetentionEnabled || !syncAllowedByPolicy;
  const syncStatusLabel = syncActive
    ? syncError
      ? t("insights.syncFallback")
      : t("insights.synced")
    : t("insights.onDevice");

  return (
    <div className={cn(PAGE_CONTENT_WIDTH_CLASS, "flex min-h-full flex-col px-6 py-6")}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-4">
          <TabsList variant="pill">
            <TabsTrigger value="usage" variant="pill">
              {t("insights.yourUsage")}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" variant="pill">
              {t("insights.leaderboard.title")}
            </TabsTrigger>
          </TabsList>

          {activeTab === "usage" ? (
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Cloud size={13} />
                {syncStatusLabel}
              </div>
              {showSyncAction && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-7 rounded-[7px] px-2.5 text-[11px]"
                  disabled={syncActionDisabled}
                  onClick={() => void enableInsightsSync()}
                >
                  <CloudUpload size={13} />
                  {t(syncActive ? "insights.claimInclude" : "insights.enableSync")}
                </Button>
              )}
            </div>
          ) : (
            isSignedIn &&
            participationReady &&
            participationError === null &&
            !participationEnabled && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Trophy size={13} />
                {t(
                  participationLeavePending
                    ? "insights.leaderboard.leavePending"
                    : "insights.leaderboard.disabled"
                )}
              </div>
            )
          )}
        </div>

        <TabsContent value="usage" className="mt-6 flex flex-1 flex-col">
          <YourUsage
            accountId={user?.id ?? null}
            dataRetentionEnabled={dataRetentionEnabled}
            isLoaded={isLoaded}
            onSyncErrorChange={setSyncError}
            syncActive={syncActive}
          />
          {isLoaded && !syncActive && (
            <p className="mt-auto pt-8 text-center text-[11px] text-muted-foreground/70">
              {t("insights.onDevicePrivacy")}
            </p>
          )}
        </TabsContent>
        <TabsContent value="leaderboard" className="mt-0">
          <Suspense fallback={isSignedIn ? <LeaderboardSkeleton /> : null}>
            <LeaderboardView
              enableInsightsSync={enableInsightsSync}
              insightsSyncEnabled={insightsSyncEnabled}
              onSignIn={onSignIn}
              syncAllowedByPolicy={syncAllowedByPolicy}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
      {optInDialog}
    </div>
  );
}
