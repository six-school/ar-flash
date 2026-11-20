import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Study, sessionHeader } from "./study";
import "./index.css";

type Flashcard = { id: number; arabic: string; plain: string; english: string };
type Step = { outcome: "remembered" | "forgotten" | "suspended"; before: unknown };
type SessionOptions = {
  dueCount?: number;
  unstudiedCount?: number;
  steps?: Step[];
  ended?: boolean;
  onAnswer?: (id: number, remembered: boolean) => unknown;
  onSuspend?: (id: number) => unknown;
  onRestore?: (id: number, before: unknown) => void;
};

const card = { id: 7, arabic: "ثابِت", plain: "ثابت", english: "fixed, stable" };

/**
 * Renders a study session that keeps its steps in state, as the app does, and starts after `steps`,
 * on the summary if `ended`.
 */
function renderSession(
  cards: Flashcard[],
  {
    dueCount = 0,
    unstudiedCount = cards.length,
    steps = [],
    ended = false,
    onAnswer = () => undefined,
    onSuspend = () => undefined,
    onRestore = () => {},
  }: SessionOptions = {},
) {
  function Session() {
    const [state, setState] = useState({ steps, ended });
    return (
      <Study
        cards={cards}
        dueCount={dueCount}
        unstudiedCount={unstudiedCount}
        steps={state.steps}
        ended={state.ended}
        onSteps={(next) => setState({ steps: next, ended: false })}
        onAnswer={onAnswer}
        onSuspend={onSuspend}
        onRestore={onRestore}
        onExit={() => {}}
      />
    );
  }
  return render(
    <div style={{ width: 400, height: 700 }}>
      <Session />
    </div>,
  );
}

function renderStudy(onAnswer?: (id: number, remembered: boolean) => unknown) {
  return renderSession([card], { onAnswer });
}

function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return r.left + r.width / 2;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Study card", () => {
  it("toggles the vowels when the Arabic word is tapped, without flipping", async () => {
    const screen = await renderStudy();
    await screen.getByRole("button", { name: card.plain, exact: true }).click();
    await expect
      .element(screen.getByRole("button", { name: card.arabic, exact: true }))
      .toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Show answer" })).toBeVisible();

    await screen.getByRole("button", { name: card.arabic, exact: true }).click();
    await expect
      .element(screen.getByRole("button", { name: card.plain, exact: true }))
      .toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Show answer" })).toBeVisible();
  });

  it("flips when tapped away from the Arabic word", async () => {
    const screen = await renderStudy();
    await screen.getByTestId("card").click({ position: { x: 40, y: 40 } });
    await expect.element(screen.getByRole("button", { name: /Remembered/ })).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Show answer" }))
      .not.toBeInTheDocument();
    await expect.element(screen.getByText(card.english)).toBeVisible();
  });

  it("keeps the vowels shown on the front after the flip", async () => {
    const screen = await renderStudy();
    await screen.getByRole("button", { name: card.plain, exact: true }).click();
    await screen.getByRole("button", { name: "Show answer" }).click();
    await expect.element(screen.getByText(card.english)).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: card.arabic, exact: true }))
      .toBeVisible();
  });

  it("speaks the vowelled form in Arabic, in pausal form, from the speaker button, without flipping or answering", async () => {
    const speak = vi.spyOn(speechSynthesis, "speak").mockImplementation(() => {});
    const onAnswer = vi.fn<(id: number, remembered: boolean) => unknown>();
    const screen = await renderStudy(onAnswer);
    await screen.getByRole("button", { name: "Show answer" }).click();
    // The word shows the plain form, but the speaker always speaks the vowelled one, with a
    // sukun on the final consonant so the speech engine doesn't add a case ending.
    await expect
      .element(screen.getByRole("button", { name: card.plain, exact: true }))
      .toBeVisible();

    await screen.getByRole("button", { name: "Speak" }).click();
    expect(speak).toHaveBeenCalledOnce();
    const [utterance] = speak.mock.calls[0];
    expect(utterance.text).toBe("ثابِتْ");
    expect(utterance.lang).toBe("ar");

    await expect.element(screen.getByRole("button", { name: /Remembered/ })).toBeVisible();
    await expect.element(screen.getByText(card.english)).toBeVisible();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("puts the speaker button on the back between the Arabic word and the English, centred", async () => {
    const screen = await renderStudy();
    await screen.getByRole("button", { name: "Show answer" }).click();
    const word = screen.getByRole("button", { name: card.plain, exact: true });
    const speaker = screen.getByRole("button", { name: "Speak" });
    const english = screen.getByText(card.english);
    await expect.element(speaker).toBeVisible();
    const layout = () => {
      const s = speaker.element().getBoundingClientRect();
      return {
        belowWord: s.top >= word.element().getBoundingClientRect().bottom,
        aboveEnglish: s.bottom <= english.element().getBoundingClientRect().top,
        centred:
          Math.abs(centre(speaker.element()) - centre(screen.getByTestId("card").element())) < 1,
      };
    };
    // Polled, because the card is still turning over just after the flip.
    await expect.poll(layout).toEqual({
      belowWord: true,
      aboveEnglish: true,
      centred: true,
    });
  });
});

