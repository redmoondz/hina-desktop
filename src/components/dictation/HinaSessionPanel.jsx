import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Minus, X, Plus, Clock } from "../icons";
import { ChatInput } from "../chat/ChatInput";
import { MarkdownRenderer } from "../ui/MarkdownRenderer";
import { useWindowDrag } from "../../hooks/useWindowDrag";
import { HinaWaitingStatus } from "../chat/HinaWaitingStatus";

export function HinaSessionPanel({
  sessions: model,
  onMinimize,
  onClose,
  textInputRequest,
  open,
  onTextInputIntent,
}) {
  const { t } = useTranslation();
  const [history, setHistory] = useState(false);
  const { handleMouseDown, handleMouseUp } = useWindowDrag();
  const bottom = useRef(null);
  const current = model.session;
  useEffect(() => {
    const hide = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onMinimize();
      }
    };
    document.addEventListener("keydown", hide);
    return () => document.removeEventListener("keydown", hide);
  }, [onMinimize]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [current?.messages, current?.activity]);
  useEffect(() => {
    setHistory(false);
  }, [model.activeId]);
  return (
    <>
      <header
        className="flex h-14 shrink-0 cursor-grab items-center gap-2 px-4"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {current?.title || t("hinaSessions.title")}
        </span>
        {[
          [
            "history",
            Clock,
            () => {
              setHistory((value) => !value);
              void model.refresh();
            },
          ],
          ["new", Plus, model.close],
          ["minimize", Minus, onMinimize],
          ["close", X, onClose],
        ].map(([label, Icon, action]) => (
          <button
            key={label}
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-foreground/10 focus-visible:outline focus-visible:outline-2"
            aria-label={t(`hinaSessions.${label}`)}
            title={t(`hinaSessions.${label}`)}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={action}
          >
            <Icon size={16} />
          </button>
        ))}
      </header>
      <main
        data-panel-scroll-region
        className="agent-chat-scroll mx-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/40 bg-surface-1 p-4"
        aria-live="polite"
      >
        <div data-panel-size-source className="space-y-4">
          {history ? (
            <>
              <h2 className="text-sm font-medium">{t("hinaSessions.history")}</h2>
              {model.sessions.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("hinaSessions.emptyHistory")}</p>
              )}
              {model.sessions.map((session) => {
                const last = session.messages.at(-1);
                return (
                  <button
                    key={session.id}
                    type="button"
                    className="block w-full rounded-xl border border-border/50 p-3 text-start hover:bg-foreground/5"
                    onClick={() => {
                      model.select(session.id);
                      setHistory(false);
                    }}
                  >
                    <span className="block truncate text-sm">{session.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`hinaSessions.${last?.status || "completed"}`)}
                    </span>
                  </button>
                );
              })}
            </>
          ) : (
            <>
              {!current?.messages.length && (
                <p className="text-sm text-muted-foreground">{t("hinaSessions.empty")}</p>
              )}
              {current?.messages.map((turn) => (
                <article key={turn.id} className="space-y-3">
                  <p className="ms-6 whitespace-pre-wrap break-words rounded-xl bg-foreground/5 p-3 text-sm">
                    {turn.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`hinaSessions.${turn.status}`)}
                  </p>
                  {turn.reply && (
                    <MarkdownRenderer content={turn.reply} className="break-words text-sm" />
                  )}
                  {(turn.status === "unknown" || turn.status === "failed") && (
                    <p className="text-xs text-muted-foreground">
                      {t("hinaSessions.checkBeforeRetry")}
                    </p>
                  )}
                </article>
              ))}
              {model.busy && (
                <>
                  {current?.activity?.map((activity, index) => (
                    <div
                      key={`${index}:${activity}`}
                      className="border-s-2 border-border ps-3 text-sm"
                    >
                      <MarkdownRenderer content={activity} />
                    </div>
                  ))}
                  <HinaWaitingStatus />
                  {!current?.progressAvailable && (
                    <p className="text-xs text-muted-foreground">
                      {t("hinaSessions.progressUnavailable")}
                    </p>
                  )}
                </>
              )}
              <div ref={bottom} />
            </>
          )}
          {model.error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {model.error}
            </p>
          )}
        </div>
      </main>
      {!history && (
        <div onPointerDownCapture={onTextInputIntent}>
          <ChatInput
            key={`${model.activeId}:${textInputRequest}`}
            agentState="idle"
            partialTranscript=""
            onTextSubmit={(text) => void model.send(text)}
            autoFocus={open}
            className="px-3 py-3"
          />
        </div>
      )}
      <footer className="shrink-0 px-4 py-2 text-xs text-muted-foreground">
        {t("hinaSessions.backgroundHint")}
      </footer>
    </>
  );
}
