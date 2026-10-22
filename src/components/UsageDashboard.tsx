import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BarChart3, Flame, Gauge, Mic2 } from "./icons";
import { buildAnalyticsActivityDays } from "../helpers/analytics";
import type { AnalyticsDailyBucket, AnalyticsSummary } from "../types/electron";
import { cn } from "./lib/utils";
import { Skeleton } from "./ui/skeleton";
import { Tooltip } from "./ui/tooltip";

type ActivityDay = { date: string; words: number };

const ACTIVITY_INTENSITY_CLASSES = [
  "bg-foreground/6 dark:bg-white/6",
  "bg-primary/25",
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",
] as const;

function dateFromLocalKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function Heatmap({ daily }: { daily: AnalyticsDailyBucket[] | null }) {
  const { t, i18n } = useTranslation();
  const calendar = useMemo(() => {
    const days: ActivityDay[] = buildAnalyticsActivityDays(daily ?? []);
    const cells: Array<ActivityDay | null> = [
      ...Array(dateFromLocalKey(days[0].date).getDay()).fill(null),
      ...days,
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
      cells.slice(index * 7, index * 7 + 7)
    );
    const monthFormatter = new Intl.DateTimeFormat(i18n.language, { month: "short" });
    let previousMonth = "";
    const monthLabels = weeks.map((week, index) => {
      const labelDay =
        week.find((day) => day?.date.endsWith("-01")) ||
        (index === 0 ? week.find((day) => day !== null) : null);
      if (!labelDay) return null;
      const month = labelDay.date.slice(0, 7);
      if (month === previousMonth) return null;
      previousMonth = month;
      return monthFormatter.format(dateFromLocalKey(labelDay.date));
    });

    return {
      maxWords: Math.max(1, ...days.map((day) => day.words)),
      monthLabels,
      todayDate: days[days.length - 1].date,
      weeks,
    };
  }, [daily, i18n.language]);

  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(
          new Date(2024, 0, 7 + index, 12)
        )
      ),
    [i18n.language]
  );
  // Fixed tracks, sized to the 1.5rem cells they hold. minmax(0, 1fr) let every
  // week column collapse toward zero while the cells stayed 24px wide, so the
  // squares overflowed their tracks and overlapped each other; the grid also
  // contributed no intrinsic width, leaving overflow-x nothing to scroll, so
  // the newest weeks — today's cell among them — were painted outside the
  // scrollable area on any window narrower than about 1050px.
  const columnStyle = { gridTemplateColumns: `repeat(${calendar.weeks.length}, 1.5rem)` };

  return (
    // Focusable, so the chart can be scrolled without a mouse. role="img" used
    // to sit on the container, which made every descendant presentational and
    // silently discarded the per-day labels below it; the cells carry it now
    // and the group only names the chart.
    <div
      className="overflow-x-auto rounded-sm pb-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      tabIndex={0}
      role="group"
      aria-label={t("insights.activityLabel")}
    >
      <div className="w-max">
        <div className="grid grid-cols-[auto_max-content] gap-x-3">
          <div aria-hidden="true" />
          <div className="grid h-4 gap-2" style={columnStyle} aria-hidden="true">
            {calendar.monthLabels.map((label, index) => (
              <span
                key={index}
                className="truncate text-[10px] font-medium text-muted-foreground/70"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-rows-7 gap-0.5" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label} className="flex items-center text-[10px] text-muted-foreground/70">
                {label}
              </span>
            ))}
          </div>

          {/* Until the summary arrives every day reads as empty, so the cells pulse and
              stay inert: no "0 words" tooltip or label for a day that isn't counted yet. */}
          <div
            className={cn("grid gap-2", !daily && "animate-pulse")}
            style={columnStyle}
            inert={!daily}
          >
            {calendar.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-rows-7 gap-0.5">
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <div
                        key={dayIndex}
                        aria-hidden="true"
                        className="size-6 justify-self-center"
                      />
                    );
                  }
                  const intensity =
                    day.words === 0
                      ? 0
                      : Math.max(1, Math.ceil((day.words / calendar.maxWords) * 4));
                  const tooltip = t("insights.dayTooltip", {
                    date: day.date,
                    count: day.words,
                  });
                  return (
                    <div key={day.date} className="justify-self-center">
                      <Tooltip content={tooltip}>
                        <div
                          role="img"
                          aria-label={tooltip}
                          className={cn(
                            "size-6 rounded-sm",
                            ACTIVITY_INTENSITY_CLASSES[intensity],
                            day.date === calendar.todayDate &&
                              "ring-1 ring-primary ring-offset-1 ring-offset-card"
                          )}
                        />
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t("insights.activityLess")}</span>
            <div className="flex items-center gap-1" aria-hidden="true">
              {ACTIVITY_INTENSITY_CLASSES.slice(1).map((className) => (
                <span key={className} className={cn("size-3 rounded-sm", className)} />
              ))}
            </div>
            <span>{t("insights.activityMore")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  largeValue = false,
}: {
  icon: typeof BarChart3;
  label: string;
  // Null until the summary loads; the line holds a skeleton meanwhile.
  value: string | null;
  detail: string | null;
  largeValue?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 dark:border-white/10 bg-card/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={cn(
          "mt-3 font-semibold tracking-tight text-foreground",
          largeValue ? "text-3xl" : "text-2xl"
        )}
      >
        {value ?? (
          <Skeleton className={cn("inline-block w-20 align-middle", largeValue ? "h-7" : "h-6")} />
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/70">
        {detail ?? <Skeleton className="inline-block h-2.5 w-24 align-middle" />}
      </p>
    </div>
  );
}

// The dashboard a user gets once they've dictated: the metric cards over the activity
// heatmap. Null while the summary loads; every value holds a skeleton meanwhile.
export function UsageDashboard({ summary }: { summary: AnalyticsSummary | null }) {
  const { t, i18n } = useTranslation();
  // i18n.language, not the runtime default: the OS locale is not the language
  // the app is being read in, so a Japanese UI rendered 12.3K where 1.2万
  // belongs, next to correctly localized month labels in the same card.
  const number = useMemo(
    () => new Intl.NumberFormat(i18n.language, { notation: "compact", maximumFractionDigits: 1 }),
    [i18n.language]
  );

  return (
    <>
      {!summary && (
        <p role="status" className="sr-only">
          {t("controlPanel.loading")}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={Mic2}
          label={t("insights.wordsSpoken")}
          value={summary && number.format(summary.totalWords)}
          detail={t("insights.allTime")}
          largeValue
        />
        <MetricCard
          icon={Gauge}
          label={t("insights.wordsPerMinute")}
          value={summary && (summary.averageWpm == null ? "—" : number.format(summary.averageWpm))}
          detail={summary && t("insights.wpmCoverage", { count: summary.wpmCoveragePercent })}
          largeValue
        />
        <MetricCard
          icon={BarChart3}
          label={t("insights.dictations")}
          value={summary && number.format(summary.totalDictations)}
          detail={t("insights.allTime")}
          largeValue
        />
        <MetricCard
          icon={Flame}
          label={t("insights.currentStreak")}
          value={summary && t("insights.days", { count: summary.currentStreakDays })}
          detail={summary && t("insights.longestStreak", { count: summary.longestStreakDays })}
        />
      </div>

      <div className="mt-5 rounded-2xl border border-border/70 bg-card/70 px-5 py-2.5 dark:border-white/10">
        <h2 className="text-base font-medium text-foreground">{t("insights.activity")}</h2>
        <div className="mt-2">
          <Heatmap daily={summary?.daily ?? null} />
        </div>
      </div>
    </>
  );
}
