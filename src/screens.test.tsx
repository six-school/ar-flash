import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { StackScreen } from "./screens";
import "./index.css";

const rows = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  plain: `كلمة ${i + 1}`,
  level: null,
}));

function renderStack({
  initialScroll = 0,
  revealId = undefined as number | undefined,
  onScroll = () => {},
  onOpenCard = () => {},
} = {}) {
  return render(
    <div style={{ width: 400, height: 700 }}>
      <StackScreen
        title="Arabic → English"
        rows={rows}
        initialScroll={initialScroll}
        revealId={revealId}
        onScroll={onScroll}
        onBack={() => {}}
        onGo={() => {}}
        onOpenCard={onOpenCard}
      />
    </div>,
  );
}

describe("StackScreen", () => {
  it("opens a card when its row is tapped", async () => {
    const onOpenCard = vi.fn();
    const screen = await renderStack({ onOpenCard });
    await screen.getByRole("button", { name: "new كلمة 3", exact: true }).click();
    expect(onOpenCard).toHaveBeenCalledWith(3);
  });

  it("opens at the given scroll position and reports scrolling", async () => {
    const onScroll = vi.fn();
    const screen = await renderStack({ initialScroll: 300, onScroll });
    const list = screen.getByRole("list").element();
    expect(list.scrollTop).toBe(300);
    list.scrollTop = 500;
    await expect.poll(() => onScroll.mock.lastCall?.[0]).toBe(500);
  });

  it("scrolls to show the row of the last card viewed if it's out of view", async () => {
    const screen = await renderStack({ revealId: 50 });
    const list = screen.getByRole("list").element().getBoundingClientRect();
    const row = screen.getByRole("button", { name: "new كلمة 50", exact: true }).element();
    const r = row.getBoundingClientRect();
    expect(r.top).toBeGreaterThanOrEqual(list.top);
    expect(r.bottom).toBeLessThanOrEqual(list.bottom);
  });

  it("leaves the scroll position alone when that row is already in view", async () => {
    const screen = await renderStack({ initialScroll: 300, revealId: 12 });
    expect(screen.getByRole("list").element().scrollTop).toBe(300);
  });
});
