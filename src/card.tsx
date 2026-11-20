import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent, type PanInfo } from "motion/react";
import {
  BackIcon,
  IconButton,
  PauseIcon,
  PlayIcon,
  SpeakerIcon,
  TopBar,
  cardStatus,
  useNow,
} from "./screens";
import { speak } from "./speech";

type CardText = { arabic: string; plain: string; english: string };

// How far, or how fast, a card has to be dragged for the drag to count as a swipe.
const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 500;

/** -1 for a swipe to the left, 1 for a swipe to the right, 0 for a drag too short to count. */
export function swipeDirection(info: PanInfo): -1 | 0 | 1 {
  if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) return -1;
  if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) return 1;
  return 0;
}

/**
 * Props for a draggable card, so that the click ending a drag isn't taken as a tap on whatever is
 * under the pointer, such as the Arabic word.
 */
export function useDragClickGuard() {
  const dragged = useRef(false);
  return {
    onPointerDownCapture: () => {
      dragged.current = false;
    },
    onDragStart: () => {
      dragged.current = true;
    },
    onClickCapture: (e: { stopPropagation: () => void }) => {
      if (dragged.current) e.stopPropagation();
    },
  };
}

/**
 * One card's details, opened from the stack's card list: its answer side, with a button on it that
 * suspends or unsuspends the card, and its level and when it's due in the top bar. `review` is
 * undefined for a card not yet studied. Swiping left, or the right arrow key, shows the next card
 * in the list, and swiping right, or the left arrow key, the previous one. `onNext` and
 * `onPrevious` are undefined at the ends of the list.
 */
export function CardDetails({
  card,
  review,
  suspended,
  onToggleSuspended,
  onBack,
  onPrevious,
  onNext,
}: {
  card: { id: number } & CardText;
  review: { level: number; due: number } | undefined;
  suspended: boolean;
  onToggleSuspended: () => void;
  onBack: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const now = useNow();
  // 1 when moving to the next card, -1 to the previous one: the side the new card comes in from.
  const [dir, setDir] = useState(1);

  /** Move to the next (1) or previous (-1) card; false at the end of the list. */
  const step = (to: 1 | -1) => {
    const move = to === 1 ? onNext : onPrevious;
    if (!move) return false;
    setDir(to);
    move();
    return true;
  };

  // Keyboard: ← previous card, → next card. Ignored while this screen is leaving, so a key pressed
  // just after Back doesn't bring it back.
  const isPresent = useIsPresent();
  const latest = useRef({ step, isPresent });
  latest.current = { step, isPresent };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !latest.current.isPresent) return;
      if (e.key === "ArrowLeft") latest.current.step(-1);
      else if (e.key === "ArrowRight") latest.current.step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        left={
          <IconButton label="Back" onClick={onBack}>
            <BackIcon />
          </IconButton>
        }
        center={
          <span className="text-sm font-normal tabular-nums opacity-60">
            {cardStatus(review, suspended, now)}
          </span>
        }
      />
      <div className="relative mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] flex-1">
        <AnimatePresence initial={false} custom={dir}>
          <SlidingCard
            key={card.id}
            card={card}
            dir={dir}
            onSwipe={step}
            suspended={suspended}
            onToggleSuspended={onToggleSuspended}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

// A new card slides in from the side it comes from (`dir` 1: from the right) as the old one slides
// out the other way.
const slide = {
  enter: (dir: number) => ({ x: dir * window.innerWidth }),
  center: { x: 0 },
  exit: (dir: number) => ({ x: -dir * window.innerWidth }),
};

/**
 * A card on the details screen. It follows a horizontal drag; a swipe left asks for the next card
 * and a swipe right for the previous one, and it springs back if there's none. Keyed by card, so
 * each card mounts fresh and unvowelled.
 */
function SlidingCard({
  card,
  dir,
  onSwipe,
  suspended,
  onToggleSuspended,
}: {
  card: CardText;
  dir: number;
  onSwipe: (to: 1 | -1) => boolean;
  suspended: boolean;
  onToggleSuspended: () => void;
}) {
  const [vowels, setVowels] = useState(false);
  const guard = useDragClickGuard();
  return (
    <motion.div
      custom={dir}
      variants={slide}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      drag="x"
      dragSnapToOrigin
      {...guard}
      onDragEnd={(_, info) => {
        const swipe = swipeDirection(info);
        if (swipe !== 0) onSwipe(swipe === -1 ? 1 : -1);
      }}
      className="absolute inset-0 overflow-hidden rounded-3xl border border-neutral-500/30 bg-white select-none dark:bg-black"
    >
      <FitText roomAbove>
        <Answer card={card} vowels={vowels} onToggleVowels={() => setVowels((v) => !v)} />
      </FitText>
      <SuspendButton suspended={suspended} onClick={onToggleSuspended} />
    </motion.div>
  );
}

/** A card's question side: the Arabic word, which toggles its vowels when tapped. */
export function Question({
  card,
  vowels,
  onToggleVowels,
}: {
  card: CardText;
  vowels: boolean;
  onToggleVowels: () => void;
}) {
  return (
    <ArabicLine>
      <ArabicWord
        plain={card.plain}
        arabic={card.arabic}
        vowels={vowels}
        onToggle={onToggleVowels}
      />
    </ArabicLine>
  );
}

/** A card's answer side: the Arabic word with a speaker button beside it, then the English. */
export function Answer({
  card,
  vowels,
  onToggleVowels,
}: {
  card: CardText;
  vowels: boolean;
  onToggleVowels: () => void;
}) {
  return (
    <>
      <ArabicLine>
        {canSpeak && <SpeakerSpace />}
        <ArabicWord
          plain={card.plain}
          arabic={card.arabic}
          vowels={vowels}
          onToggle={onToggleVowels}
        />
        {canSpeak && <SpeakButton text={card.arabic} />}
      </ArabicLine>
      <Line>{card.english}</Line>
    </>
  );
}

/**
 * `text` with a word joiner after each "…", the gap for the stem in an affix card such as "تـ…ـين".
 * A line may otherwise break after the "…" and split the affix.
 */
const keepGap = (text: string) => text.replaceAll("…", "…\u2060");

/**
 * The Arabic word, shown plain or vowelled; tapping it toggles the vowels without flipping the
 * card. An invisible copy of the vowelled form sits in the same grid cell, so the word takes the
 * same space either way and toggling doesn't change the fitted font size.
 */
function ArabicWord({
  plain,
  arabic,
  vowels,
  onToggle,
}: {
  plain: string;
  arabic: string;
  vowels: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      lang="ar"
      dir="rtl"
      title={vowels ? "Hide vowels" : "Show vowels"}
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.blur();
        onToggle();
      }}
      className="inline-grid cursor-pointer"
    >
      <span aria-hidden className="invisible [grid-area:1/1]">
        {keepGap(arabic)}
      </span>
      <span className="[grid-area:1/1]">{keepGap(vowels ? arabic : plain)}</span>
    </button>
  );
}

