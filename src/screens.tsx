import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

export function TopBar({
  left,
  center,
  right,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[3.5rem_1fr_3.5rem] items-center">
      <div className="flex justify-start">{left}</div>
      <div className="truncate text-center font-semibold">{center}</div>
      <div className="flex justify-end">{right}</div>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick();
      }}
      className="grid size-11 place-items-center rounded-full hover:bg-neutral-500/15 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const icon = {
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
export const BackIcon = () => (
  <svg {...icon} viewBox="0 0 24 24">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
export const UndoIcon = () => (
  <svg {...icon} viewBox="0 0 24 24">
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
export const SpeakerIcon = ({ className }: { className?: string }) => (
  <svg {...icon} viewBox="0 0 24 24" className={className}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);
const ChevronIcon = () => (
  <svg {...icon} viewBox="0 0 24 24" className="opacity-40">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/**
 * How far ahead `at` is from `now`, rounded to the largest fitting unit: "in 1 minute",
 * "in 3 hours", "in 2 days", "in 6 weeks".
 */
function inTime(at: number, now: number): string {
  const ms = at - now;
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return relative.format(Math.max(1, minutes), "minute");
  const hours = Math.round(ms / HOUR);
  if (hours < 24) return relative.format(hours, "hour");
  const days = Math.round(ms / DAY);
  if (days < 14) return relative.format(days, "day");
  return relative.format(Math.round(days / 7), "week");
}

/**
 * The stack's status: how many studied cards are due now (or, when none are, when the next one is
 * due) and how many cards are unstudied. Parts that don't apply are left out.
 */
export function stackStatus(dueTimes: number[], unstudied: number, now: number): string {
  const due = dueTimes.filter((t) => t <= now).length;
  const next = Math.min(...dueTimes.filter((t) => t > now));
  const parts: string[] = [];
  if (due > 0) parts.push(`${due} ${due === 1 ? "card" : "cards"} due now`);
  else if (Number.isFinite(next)) parts.push(`Next due ${inTime(next, now)}`);
  if (unstudied > 0) parts.push(`${unstudied} unstudied`);
  return parts.join(" · ") || "No cards";
}

/**
 * A card's status on its details screen: "Not studied yet", "Level 3 · due now" or
 * "Level 3 · due in 5 hours". `review` is undefined for a card not yet studied.
 */
export function cardStatus(review: { level: number; due: number } | undefined, now: number) {
  if (!review) return "Not studied yet";
  const when = review.due <= now ? "due now" : `due ${inTime(review.due, now)}`;
  return `Level ${review.level} · ${when}`;
}

/** The current time, updated every 30 seconds and whenever the page comes back into view. */
export function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return now;
}

/** `dueTimes` has the due time of each studied card, in ms since the epoch. */
export function Splash({
  title,
  dueTimes,
  unstudied,
  onOpen,
  onExport,
}: {
  title: string;
  dueTimes: number[];
  unstudied: number;
  onOpen: () => void;
  onExport: () => void;
}) {
  const now = useNow();
  return (
    <div className="flex h-full flex-col">
      <h1 className="px-5 pt-10 pb-6 text-3xl font-bold">Arabic Flashcards</h1>
      <ul className="border-y border-neutral-500/25">
        <li>
          <button
            onClick={onOpen}
            className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-neutral-500/10"
          >
            <span className="flex-1">
              <span className="block text-lg font-medium">{title}</span>
              <span className="block text-sm opacity-60">
                {stackStatus(dueTimes, unstudied, now)}
              </span>
            </span>
            <ChevronIcon />
          </button>
        </li>
      </ul>
      <div className="mt-auto flex justify-center pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={onExport}
          className="rounded-lg border border-neutral-500/40 px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
        >
          Export results
        </button>
      </div>
    </div>
  );
}

/** The level column: a smaller, dimmed "new" for unstudied cards, red below 0, green above. */
function Level({ level }: { level: number | null }) {
  const color =
    level === null
      ? "text-sm opacity-50"
      : level < 0
        ? "text-red-600 dark:text-red-400"
        : level > 0
          ? "text-green-700 dark:text-green-400"
          : "";
  return (
    <span className={`w-10 shrink-0 text-center tabular-nums ${color}`}>{level ?? "new"}</span>
  );
}

/**
 * `rows` are in list order; `level` is null for a card not yet studied. The card list opens
 * scrolled to `initialScroll` and reports its scroll position through `onScroll`, so it can come
 * back to the same place after a card's details.
 */
export function StackScreen({
  title,
  rows,
  initialScroll,
  onScroll,
  onBack,
  onGo,
  onOpenCard,
}: {
  title: string;
  rows: { id: number; plain: string; level: number | null }[];
  initialScroll: number;
  onScroll: (top: number) => void;
  onBack: () => void;
  onGo: () => void;
  onOpenCard: (id: number) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  // Only on mount: after that, the scroll position is the user's.
  useLayoutEffect(() => {
    list.current!.scrollTop = initialScroll;
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        left={
          <IconButton label="Back" onClick={onBack}>
            <BackIcon />
          </IconButton>
        }
        center={title}
      />
      <div className="px-5 pt-4 pb-6">
        <button
          onClick={onGo}
          className="w-full rounded-2xl bg-black py-6 text-4xl font-bold text-white active:scale-[0.98] dark:bg-white dark:text-black"
        >
          Go!
        </button>
        <p className="mt-4 text-center text-sm opacity-60">{rows.length} cards</p>
      </div>
      <ul
        ref={list}
        onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto border-t border-neutral-500/25 pb-[env(safe-area-inset-bottom)]"
      >
        {rows.map((r) => (
          <li key={r.id} className="border-b border-neutral-500/15">
            <button
              onClick={() => onOpenCard(r.id)}
              className="flex w-full cursor-pointer items-center gap-4 px-5 py-2 text-left hover:bg-neutral-500/10 active:bg-neutral-500/10"
            >
              <Level level={r.level} />
              <span lang="ar" dir="rtl" className="min-w-0 text-2xl break-words">
                {r.plain}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
