import { type ReactNode, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import {
  Answer,
  FitText,
  Question,
  SuspendButton,
  swipeDirection,
  useDragClickGuard,
} from "./card";
import { BackIcon, IconButton, TopBar, UndoIcon } from "./screens";

type Flashcard = { id: number; arabic: string; plain: string; english: string };
type Outcome = "remembered" | "forgotten" | "suspended";

// How long "Card suspended" shows in the top bar, in milliseconds.
const NOTICE_TIME = 2000;

/**
 * The study screen's header for the card at `index` (0-based) in a session whose first `due`
 * cards are due, whose next `unstudied` are new, and whose remaining cards, up to `total`, are not
 * yet due: "2 / 32 due, 49 new", then "3 / 49 new", then "Extra study (4 / 103)". A count of
 * new cards that is zero is left out.
 */
export function sessionHeader(
  index: number,
  { due, unstudied, total }: { due: number; unstudied: number; total: number },
): string {
  if (index < due) return `${index + 1} / ${due} due` + (unstudied ? `, ${unstudied} new` : "");
  if (index < due + unstudied) return `${index - due + 1} / ${unstudied} new`;
  return `Extra study (${index - due - unstudied + 1} / ${total - due - unstudied})`;
}

export function Study({
  cards,
  dueCount,
  unstudiedCount,
  onAnswer,
  onSuspend,
  onExit,
}: {
  /** The session's cards: the due cards, then the new ones, then those not yet due. */
  cards: Flashcard[];
  dueCount: number;
  unstudiedCount: number;
  /** Records an answer and returns a function that undoes it. */
  onAnswer: (id: number, remembered: boolean) => () => void;
  /** Suspends a card and returns a function that undoes it. */
  onSuspend: (id: number) => () => void;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // history[i] is what was done with cards[i], with the function that undoes it.
  const [history, setHistory] = useState<{ outcome: Outcome; revert: () => void }[]>([]);
  // The index of the card that came up after a suspension, while "Card suspended" shows for it.
  const [noticeAt, setNoticeAt] = useState<number | null>(null);

  useEffect(() => {
    if (noticeAt === null) return undefined;
    const timer = setTimeout(() => setNoticeAt(null), NOTICE_TIME);
    return () => clearTimeout(timer);
  }, [noticeAt]);

  // Suspending works like answering: the card leaves the session, and undo brings it back.
  const mark = (outcome: Outcome) => {
    const id = cards[index].id;
    const revert = outcome === "suspended" ? onSuspend(id) : onAnswer(id, outcome === "remembered");
    setHistory((h) => [...h, { outcome, revert }]);
    setIndex((i) => i + 1);
    setRevealed(false);
    if (outcome === "suspended") setNoticeAt(index + 1);
  };

  const undo = () => {
    if (index === 0) return;
    history[history.length - 1].revert();
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
    setRevealed(false);
  };

  const done = index >= cards.length;
  const count = (o: Outcome) => history.filter((h) => h.outcome === o).length;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        left={
          <IconButton label="End session" onClick={onExit}>
            <BackIcon />
          </IconButton>
        }
        center={
          noticeAt === index ? (
            <span role="status" className="text-sm font-normal opacity-60">
              Card suspended
            </span>
          ) : (
            cards.length > 0 && (
              <span className="text-sm font-normal tabular-nums opacity-60">
                {/* After the last card, it keeps the last card's header. */}
                {sessionHeader(Math.min(index, cards.length - 1), {
                  due: dueCount,
                  unstudied: unstudiedCount,
                  total: cards.length,
                })}
              </span>
            )
          )
        }
        right={
          <IconButton label="Undo" onClick={undo} disabled={index === 0}>
            <UndoIcon />
          </IconButton>
        }
      />
      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-3xl font-bold">Session complete</p>
          <p className="opacity-60">
            {count("remembered")} remembered · {count("forgotten")} forgotten
            {count("suspended") > 0 && ` · ${count("suspended")} suspended`}
          </p>
          <button
            onClick={onExit}
            className="mt-6 rounded-xl bg-black px-6 py-3 font-semibold text-white dark:bg-white dark:text-black"
          >
            Back to stack
          </button>
        </div>
      ) : (
        <Card
          key={index}
          card={cards[index]}
          revealed={revealed}
          onFlip={() => setRevealed(true)}
          onMark={mark}
        />
      )}
    </div>
  );
}

const RED = "rgb(220, 38, 38)";
const GREEN = "rgb(22, 163, 74)";
// The swipe distance at which the red or green underlay is fully shown.
const SWIPE_DISTANCE = 100;

