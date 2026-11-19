import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { Study } from "./study";
import "./index.css";

const card = { id: 7, arabic: "ثابِت", plain: "ثابت", english: "fixed, stable" };

function renderStudy(onAnswer = vi.fn(() => () => {})) {
  return render(
    <div style={{ width: 400, height: 700 }}>
      <Study cards={[card]} onAnswer={onAnswer} onExit={() => {}} />
    </div>,
  );
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
    const onAnswer = vi.fn(() => () => {});
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

  it("keeps the Arabic word centred on the back, beside the speaker button", async () => {
    const screen = await renderStudy();
    await screen.getByRole("button", { name: "Show answer" }).click();
    await expect.element(screen.getByRole("button", { name: "Speak" })).toBeVisible();
    const word = screen.getByRole("button", { name: card.plain, exact: true });
    const offset = () => centre(word.element()) - centre(screen.getByTestId("card").element());
    // Polled, because the card is still turning over just after the flip.
    await expect.poll(() => Math.abs(offset())).toBeLessThan(1);
  });
});
