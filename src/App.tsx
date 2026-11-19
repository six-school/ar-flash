import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCards } from "./cards";
import { exportProgress, useProgress } from "./progress";
import { listOrder, sessionOrder } from "./schedule";
import { Splash, StackScreen } from "./screens";
import { Study } from "./study";

type Card = { id: number; arabic: string; plain: string; english: string };

type Screen = { name: "home" } | { name: "stack" } | { name: "study"; cards: Card[] };

const depth = { home: 0, stack: 1, study: 2 } as const;

// Deeper screens slide in from the right; going back slides them out to the right.
const views = {
  enter: (dir: number) => ({ x: `${dir * 30}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: `${dir * -30}%`, opacity: 0 }),
};

export default function App() {
  const cards = useCards();
  const { progress, answer } = useProgress();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [dir, setDir] = useState(1);

  const go = (next: Screen) => {
    setDir(Math.sign(depth[next.name] - depth[screen.name]) || 1);
    setScreen(next);
  };

  if (!cards) return null;
  if ("error" in cards) return <p className="p-6 whitespace-pre-wrap">{cards.error}</p>;
  const { title, cards: all } = cards.file;

  let view;
  if (screen.name === "home") {
    view = (
      <Splash
        title={title}
        studied={all.filter((c) => progress[c.id]).length}
        total={all.length}
        onOpen={() => go({ name: "stack" })}
        onExport={() => exportProgress(progress)}
      />
    );
  } else if (screen.name === "stack") {
    const rows = listOrder(all, progress, Date.now()).map((c) => ({
      id: c.id,
      plain: c.plain,
      level: progress[c.id]?.level ?? null,
    }));
    view = (
      <StackScreen
        title={title}
        rows={rows}
        onBack={() => go({ name: "home" })}
        onGo={() =>
          go({ name: "study", cards: sessionOrder(all, progress, Date.now(), Math.random) })
        }
      />
    );
  } else {
    view = <Study cards={screen.cards} onAnswer={answer} onExit={() => go({ name: "stack" })} />;
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
