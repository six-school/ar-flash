import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { z } from "zod";
import { CardDetails } from "./card";
import { useCards } from "./cards";
import { exportProgress, useProgress } from "./progress";
import { dueAt, listOrder, sessionOrder, studied } from "./schedule";
import { Splash, StackScreen } from "./screens";
import { Study } from "./study";

/**
 * A screen, as saved in its browser history entry. Cards are given by id. A study session also
 * keeps what was done with each card so far, with the card's record from before, which undo puts
 * back; whether it was ended before its last card, which shows its summary; and whether its entry
 * has an entry under it for that summary.
 */
const screenSchema = z.union([
  z.object({ name: z.literal("home") }),
  z.object({ name: z.literal("stack") }),
  z
    .object({ name: z.literal("card"), ids: z.array(z.int()), index: z.int().min(0) })
    .refine((s) => s.index < s.ids.length),
  z
    .object({
      name: z.literal("study"),
      ids: z.array(z.int()),
      dueCount: z.int().min(0),
      unstudiedCount: z.int().min(0),
      steps: z.array(
        z.object({
          outcome: z.enum(["remembered", "forgotten", "suspended"]),
          before: z.unknown(),
        }),
      ),
      ended: z.boolean(),
      guarded: z.boolean(),
    })
    .refine(
      (s) =>
        s.dueCount + s.unstudiedCount <= s.ids.length &&
        s.steps.length <= s.ids.length &&
        (!s.ended || endsEarly(s.steps.length, s.ids.length)),
    ),
]);
type Screen = z.infer<typeof screenSchema>;

/** The screen saved in a history entry's state, or the home screen if there's none. */
function savedScreen(state: unknown): Screen {
  const result = screenSchema.safeParse(state);
  return result.success ? result.data : { name: "home" };
}

/** Whether leaving a session after `done` of its `total` cards ends it early, with a summary. */
function endsEarly(done: number, total: number) {
  return done > 0 && done < total;
}

const depth = { home: 0, stack: 1, study: 2, card: 2 } as const;

