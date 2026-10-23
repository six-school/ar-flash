import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { type Entry, type Outcome, type StackId } from "./store";
import { BackIcon, IconButton, TopBar, UndoIcon } from "./screens";

type RecordFn = (stack: StackId, id: number, outcome: Outcome, delta: 1 | -1) => void;

export function Study({
  stack,
  cards,
  record,
  onExit,
}: {
  stack: StackId;
  cards: Entry[];
  record: RecordFn;
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<Outcome[]>([]); // history[i] is the outcome for cards[i]

  const mark = (outcome: Outcome) => {
    record(stack, cards[index].id, outcome, 1);
    setHistory((h) => [...h, outcome]);
    setIndex((i) => i + 1);
    setRevealed(false);
  };

  const undo = () => {
    if (index === 0) return;
    record(stack, cards[index - 1].id, history[history.length - 1], -1);
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => i - 1);
    setRevealed(false);
  };

  const done = index >= cards.length;
  const count = (o: Outcome) => history.filter((h) => h === o).length;

  return (
    <div className="flex h-full flex-col">
      <TopBar
        left={
          <IconButton label="End session" onClick={onExit}>
            <BackIcon />
          </IconButton>
        }
        center={
          <span className="text-sm font-normal tabular-nums opacity-60">
            {Math.min(index + 1, cards.length)} / {cards.length}
          </span>
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
          stack={stack}
          entry={cards[index]}
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
const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 500;

/** One card. Keyed by position, so each new card mounts fresh, unflipped and centred. */
function Card({
  stack,
  entry,
  revealed,
  onFlip,
  onMark,
}: {
  stack: StackId;
  entry: Entry;
  revealed: boolean;
  onFlip: () => void;
  onMark: (o: Outcome) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-10, 10]);
  const underlay = useTransform(
    x,
    [-SWIPE_DISTANCE, -1, 1, SWIPE_DISTANCE],
    [RED, "rgba(220, 38, 38, 0)", "rgba(22, 163, 74, 0)", GREEN],
  );
  const forgotOpacity = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const rememberedOpacity = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const leaving = useRef(false);

  // Fly the card off in the swipe direction, then record the result.
  const commit = (outcome: Outcome) => {
    if (leaving.current) return;
    leaving.current = true;
    const dir = outcome === "remembered" ? 1 : -1;
    animate(x, dir * window.innerWidth * 1.2, {
      duration: 0.25,
      ease: "easeIn",
      onComplete: () => onMark(outcome),
    });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) commit("forgotten");
    else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY)
      commit("remembered");
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
      const card = latest.current;
      if (!card.revealed) card.onFlip();
      else if (e.key === "ArrowLeft") card.commit("forgotten");
      else if (e.key === "ArrowRight") card.commit("remembered");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const arabic = (
    <Line key="ar" arabic>
      {entry.arabic}
    </Line>
  );
  const rom = entry.romanization ? <Romanization key="rom" text={entry.romanization} /> : null;
  const english = <Line key="en">{entry.english}</Line>;
  const question = stack === "en-ar" ? [english] : [arabic];
  const answer = stack === "en-ar" ? [english, arabic, rom] : [arabic, rom, english];

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
          className="relative h-full cursor-pointer select-none"
          style={{ x, rotate }}
          drag={revealed ? "x" : false}
          dragMomentum={false}
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
            <Face>{question}</Face>
            <Face back>{answer}</Face>
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

function Face({ back, children }: { back?: boolean; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-3xl border border-neutral-500/30 bg-white dark:bg-black"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      <FitText>{children}</FitText>
    </div>
  );
}

/**
 * The transliteration starts blurred. A tap or click toggles it; on devices with a mouse,
 * hovering unblurs it until the pointer leaves (Tailwind's `hover:` only applies where hover exists).
 */
function Romanization({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  return (
    <Line
      className="text-[0.7em] italic"
      wrap={(content) => (
        <span
          role="button"
          aria-pressed={shown}
          onClick={(e) => {
            e.stopPropagation();
            setShown((s) => !s);
          }}
          className={`inline-block cursor-pointer transition-[filter] duration-250 ${
            shown ? "blur-none" : "blur-[0.12em] hover:blur-none"
          }`}
        >
          {content}
        </span>
      )}
    >
      {text}
    </Line>
  );
}

/**
 * A line of card text. Lines wrap only at spaces, so the text shrinks rather than split a word.
 * `wrap` can wrap the line's content, e.g. to make it interactive.
 */
function Line({
  arabic,
  className = "",
  wrap,
  children,
}: {
  arabic?: boolean;
  className?: string;
  wrap?: (content: ReactNode) => ReactNode;
  children: string;
}) {
  const content = children.split(/(\s+)/).map((part, i) =>
    part.includes("-") ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
  return (
    <p
      lang={arabic ? "ar" : undefined}
      dir={arabic ? "rtl" : undefined}
      className={`my-[0.2em] ${arabic ? "text-[1.5em]" : ""} ${className}`}
    >
      {wrap ? wrap(content) : content}
    </p>
  );
}

/** Sets the largest font size at which the content still fits its box, and refits on resize. */
function FitText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!;
    const fit = () => {
      let lo = 8,
        hi = 400;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        el.style.fontSize = `${mid}px`;
        // Check each line too: right-to-left text overflows to the left, which the box's own scrollWidth misses.
        const lines = [...el.children];
        const fits =
          el.scrollHeight <= el.clientHeight && lines.every((l) => l.scrollWidth <= l.clientWidth);
        if (fits) lo = mid;
        else hi = mid;
      }
      el.style.fontSize = `${lo}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div
      ref={ref}
      className="absolute inset-0 flex flex-col justify-center overflow-hidden p-6 text-center leading-tight"
    >
      {children}
    </div>
  );
}
