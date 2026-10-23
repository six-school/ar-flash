import type { ReactNode } from "react";
import {
  type Entry,
  type Progress,
  type StackId,
  STACKS,
  exportProgress,
  questionOf,
  resultOf,
  score,
} from "./store";

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
const ChevronIcon = () => (
  <svg {...icon} viewBox="0 0 24 24" className="opacity-40">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

/** Arabic text gets the right language, direction and a larger size. */
export function Word({
  stack,
  entry,
  className = "",
}: {
  stack: StackId;
  entry: Entry;
  className?: string;
}) {
  const arabic = stack === "ar-en";
  return (
    <span
      lang={arabic ? "ar" : undefined}
      dir={arabic ? "rtl" : undefined}
      className={`${arabic ? "text-2xl" : ""} ${className}`}
    >
      {questionOf(stack, entry)}
    </span>
  );
}

export function Splash({
  entries,
  progress,
  onOpen,
}: {
  entries: Entry[];
  progress: Progress;
  onOpen: (s: StackId) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <h1 className="px-5 pt-10 pb-6 text-3xl font-bold">Arabic Flashcards</h1>
      <ul className="border-y border-neutral-500/25">
        {STACKS.map((s) => {
          const studied = entries.filter((e) => {
            const r = resultOf(progress, s.id, e.id);
            return r.remembered + r.forgotten > 0;
          }).length;
          return (
            <li key={s.id} className="border-b border-neutral-500/25 last:border-b-0">
              <button
                onClick={() => onOpen(s.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-neutral-500/10"
              >
                <span className="flex-1">
                  <span className="block text-lg font-medium">{s.title}</span>
                  <span className="block text-sm opacity-60">
                    {studied} of {entries.length} studied
                  </span>
                </span>
                <ChevronIcon />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex justify-center pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => exportProgress(progress)}
          className="rounded-lg border border-neutral-500/40 px-3 py-1.5 text-sm opacity-70 hover:opacity-100"
        >
          Export results
        </button>
      </div>
    </div>
  );
}

export function StackScreen({
  stack,
  entries,
  progress,
  onBack,
  onGo,
}: {
  stack: StackId;
  entries: Entry[];
  progress: Progress;
  onBack: () => void;
  onGo: () => void;
}) {
  const rows = entries
    .map((e) => ({ e, s: score(resultOf(progress, stack, e.id)) }))
    .toSorted((a, b) => a.s - b.s || a.e.id - b.e.id);
  const title = STACKS.find((s) => s.id === stack)!.title;

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
        <p className="mt-4 text-center text-sm opacity-60">{entries.length} cards</p>
      </div>
      <ul className="flex-1 overflow-y-auto border-t border-neutral-500/25 pb-[env(safe-area-inset-bottom)]">
        {rows.map(({ e, s }) => (
          <li
            key={e.id}
            className="flex items-center gap-4 border-b border-neutral-500/15 px-5 py-2"
          >
            <span
              className={`w-10 shrink-0 text-right tabular-nums ${s < 0 ? "text-red-600 dark:text-red-400" : s > 0 ? "text-green-700 dark:text-green-400" : "opacity-50"}`}
            >
              {s}
            </span>
            <Word stack={stack} entry={e} className="min-w-0 break-words" />
          </li>
        ))}
      </ul>
    </div>
  );
}