// Deeper screens slide in from the right; going back slides them out to the right.
const views = {
  enter: (dir: number) => ({ x: `${dir * 30}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: `${dir * -30}%`, opacity: 0 }),
};

export default function App() {
  const cards = useCards();
  const { progress, answer, setSuspended, restore } = useProgress();
  // Each screen has its own browser history entry, which saves what's needed to show it again.
  // Back, the phone's or the app's, goes back an entry. After the page reloads, as when Android
  // discards it in the background, the app opens on the screen saved in the current entry.
  const [screen, setScreen] = useState(() => savedScreen(history.state));
  // The screen as last set, for the history event handler, and whether the app's Back is waiting
  // for that event.
  const current = useRef(screen);
  const goingBack = useRef(false);
  const [dir, setDir] = useState(1);
  // The card list's scroll position, kept while cards' details are open, and the last card viewed
  // there, which the list shows when it comes back.
  const listScroll = useRef(0);
  const listReveal = useRef<number | undefined>(undefined);

  const show = (next: Screen) => {
    const from = current.current;
    if (next.name === "stack" && from.name !== "stack") {
      if (from.name === "card") {
        listReveal.current = from.ids[from.index];
      } else {
        listScroll.current = 0;
        listReveal.current = undefined;
      }
    }
    setDir(Math.sign(depth[next.name] - depth[from.name]) || 1);
    current.current = next;
    setScreen(next);
  };

  // A screen only acts while it's the current screen. A second tap during the change of screen, or
  // a tap on a screen sliding out, doesn't go on a screen further, and an answer that lands after
  // its card has flown off, once Back has left the session, doesn't bring the session back.
  const push = (from: Screen, next: Screen) => {
    if (from !== current.current) return;
    history.pushState(next, "");
    show(next);
  };
  const replace = (from: Screen, next: Screen) => {
    if (from !== current.current) return;
    history.replaceState(next, "");
    show(next);
  };
  const back = (from: Screen) => {
    if (from !== current.current || goingBack.current) return;
    goingBack.current = true;
    history.back();
  };

  useEffect(() => {
    // The entry the app opened on: on a fresh start, it saves the home screen there.
    history.replaceState(current.current, "");
    const onPopState = (e: PopStateEvent) => {
      goingBack.current = false;
      const from = current.current;
      const to = savedScreen(e.state);
      // Back from a session lands on the entry kept under it for its summary. Leaving part-way
      // through shows the summary there, and Back from the summary goes on to the stack. A
      // finished session, or one whose answers were all undone, goes straight on to the stack.
      if (from.name === "study" && to.name === "study") {
        if (!from.ended && endsEarly(from.steps.length, from.ids.length)) {
          replace(from, { ...from, ended: true, guarded: false });
        } else {
          goingBack.current = true;
          history.back();
        }
      } else {
        show(to);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // A saved screen can name cards that are no longer in the card file; the stack shows instead.
  useEffect(() => {
    if (!cards || "error" in cards) return;
    const s = current.current;
    const ids = new Set(cards.file.cards.map((c) => c.id));
    if ((s.name === "study" || s.name === "card") && !s.ids.every((id) => ids.has(id)))
      replace(s, { name: "stack" });
  }, [cards]);

  if (!cards) return null;
  if ("error" in cards) return <p className="p-6 whitespace-pre-wrap">{cards.error}</p>;
  const { title, cards: all } = cards.file;
  const byId = new Map(all.map((c) => [c.id, c]));
  /** The cards with these ids, or undefined if any is missing from the card file. */
  const lookup = (ids: number[]) => {
    const found = ids.flatMap((id) => byId.get(id) ?? []);
    return found.length === ids.length ? found : undefined;
  };

  let view;
  if (screen.name === "home") {
    view = (
      <Splash
        title={title}
        dueTimes={all.flatMap((c) => {
          const r = studied(progress[c.id]);
          return r && !r.suspended ? [dueAt(r)] : [];
        })}
        // A suspended card has a record even if it was never studied, so it isn't counted here.
        unstudied={all.filter((c) => !progress[c.id]).length}
        onOpen={() => push(screen, { name: "stack" })}
        onExport={() => exportProgress(progress)}
      />
    );
  } else if (screen.name === "stack") {
    const ordered = listOrder(all, progress, Date.now());
    const rows = ordered.map((c) => ({
      id: c.id,
      plain: c.plain,
      level: studied(progress[c.id])?.level ?? null,
      suspended: progress[c.id]?.suspended === true,
    }));
    view = (
      <StackScreen
        title={title}
        rows={rows}
        initialScroll={listScroll.current}
        revealId={listReveal.current}
        onScroll={(top) => {
          listScroll.current = top;
        }}
        onBack={() => back(screen)}
        onGo={() => {
          const { due, unstudied, notYetDue } = sessionOrder(
            all,
            progress,
            Date.now(),
            Math.random,
          );
          push(screen, {
            name: "study",
            ids: [...due, ...unstudied, ...notYetDue].map((c) => c.id),
            dueCount: due.length,
            unstudiedCount: unstudied.length,
            steps: [],
            ended: false,
            guarded: false,
          });
        }}
        onOpenCard={(id) =>
          push(screen, {
            name: "card",
            ids: ordered.map((c) => c.id),
            index: ordered.findIndex((c) => c.id === id),
          })
        }
      />
    );
  } else if (screen.name === "card") {
    const order = lookup(screen.ids);
    if (order) {
      const { index } = screen;
      const { id } = order[index];
      const r = studied(progress[id]);
      const suspended = progress[id]?.suspended === true;
      const showCard = (i: number) => replace(screen, { ...screen, index: i });
      view = (
        <CardDetails
          card={order[index]}
          review={r && { level: r.level, due: dueAt(r) }}
          suspended={suspended}
          onToggleSuspended={() => setSuspended(id, !suspended)}
          onBack={() => back(screen)}
          onPrevious={index > 0 ? () => showCard(index - 1) : undefined}
          onNext={index < order.length - 1 ? () => showCard(index + 1) : undefined}
        />
      );
    }
  } else {
    const session = lookup(screen.ids);
    if (session) {
      view = (
        <Study
          cards={session}
          dueCount={screen.dueCount}
          unstudiedCount={screen.unstudiedCount}
          steps={screen.steps}
          ended={screen.ended}
          // New steps come from an answer or an undo, and an undo on the summary of a session
          // ended early goes back to its last card. The phone's Back in Chrome skips an entry that
          // a page left by adding another without a tap, so the entry for the summary is set up
          // right after a tap: the first answer, or an undo on the summary, moves the session to a
          // new entry, leaving its old one under it.
          onSteps={(steps) => {
            const next = { ...screen, steps, ended: false };
            if (steps.length > 0 && !screen.guarded) push(screen, { ...next, guarded: true });
            else replace(screen, next);
          }}
          onAnswer={answer}
          onSuspend={(id) => setSuspended(id, true)}
          onRestore={restore}
          onExit={() => back(screen)}
        />
      );
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-full overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={screen.name}
            custom={dir}
            variants={views}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className="absolute inset-0 mx-auto max-w-2xl pt-[env(safe-area-inset-top)]"
          >
            {view}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
