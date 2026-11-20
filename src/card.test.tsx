import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { CardDetails } from "./card";
import "./index.css";

const cards = [
  { id: 7, arabic: "ثابِت", plain: "ثابت", english: "fixed, stable" },
  { id: 185, arabic: "أَخْضَر", plain: "أخضر", english: "Green" },
];
const [card] = cards;
const HOUR = 60 * 60 * 1000;

function renderDetails({
  review,
  suspended = false,
  onToggleSuspended = () => {},
  onBack = () => {},
  onPrevious,
  onNext,
}: {
  review?: { level: number; due: number };
  suspended?: boolean;
  onToggleSuspended?: () => void;
  onBack?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
} = {}) {
  return render(
    <div style={{ width: 400, height: 700 }}>
      <CardDetails
        card={card}
        review={review}
        suspended={suspended}
        onToggleSuspended={onToggleSuspended}
        onBack={onBack}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>,
  );
}

/** Drag `el` horizontally by `dx` pixels with a mouse, in steps a few frames apart. */
async function drag(el: Element, dx: number) {
  const r = el.getBoundingClientRect();
  const y = r.top + r.height / 2;
  const x0 = r.left + r.width / 2;
  const init = {
    bubbles: true,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    clientY: y,
  };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...init, clientX: x0 }));
  for (let i = 1; i <= 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    window.dispatchEvent(new PointerEvent("pointermove", { ...init, clientX: x0 + (dx * i) / 10 }));
  }
  window.dispatchEvent(new PointerEvent("pointerup", { ...init, clientX: x0 + dx }));
}

function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2;
}

/** Shows `cards` on the details screen, moving through them as CardDetails asks. */
function Browser() {
  const [index, setIndex] = useState(0);
  return (
    <div style={{ width: 400, height: 700 }}>
      <CardDetails
        card={cards[index]}
        review={undefined}
        suspended={false}
        onToggleSuspended={() => {}}
        onBack={() => {}}
        onPrevious={index > 0 ? () => setIndex(index - 1) : undefined}
        onNext={index < cards.length - 1 ? () => setIndex(index + 1) : undefined}
      />
    </div>
  );
}

describe("CardDetails", () => {
  it("shows the card's answer side, without answer buttons", async () => {
    const screen = await renderDetails();
    await expect
      .element(screen.getByRole("button", { name: card.plain, exact: true }))
      .toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Speak" })).toBeVisible();
    await expect.element(screen.getByText(card.english)).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /Remembered/ }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText("Not studied yet")).toBeVisible();
  });

  it("toggles the vowels when the Arabic word is tapped", async () => {
    const screen = await renderDetails();
    await screen.getByRole("button", { name: card.plain, exact: true }).click();
    await expect
      .element(screen.getByRole("button", { name: card.arabic, exact: true }))
      .toBeVisible();
  });

  it("shows the card's level and when it's due", async () => {
    const screen = await renderDetails({ review: { level: 3, due: Date.now() + 5 * HOUR } });
    await expect.element(screen.getByText("Level 3 · due in 5 hours")).toBeVisible();
  });

  it("suspends the card from the button on the card", async () => {
    const onToggleSuspended = vi.fn();
    const screen = await renderDetails({ onToggleSuspended });
    await screen.getByRole("button", { name: "Suspend" }).click();
    expect(onToggleSuspended).toHaveBeenCalledOnce();
  });

  it("says a suspended card is suspended and offers to unsuspend it", async () => {
    const onToggleSuspended = vi.fn();
    const screen = await renderDetails({
      review: { level: 3, due: Date.now() - HOUR },
      suspended: true,
      onToggleSuspended,
    });
    await expect.element(screen.getByText("Level 3 · suspended")).toBeVisible();
    await screen.getByRole("button", { name: "Unsuspend" }).click();
    expect(onToggleSuspended).toHaveBeenCalledOnce();
  });

  it("doesn't swipe when a drag starts on the suspend button", async () => {
    const onNext = vi.fn();
    const onToggleSuspended = vi.fn();
    const screen = await renderDetails({ onNext, onToggleSuspended });
    await drag(screen.getByRole("button", { name: "Suspend" }).element(), -200);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("keeps an affix card's gap for the stem on one line", async () => {
    const affix = {
      id: 324,
      arabic: "تَـ…ـنَ",
      plain: "تـ…ـن",
      english: "You (f. pl.), present tense",
    };
    const screen = await render(
      <div style={{ width: 400, height: 700 }}>
        <CardDetails
          card={affix}
          review={undefined}
          suspended={false}
          onToggleSuspended={() => {}}
          onBack={() => {}}
        />
      </div>,
    );
    const word = screen.getByRole("button", { name: /^تـ/ }).element();
    const shown = word.lastElementChild!;
    // Polled, because the text is fitted to the card after it renders.
    await expect
      .poll(
        () => shown.getBoundingClientRect().height / parseFloat(getComputedStyle(shown).lineHeight),
      )
      .toBeLessThan(1.5);
  });

  it("goes back from the back button", async () => {
    const onBack = vi.fn();
    const screen = await renderDetails({ onBack });
    await screen.getByRole("button", { name: "Back" }).click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("asks for the next card on a swipe left", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const screen = await renderDetails({ onPrevious, onNext });
    const word = screen.getByRole("button", { name: card.plain, exact: true });
    await drag(word.element(), -200);
    await expect.poll(() => onNext.mock.calls.length).toBe(1);
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it("asks for the previous card on a swipe right", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const screen = await renderDetails({ onPrevious, onNext });
    await drag(screen.getByText(card.english).element(), 200);
    await expect.poll(() => onPrevious.mock.calls.length).toBe(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("asks for the next and previous cards with the arrow keys", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    await renderDetails({ onPrevious, onNext });
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowLeft}");
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });

  it("shows the next card in place of this one, and springs back at the end of the list", async () => {
    const screen = await render(<Browser />);
    await drag(screen.getByText(cards[0].english).element(), -200);
    await expect.element(screen.getByText(cards[1].english)).toBeVisible();
    await expect.element(screen.getByText(cards[0].english)).not.toBeInTheDocument();

    // The last card has no next one: it stays, back in the middle.
    await drag(screen.getByText(cards[1].english).element(), -200);
    const word = screen.getByRole("button", { name: cards[1].plain, exact: true });
    await expect.poll(() => Math.abs(centre(word.element()) - 200)).toBeLessThan(2);
    await expect.element(screen.getByText(cards[1].english)).toBeVisible();
  });
});
