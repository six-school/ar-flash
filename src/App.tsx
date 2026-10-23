import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type Entry, type StackId, sessionOrder, useProgress, useVocabulary } from "./store";
import { Splash, StackScreen } from "./screens";
import { Study } from "./study";

type Screen =
  | { name: "home" }
  | { name: "stack"; stack: StackId }
  | { name: "study"; stack: StackId; cards: Entry[] };

const depth = { home: 0, stack: 1, study: 2 } as const;

// Deeper screens slide in from the right; going back slides them out to the right.
const views = {
  enter: (dir: number) => ({ x: `${dir * 30}%`, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: `${dir * -30}%`, opacity: 0 }),
};

export default function App() {
  const { entries, error } = useVocabulary();
  const { progress, record } = useProgress();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [dir, setDir] = useState(1);

  const go = (next: Screen) => {
    setDir(Math.sign(depth[next.name] - depth[screen.name]) || 1);
    setScreen(next);
  };

  if (error) return <p className="p-6">Couldn’t load vocabulary.json.</p>;
  if (!entries) return null;

  let view;
  if (screen.name === "home") {
    view = (
      <Splash
        entries={entries}
        progress={progress}
        onOpen={(stack) => go({ name: "stack", stack })}
      />
    );
  } else if (screen.name === "stack") {
    const { stack } = screen;
    view = (
      <StackScreen
        stack={stack}
        entries={entries}
        progress={progress}
        onBack={() => go({ name: "home" })}
        onGo={() => go({ name: "study", stack, cards: sessionOrder(entries, progress, stack) })}
      />
    );
  } else {
    const { stack, cards } = screen;
    view = (
      <Study
        stack={stack}
        cards={cards}
        record={record}
        onExit={() => go({ name: "stack", stack })}
      />
    );
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