/**
 * One card. Keyed by position, so each new card mounts fresh: unflipped, centred and unvowelled.
 * The vowel toggle belongs to the card, so vowels shown on the front stay shown after the flip.
 */
function Card({
  card,
  revealed,
  onFlip,
  onMark,
}: {
  card: Flashcard;
  revealed: boolean;
  onFlip: () => void;
  onMark: (o: Outcome) => void;
}) {
  const [vowels, setVowels] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-10, 10]);
  const underlay = useTransform(
    x,
    [-SWIPE_DISTANCE, -1, 1, SWIPE_DISTANCE],
    [RED, "rgba(220, 38, 38, 0)", "rgba(22, 163, 74, 0)", GREEN],
  );
  const forgotOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const rememberedOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const leaving = useRef(false);
  const guard = useDragClickGuard();

  // Fly the card off, sideways for an answer and upwards for a suspension, then record the result.
  const commit = (outcome: Outcome) => {
    if (leaving.current) return;
    leaving.current = true;
    const fly = { duration: 0.25, ease: "easeIn", onComplete: () => onMark(outcome) } as const;
    if (outcome === "suspended") animate(y, -window.innerHeight, fly);
    else animate(x, (outcome === "remembered" ? 1 : -1) * window.innerWidth * 1.2, fly);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = swipeDirection(info);
    if (swipe === -1) commit("forgotten");
    else if (swipe === 1) commit("remembered");
    else animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
  };

  // Keyboard: on the question, ← → or Space flip; on the answer, ← forgot, → remembered.
  const latest = useRef({ revealed, onFlip, commit });
  latest.current = { revealed, onFlip, commit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!["ArrowLeft", "ArrowRight", " "].includes(e.key)) return;
      e.preventDefault();
      const current = latest.current;
      if (!current.revealed) current.onFlip();
      else if (e.key === "ArrowLeft") current.commit("forgotten");
      else if (e.key === "ArrowRight") current.commit("remembered");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleVowels = () => setVowels((v) => !v);

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="relative flex-1 px-4" style={{ perspective: 1200 }}>
        <motion.div
          className="absolute inset-y-0 inset-x-4 rounded-3xl"
          style={{ backgroundColor: underlay }}
        >
          <motion.span
            style={{ opacity: rememberedOpacity }}
            className="absolute top-1/2 left-6 -translate-y-1/2 text-5xl font-bold text-white"
          >
            ✓
          </motion.span>
          <motion.span
            style={{ opacity: forgotOpacity }}
            className="absolute top-1/2 right-6 -translate-y-1/2 text-5xl font-bold text-white"
          >
            ✗
          </motion.span>
        </motion.div>
        <motion.div
          data-testid="card"
          className="relative h-full cursor-pointer select-none"
          style={{ x, y, rotate }}
          drag={revealed ? "x" : false}
          dragMomentum={false}
          {...guard}
          onDragEnd={onDragEnd}
          onClick={() => {
            if (!revealed) onFlip();
          }}
        >
          <motion.div
            className="relative h-full"
            style={{ transformStyle: "preserve-3d" }}
            initial={false}
            animate={{ rotateY: revealed ? 180 : 0 }}
            transition={{ duration: 0.45, ease: [0.3, 0, 0.2, 1] }}
          >
            <Face shown={!revealed}>
              <Question card={card} vowels={vowels} onToggleVowels={toggleVowels} />
            </Face>
            <Face
              back
              shown={revealed}
              top={<SuspendButton suspended={false} onClick={() => commit("suspended")} />}
            >
              <Answer card={card} vowels={vowels} onToggleVowels={toggleVowels} />
            </Face>
          </motion.div>
        </motion.div>
      </div>
      <div className="flex shrink-0 gap-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {revealed ? (
          <>
            <button
              onClick={() => commit("forgotten")}
              className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white"
            >
              ✗ Forgot
            </button>
            <button
              onClick={() => commit("remembered")}
              className="flex-1 rounded-xl bg-green-600 py-3 font-semibold text-white"
            >
              ✓ Remembered
            </button>
          </>
        ) : (
          <button
            onClick={onFlip}
            className="flex-1 rounded-xl border border-neutral-500/40 py-3 font-semibold"
          >
            Show answer
          </button>
        )}
      </div>
    </motion.div>
  );
}

/**
 * The face that isn't showing is inert and hidden, so its buttons can't be reached. `top` is a
 * button for the top of the face.
 */
function Face({
  back,
  shown,
  top,
  children,
}: {
  back?: boolean;
  shown: boolean;
  top?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className="absolute inset-0 overflow-hidden rounded-3xl border border-neutral-500/30 bg-white dark:bg-black"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      <FitText roomAbove={top !== undefined}>{children}</FitText>
      {top}
    </div>
  );
}
