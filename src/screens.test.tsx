import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { StackScreen } from "./screens";
import "./index.css";

const rows = Array.from({ length: 60 }, (_, i) => ({
  id: i + 1,
  plain: `كلمة ${i + 1}`,
  level: null,
}));

function renderStack({ initialScroll = 0, onScroll = () => {}, onOpenCard = () => {} } = {}) {
  return render(
    <div style={{ width: 400, height: 700 }}>
      <StackScreen
        title="Arabic → English"
        rows={rows}
        initialScroll={initialScroll}
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
});
