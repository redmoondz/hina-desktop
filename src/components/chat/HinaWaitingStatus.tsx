import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMmSs } from "../../utils/formatDuration";

export function HinaWaitingStatus() {
  const { t } = useTranslation();
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return (
    <div className="space-y-1 text-xs text-muted-foreground" data-hina-waiting>
      <p>
        {t("hinaSettings.waitingForReply")}{" "}
        <span className="font-mono tabular-nums">{formatMmSs(elapsed)}</span>
      </p>
      <p role="status">{t("hinaSettings.longRequestHint")}</p>
    </div>
  );
}
