import type { ReactNode } from "react";

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

export function Splash({
  title,
  studied,
  total,
  onOpen,
  onExport,
}: {
  title: string;
  studied: number;
  total: number;
  onOpen: () => void;
  onExport: () => void;
}) {
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
                {studied} of {total} studied
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

/** The level column: "new" (dimmed) for unstudied cards, red below 0, green above. */
function Level({ level }: { level: number | null }) {
  const color =
    level === null
      ? "opacity-50"
      : level < 0
        ? "text-red-600 dark:text-red-400"
        : level > 0
          ? "text-green-700 dark:text-green-400"
          : "";
  return <span className={`w-10 shrink-0 text-right tabular-nums ${color}`}>{level ?? "new"}</span>;
}

/** `rows` are in list order; `level` is null for a card not yet studied. */
export function StackScreen({
  title,
  rows,
  onBack,
  onGo,
}: {
  title: string;
  rows: { id: number; plain: string; level: number | null }[];
  onBack: () => void;
  onGo: () => void;
}) {
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
      <ul className="flex-1 overflow-y-auto border-t border-neutral-500/25 pb-[env(safe-area-inset-bottom)]">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-4 border-b border-neutral-500/15 px-5 py-2"
          >
            <Level level={r.level} />
            <span lang="ar" dir="rtl" className="min-w-0 text-2xl break-words">
              {r.plain}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
