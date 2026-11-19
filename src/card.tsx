import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BackIcon, IconButton, SpeakerIcon, TopBar, cardStatus, useNow } from "./screens";
import { speak } from "./speech";

type CardText = { arabic: string; plain: string; english: string };

/**
 * One card's details, opened from the stack's card list: its answer side, with its level and when
 * it's due in the top bar. `review` is undefined for a card not yet studied.
 */
export function CardDetails({
  card,
  review,
  onBack,
}: {
  card: CardText;
  review: { level: number; due: number } | undefined;
  onBack: () => void;
}) {
  const [vowels, setVowels] = useState(false);
  const now = useNow();
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
            {cardStatus(review, now)}
          </span>
        }
      />
      <div className="relative mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] flex-1 overflow-hidden rounded-3xl border border-neutral-500/30">
        <FitText>
          <Answer card={card} vowels={vowels} onToggleVowels={() => setVowels((v) => !v)} />
        </FitText>
      </div>
    </div>
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
        {arabic}
      </span>
      <span className="[grid-area:1/1]">{vowels ? arabic : plain}</span>
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

/** Speaks `text` in Arabic. */
function SpeakButton({ text }: { text: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  // In a study session the card starts a swipe from a native pointerdown on itself, which a React
  // handler here would see too late to stop; stopping the native event keeps a press on this button
  // from swiping.
  useEffect(() => {
    const el = ref.current;
    const stop = (e: PointerEvent) => e.stopPropagation();
    el?.addEventListener("pointerdown", stop);
    return () => el?.removeEventListener("pointerdown", stop);
  }, []);

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

/** Sets the largest font size at which the content still fits its box, and refits on resize. */
export function FitText({ children }: { children: ReactNode }) {
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