describe("sessionHeader", () => {
  const counts = { due: 32, unstudied: 49, total: 184 };

  it("counts through the due cards and gives the number of new cards", () => {
    expect(sessionHeader(0, counts)).toBe("1 / 32 due, 49 new");
    expect(sessionHeader(31, counts)).toBe("32 / 32 due, 49 new");
  });

  it("counts through the new cards after the due ones", () => {
    expect(sessionHeader(32, counts)).toBe("1 / 49 new");
    expect(sessionHeader(80, counts)).toBe("49 / 49 new");
  });

  it("counts through the cards not yet due as extra study", () => {
    expect(sessionHeader(81, counts)).toBe("Extra study (1 / 103)");
    expect(sessionHeader(183, counts)).toBe("Extra study (103 / 103)");
  });

  it("leaves out the new count when there are no new cards", () => {
    expect(sessionHeader(1, { due: 3, unstudied: 0, total: 10 })).toBe("2 / 3 due");
    expect(sessionHeader(3, { due: 3, unstudied: 0, total: 10 })).toBe("Extra study (1 / 7)");
  });

  it("starts with the new cards when no card is due", () => {
    expect(sessionHeader(0, { due: 0, unstudied: 5, total: 5 })).toBe("1 / 5 new");
  });
});

describe("Study header", () => {
  it("moves from the due card to the new card to extra study, and keeps the last header at the end", async () => {
    const cards = [
      { id: 1, arabic: "أَب", plain: "أب", english: "father" },
      card,
      { id: 9, arabic: "تاج", plain: "تاج", english: "crown" },
    ];
    const screen = await renderSession(cards, { dueCount: 1, unstudiedCount: 1 });
    const answer = async () => {
      await screen.getByRole("button", { name: "Show answer" }).click();
      await screen.getByRole("button", { name: /Remembered/ }).click();
    };
    await expect.element(screen.getByText("1 / 1 due, 1 new")).toBeVisible();
    await answer();
    await expect.element(screen.getByText("1 / 1 new")).toBeVisible();
    await answer();
    await expect.element(screen.getByText("Extra study (1 / 1)")).toBeVisible();
    await answer();
    await expect.element(screen.getByText("Session complete")).toBeVisible();
    await expect.element(screen.getByText("Extra study (1 / 1)")).toBeVisible();
  });
});

