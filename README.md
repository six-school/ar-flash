# Arabic Flashcards

Vite + React + TypeScript + Tailwind + Motion. Installable and usable offline (PWA).

## Run and build

```sh
npm install
npm run dev      # local development server
npm run build    # type-check and build into dist/
npm run preview  # serve the built dist/ locally
npm run lint     # Oxlint (type-aware), fails on any warning
npm run format   # Prettier, print width 100
```

Deploy the contents of `dist/` to any static host over HTTPS. Paths are relative, so it also works from a subfolder.

## Vocabulary

`public/vocabulary.json` is copied to `dist/` as-is and fetched at runtime, so you can edit it on the server without rebuilding. The service worker fetches it network-first, so installed copies pick up changes whenever they're online and use the cached copy offline.

## Progress

Results are stored in `localStorage` under `flashcards-progress-v1`, per stack and per card id:

```json
{ "en-ar": { "12": { "remembered": 2, "forgotten": 1 } }, "ar-en": {} }
```

Score = remembered − 2 × forgotten. Sessions start with the lowest scores, shuffled within each score.

## Files

- `src/store.ts`: types, progress storage, scoring and session order
- `src/screens.tsx`: top bar and icons, stack list, stack screen
- `src/study.tsx`: study session, flip/swipe card, text fitting
- `src/App.tsx`: screen navigation and transitions