// Without speech synthesis, the speaker button and the space that balances it are left out.
const canSpeak = typeof speechSynthesis !== "undefined";
// The speaker button's box and icon. A blank box of the same size sits on the word's other side,
// so the word stays centred on the card.
const SPEAKER_BOX = "shrink-0 p-2";
const SPEAKER_ICON = "size-[clamp(1.5rem,0.5em,2.5rem)]";

function SpeakerSpace() {
  return (
    <span aria-hidden className={`invisible ${SPEAKER_BOX}`}>
      <SpeakerIcon className={SPEAKER_ICON} />
    </span>
  );
}

/**
 * A ref for a button on a swipeable card. The card starts a swipe from a native pointerdown on
 * itself, which a React handler on the button would see too late to stop; stopping the native
 * event keeps a press on the button from swiping.
 */
function useNoSwipe() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    const stop = (e: PointerEvent) => e.stopPropagation();
    el?.addEventListener("pointerdown", stop);
    return () => el?.removeEventListener("pointerdown", stop);
  }, []);
  return ref;
}

/** Speaks `text` in Arabic. */
function SpeakButton({ text }: { text: string }) {
  const ref = useNoSwipe();
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Speak"
      title="Speak"
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.blur();
        speak(text);
      }}
      className={`${SPEAKER_BOX} cursor-pointer rounded-full opacity-60 hover:bg-neutral-500/15 hover:opacity-100`}
    >
      <SpeakerIcon className={SPEAKER_ICON} />
    </button>
  );
}

/**
 * The button at the top centre of a card's answer side that suspends the card, or unsuspends it.
 * It goes inside the card, after a FitText with `roomAbove`.
 */
export function SuspendButton({ suspended, onClick }: { suspended: boolean; onClick: () => void }) {
  const ref = useNoSwipe();
  const label = suspended ? "Unsuspend" : "Suspend";
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        e.currentTarget.blur();
        onClick();
      }}
      className="absolute top-2 left-1/2 grid size-11 -translate-x-1/2 cursor-pointer place-items-center rounded-full opacity-50 hover:bg-neutral-500/15 hover:opacity-100"
    >
      {suspended ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
    </button>
  );
}

/** The Arabic line: larger than the English, centred, with anything after the word to its right. */
function ArabicLine({ children }: { children: ReactNode }) {
  return (
    <p className="my-[0.2em] flex items-center justify-center gap-[0.15em] text-[1.5em]">
      {children}
    </p>
  );
}

/**
 * A line of English card text. It wraps only at spaces, so the text shrinks rather than split a
 * word.
 */
function Line({ children }: { children: string }) {
  const content = children.split(/(\s+)/).map((part, i) =>
    part.includes("-") ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
  return <p className="my-[0.2em]">{content}</p>;
}

/**
 * Sets the largest font size at which the content still fits its box, and refits on resize.
 * `roomAbove` leaves space at the top for a SuspendButton.
 */
export function FitText({ children, roomAbove }: { children: ReactNode; roomAbove?: boolean }) {
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
      className={`absolute inset-0 flex flex-col justify-center overflow-hidden px-6 pb-6 text-center leading-tight ${roomAbove ? "pt-14" : "pt-6"}`}
    >
      {children}
    </div>
  );
}