describe("Suspending while studying", () => {
  const cards = [
    { id: 1, arabic: "أَب", plain: "أب", english: "father" },
    { id: 9, arabic: "تاج", plain: "تاج", english: "crown" },
  ];

  const renderSuspending = (options: SessionOptions = {}) =>
    renderSession(cards, { dueCount: 2, unstudiedCount: 0, ...options });

  it("offers the suspend button only on the back of the card", async () => {
    const screen = await renderSuspending();
    await expect.element(screen.getByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Show answer" }).click();
    await expect.element(screen.getByRole("button", { name: "Suspend" })).toBeVisible();
  });

  it("suspends the card, moves on, and says so in the top bar for a moment", async () => {
    const onSuspend = vi.fn<(id: number) => unknown>();
    const screen = await renderSuspending({ onSuspend });
    await screen.getByRole("button", { name: "Show answer" }).click();
    await screen.getByRole("button", { name: "Suspend" }).click();

    await expect.element(screen.getByText("Card suspended")).toBeVisible();
    expect(onSuspend).toHaveBeenCalledExactlyOnceWith(1);
    await expect
      .element(screen.getByRole("button", { name: cards[1].plain, exact: true }))
      .toBeVisible();
    // The counts come back after a second and a half, once the notice has faded out.
    await expect.element(screen.getByText("2 / 2 due"), { timeout: 3000 }).toBeVisible();
    await expect.element(screen.getByText("Card suspended")).not.toBeInTheDocument();
  });

  it("brings the card back and puts back its record from before on undo", async () => {
    const before = { level: 2, reviewedAt: "2026-11-19T21:00:00.000Z" };
    const onRestore = vi.fn<(id: number, before: unknown) => void>();
    const screen = await renderSuspending({ onSuspend: () => before, onRestore });
    await screen.getByRole("button", { name: "Show answer" }).click();
    await screen.getByRole("button", { name: "Suspend" }).click();
    await expect.element(screen.getByText("Card suspended")).toBeVisible();

    await screen.getByRole("button", { name: "Undo" }).click();
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(1, before);
    await expect
      .element(screen.getByRole("button", { name: cards[0].plain, exact: true }))
      .toBeVisible();
    await expect.element(screen.getByText("1 / 2 due")).toBeVisible();
  });

  it("counts suspended cards at the end of the session", async () => {
    const screen = await renderSuspending();
    await screen.getByRole("button", { name: "Show answer" }).click();
    await screen.getByRole("button", { name: "Suspend" }).click();
    await expect.element(screen.getByText("Card suspended")).toBeVisible();
    await screen.getByRole("button", { name: "Show answer" }).click();
    await screen.getByRole("button", { name: /Remembered/ }).click();
    await expect
      .element(screen.getByText("1 remembered · 0 forgotten · 1 suspended"))
      .toBeVisible();
  });
});

describe("A session ended early", () => {
  const cards = [
    { id: 1, arabic: "أَب", plain: "أب", english: "father" },
    card,
    { id: 9, arabic: "تاج", plain: "تاج", english: "crown" },
  ];
  const steps: Step[] = [
    { outcome: "remembered", before: undefined },
    { outcome: "forgotten", before: { level: 1, reviewedAt: "2026-11-19T21:00:00.000Z" } },
  ];

  it("shows its summary with the counts so far, keeping the last card's header", async () => {
    const screen = await renderSession(cards, {
      dueCount: 3,
      unstudiedCount: 0,
      steps,
      ended: true,
    });
    await expect.element(screen.getByText("Session ended")).toBeVisible();
    await expect.element(screen.getByText("1 remembered · 1 forgotten")).toBeVisible();
    await expect.element(screen.getByText("2 / 3 due")).toBeVisible();
  });

  it("goes back to its last card on undo, putting back that card's record", async () => {
    const onRestore = vi.fn<(id: number, before: unknown) => void>();
    const screen = await renderSession(cards, {
      dueCount: 3,
      unstudiedCount: 0,
      steps,
      ended: true,
      onRestore,
    });
    await screen.getByRole("button", { name: "Undo" }).click();
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(card.id, steps[1].before);
    await expect
      .element(screen.getByRole("button", { name: card.plain, exact: true }))
      .toBeVisible();
    await expect.element(screen.getByText("2 / 3 due")).toBeVisible();
    await expect.element(screen.getByText("Session ended")).not.toBeInTheDocument();
  });
});
