import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { CardDetails } from "./card";
import "./index.css";

const card = { arabic: "ثابِت", plain: "ثابت", english: "fixed, stable" };
const HOUR = 60 * 60 * 1000;

function renderDetails(review?: { level: number; due: number }, onBack = () => {}) {
  return render(
    <div style={{ width: 400, height: 700 }}>
      <CardDetails card={card} review={review} onBack={onBack} />
    </div>,
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
    const screen = await renderDetails({ level: 3, due: Date.now() + 5 * HOUR });
    await expect.element(screen.getByText("Level 3 · due in 5 hours")).toBeVisible();
  });

  it("goes back from the back button", async () => {
    const onBack = vi.fn();
    const screen = await renderDetails(undefined, onBack);
    await screen.getByRole("button", { name: "Back" }).click();
    expect(onBack).toHaveBeenCalledOnce();
  });
});
