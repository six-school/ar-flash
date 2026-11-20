import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { z } from "zod";
import App from "./App";
import "./index.css";

const file = {
  title: "Test stack",
  cards: [
    { id: 1, arabic: "أَب", plain: "أب", english: "father" },
    { id: 4, arabic: "باب", plain: "باب", english: "door" },
    { id: 9, arabic: "تاج", plain: "تاج", english: "crown" },
  ],
};
const PROGRESS = "flashcards-progress-v2";

const plain = (id: number) => file.cards.find((c) => c.id === id)!.plain;

/**
 * A stand-in for the browser's session history, starting on the last of `states`, so that tests
 * can go back without navigating the test page. `history.back()`, which the app's back buttons
 * call, fires popstate with the state of the entry below. The returned `pressBack` is the phone's
 * Back, which in Chrome skips an entry that the page left by adding another without a tap (or key
 * press) since its last change of entry.
 */
function fakeHistory(states: unknown[] = [null]) {
  const entries = states.map((state) => ({ state, skip: false }));
  let at = entries.length - 1;
  let tapped = false;
  const onTap = () => {
    tapped = true;
  };
  window.addEventListener("pointerdown", onTap, true);
  window.addEventListener("keydown", onTap, true);
  onTestFinished(() => {
    window.removeEventListener("pointerdown", onTap, true);
    window.removeEventListener("keydown", onTap, true);
  });
  const go = (to: number) => {
    at = to;
    tapped = false;
    const state = structuredClone(entries[at].state);
    setTimeout(() => window.dispatchEvent(new PopStateEvent("popstate", { state })));
  };
  vi.spyOn(history, "state", "get").mockImplementation(() => entries[at].state);
  vi.spyOn(history, "pushState").mockImplementation((state: unknown) => {
    entries[at].skip = !tapped;
    tapped = false;
    entries.splice(at + 1, entries.length, { state: structuredClone(state), skip: false });
    at += 1;
  });
  vi.spyOn(history, "replaceState").mockImplementation((state: unknown) => {
    entries[at].state = structuredClone(state);
  });
  vi.spyOn(history, "back").mockImplementation(() => {
    if (at > 0) go(at - 1);
  });
  const pressBack = () => {
    let to = at - 1;
    while (to > 0 && entries[to].skip) to -= 1;
    if (to >= 0) go(to);
  };
  return { pressBack };
}

function renderApp() {
  return render(
    <div style={{ width: 400, height: 700 }}>
      <App />
    </div>,
  );
}

type Screen = Awaited<ReturnType<typeof renderApp>>;

async function startSession(screen: Screen) {
  await screen.getByRole("button", { name: /Test stack/ }).click();
  await screen.getByRole("button", { name: "Go!" }).click();
  await expect.element(screen.getByText("1 / 3 new")).toBeVisible();
}

async function rememberCard(screen: Screen) {
  await screen.getByRole("button", { name: "Show answer" }).click();
  await screen.getByRole("button", { name: /Remembered/ }).click();
}

beforeEach(() => {
  localStorage.removeItem(PROGRESS);
  const fetch = window.fetch.bind(window);
  vi.spyOn(window, "fetch").mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    return url.endsWith("ar-en.json") ? Promise.resolve(Response.json(file)) : fetch(input, init);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(PROGRESS);
});

describe("The phone's Back", () => {
  it("shows the summary on leaving a session part-way through, then goes on to the stack and home", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("2 / 3 new")).toBeVisible();

    pressBack();
    await expect.element(screen.getByText("Session ended")).toBeVisible();
    await expect.element(screen.getByText("1 remembered · 0 forgotten")).toBeVisible();
    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
    pressBack();
    await expect.element(screen.getByRole("button", { name: /Test stack/ })).toBeVisible();
  });

  it("shows the summary again after an undo on it", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("3 / 3 new")).toBeVisible();

    pressBack();
    await expect.element(screen.getByText("2 remembered · 0 forgotten")).toBeVisible();
    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.element(screen.getByText("2 / 3 new")).toBeVisible();
    pressBack();
    await expect.element(screen.getByText("1 remembered · 0 forgotten")).toBeVisible();
    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });

  it("goes straight to the stack on leaving a session before any card is done", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await startSession(screen);

    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
    await expect.element(screen.getByText("Session ended")).not.toBeInTheDocument();
  });

  it("goes straight to the stack from a session whose answers were all undone", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("2 / 3 new")).toBeVisible();
    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.element(screen.getByText("1 / 3 new")).toBeVisible();

    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
    await expect.element(screen.getByText("Session ended")).not.toBeInTheDocument();
  });

  it("goes straight to the stack from a finished session", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await rememberCard(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("Session complete")).toBeVisible();

    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });

  it("stays on the stack when an answer lands after Back has left the session", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    // The answer is recorded once the card has flown off, after Back.
    await rememberCard(screen);
    pressBack();
    await expect.poll(() => localStorage.getItem(PROGRESS)).toMatch(/level/);

    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
    await expect.element(screen.getByText("2 / 3 new")).not.toBeInTheDocument();
    expect(history.state).toEqual({ name: "stack" });
  });

  it("goes from a card's details to the stack", async () => {
    const { pressBack } = fakeHistory();
    const screen = await renderApp();
    await screen.getByRole("button", { name: /Test stack/ }).click();
    await screen.getByRole("button", { name: "new أب", exact: true }).click();
    await expect.element(screen.getByText("Not studied yet")).toBeVisible();

    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });
});

describe("The app's back buttons", () => {
  it("show the summary on leaving a session part-way through, then go on to the stack", async () => {
    fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("2 / 3 new")).toBeVisible();

    await screen.getByRole("button", { name: "End session" }).click();
    await expect.element(screen.getByText("Session ended")).toBeVisible();
    await screen.getByRole("button", { name: "Back to stack" }).click();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });

  it("go straight to the stack from a finished session", async () => {
    fakeHistory();
    const screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await rememberCard(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("Session complete")).toBeVisible();

    await screen.getByRole("button", { name: "Back to stack" }).click();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });
});

describe("After a reload", () => {
  it("opens where it was in a session, and undo and Back still work", async () => {
    const { pressBack } = fakeHistory();
    let screen = await renderApp();
    await startSession(screen);
    await rememberCard(screen);
    await expect.element(screen.getByText("2 / 3 new")).toBeVisible();
    const [first, second] = z.object({ ids: z.array(z.int()) }).parse(history.state).ids;
    await expect.poll(() => localStorage.getItem(PROGRESS)).toContain(`"${first}"`);
    await screen.unmount();

    screen = await renderApp();
    await expect.element(screen.getByText("2 / 3 new")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: plain(second), exact: true }))
      .toBeVisible();

    await screen.getByRole("button", { name: "Undo" }).click();
    await expect.element(screen.getByText("1 / 3 new")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: plain(first), exact: true }))
      .toBeVisible();
    await expect.poll(() => localStorage.getItem(PROGRESS)).toBe("{}");
    pressBack();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });

  it("opens on the stack if the saved screen names a card no longer in the card file", async () => {
    fakeHistory([{ name: "home" }, { name: "stack" }, { name: "card", ids: [1, 99], index: 0 }]);
    const screen = await renderApp();
    await expect.element(screen.getByRole("button", { name: "Go!" })).toBeVisible();
  });

  it("opens on the home screen if the saved state isn't a screen", async () => {
    fakeHistory([{ name: "study", ids: "1, 4, 9" }]);
    const screen = await renderApp();
    await expect.element(screen.getByRole("button", { name: /Test stack/ })).toBeVisible();
  });
});
