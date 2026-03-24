# holdem-sng — Technology Stack

## Technology Stack Overview

| Category | Technology | Version |
|---|---|---|
| UI Framework | React | 18.3.1 |
| Language | TypeScript | 5.7.3 |
| State Management | Zustand | 5.0.3 |
| Immutable Updates | Immer | 10.1.1 |
| Build Tool | Vite | 6.0.7 |
| Styling | Tailwind CSS | 3.4.17 |
| Test Runner | Vitest | 3.0.4 |
| Component Testing | React Testing Library | 16.2.0 |
| Linter | ESLint | 9.18.0 |
| TypeScript Linting | typescript-eslint | 8.22.0 |
| IndexedDB Mock | fake-indexeddb | 6.2.5 |
| Test DOM | jsdom | (via Vitest config) |

---

## Framework Choices with Rationale

### React 18.3.1
React provides a component model well-suited to a stateful game UI with many independent sub-views (seats, cards, action panel). React 18's concurrent rendering features enable smooth UI updates while the game engine processes actions asynchronously on a Web Worker.

### TypeScript 5.7.3
The game domain has a rich type hierarchy (cards, actions, events, player states). TypeScript's discriminated unions and strict null checks catch entire classes of game-logic bugs at compile time — for example, preventing invalid state machine transitions or accessing undefined player slots.

### Zustand 5.0.3 + Immer 10.1.1
Zustand was chosen over Redux for its minimal boilerplate and direct hook-based API. A single store slice covers game state without requiring action creators or reducers. Immer middleware is added to allow writing mutating-style logic inside store updates, which is significantly more readable for complex nested game state modifications.

### Vite 6.0.7
Vite provides near-instant hot module replacement during development and optimized production bundles via Rollup. It has first-class support for Web Workers (`new Worker(new URL(...), { type: 'module' })`), which is essential for the off-thread game engine pattern.

### Tailwind CSS 3.4.17
Tailwind enables rapid UI iteration with utility classes directly in JSX, eliminating context-switching between component files and stylesheets. The dark-mode variant (`dark:`) is used throughout for the poker table aesthetic.

### Vitest 3.0.4
Vitest shares the Vite configuration and transformation pipeline, eliminating the need for a separate Jest config or Babel setup. The jsdom environment provides a DOM implementation for component tests without a real browser.

### fake-indexeddb 6.2.5
The storage layer uses IndexedDB for hand history persistence. `fake-indexeddb` provides a fully in-memory implementation of the IndexedDB API for use in Vitest/jsdom tests, enabling storage layer tests without browser infrastructure.

---

## Development Environment Requirements

- **Node.js**: 20.x or later (LTS recommended)
- **npm**: 10.x or later (bundled with Node.js 20)
- **Browser**: Chromium-based browser recommended for development (Web Worker DevTools support)

### Setup

```bash
npm install
npm run dev        # Start Vite dev server at http://localhost:5173
```

---

## Build and Deployment Configuration

### Vite Configuration (`vite.config.ts`)

Key concerns addressed by Vite configuration:

- **Web Worker bundling**: The game worker entry point (`src/engine/game-worker.ts`) is bundled as a separate chunk to avoid blocking the main thread
- **TypeScript path aliases**: `@/` resolves to `src/` for clean import paths
- **Test environment**: `jsdom` environment with `globals: true` for Vitest

### Build Output

```bash
npm run build      # Outputs to dist/ (optimized static files)
npm run preview    # Preview production build locally
```

The output is a fully static site (HTML, JS, CSS) with no server-side runtime requirement. Deployment targets any static hosting platform (Vercel, Netlify, GitHub Pages, S3).

### TypeScript Configuration (`tsconfig.json`)

- `strict: true` — full strict mode including `noImplicitAny`, `strictNullChecks`
- `target: ES2022` — enables native class fields and top-level await
- `moduleResolution: bundler` — aligns with Vite's module resolution behavior
- `lib: ["ES2022", "DOM", "DOM.Iterable"]` — includes Web Worker and IndexedDB DOM APIs

---

## Testing Setup

### Test Runner: Vitest 3.0.4

Test files follow the `*.test.ts` / `*.test.tsx` naming convention and live alongside source files or in adjacent `__tests__/` directories.

```bash
npm run test           # Run all tests once
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Testing Layers

| Layer | Tool | Scope |
|---|---|---|
| Unit (pure logic) | Vitest | AI modules, engine utilities, storage serialization |
| Integration (engine) | Vitest + fake-indexeddb | Engine orchestrator, storage layer |
| Component (UI) | Vitest + React Testing Library | React components in jsdom |
| Simulation | Custom batch runner | AI calibration, determinism checking |

### Coverage

- **File ratio**: 51 test files / 62 source files (~82%)
- **Target**: Core engine and AI modules have the highest coverage priority; UI components have smoke tests

### Key Test Patterns

- **Determinism tests**: Run the same seed twice and assert identical event logs
- **State machine tests**: Assert valid and invalid transitions for each betting state
- **ICM tests**: Validate equity calculations against known reference values
- **Storage tests**: Use `fake-indexeddb` to test IndexedDB operations in Node.js

---

## Key Architectural Decisions

### Web Worker for Game Engine

The entire game engine (`src/engine/`) runs in a dedicated Web Worker. This prevents long-running AI computations (Nash table lookups, hand evaluation) from blocking UI rendering. The main thread communicates via a typed message protocol defined in `worker-protocol.ts`.

**Trade-off**: Worker isolation prevents direct state sharing; all communication is serialized message-passing. This is acceptable because game state snapshots are small (< 10KB JSON).

### Event Sourcing for Game State

All game actions are appended as immutable events. The current state is always derivable by replaying events from the beginning of the hand.

**Benefits**:
- Deterministic replay from any point
- Hand history export is the raw event log
- Debugging: inspect the exact sequence that produced any state

**Trade-off**: Slightly more complex than direct mutation; requires an `event-reducer` to reconstruct state for queries.

### IndexedDB for Hand History Persistence

IndexedDB was chosen over `localStorage` for structured storage of up to 1000 hands with FIFO eviction. This supports querying by date, filtering by outcome, and bulk export without hitting the 5MB `localStorage` limit.

### Seedable PRNG (xoshiro256**)

All randomness is channeled through a single seedable generator. The seed is stored in the session snapshot, making any session fully reproducible from its seed value alone. This is the foundation for the batch simulation and determinism-checking features.

### Immer for State Mutations

Direct mutation of deeply nested game state (e.g., updating a specific player's stack mid-hand) is error-prone with spread operators. Immer's `produce` function allows writing intuitive mutating code while producing immutable output, keeping store update functions readable.
