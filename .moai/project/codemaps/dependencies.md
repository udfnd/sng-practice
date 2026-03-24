# Dependency Map

## Internal Module Dependencies

### Engine Layer

```
orchestrator.ts
├── state-machine.ts
├── tournament.ts
├── betting.ts
│   └── action-order.ts
├── pot.ts
├── showdown.ts
│   └── evaluator.ts
├── deck.ts
│   ├── card.ts
│   └── prng.ts
├── seat-resolver.ts
├── stats-tracker.ts
├── events.ts
├── event-formatter.ts
└── event-reducer.ts

replay.ts
└── event-reducer.ts
```

### AI Layer

```
action-selector.ts
├── preflop.ts
│   ├── hand-ranges.ts
│   ├── position.ts
│   ├── nash-tables.ts
│   ├── presets.ts
│   └── icm.ts
└── postflop.ts
    ├── board-texture.ts
    ├── board-cluster.ts
    ├── hand-classifier.ts
    ├── spr.ts
    ├── strategy-key.ts
    └── presets.ts

blueprint.ts
├── presets.ts
└── strategy-key.ts

calibration.ts
└── presets.ts
```

### Storage Layer

```
hand-history-store.ts
├── indexed-db.ts
├── envelope.ts
└── serialization.ts

session-store.ts
├── indexed-db.ts
├── envelope.ts
└── serialization.ts

config-store.ts
└── local-storage.ts

export-import.ts
├── hand-history-store.ts
└── serialization.ts
```

### Store Layer (Main Thread)

```
game-store.ts
├── worker-manager.ts        (engine, main-thread side)
│   └── worker-protocol.ts
└── [TypeScript types]
```

### Component Layer

```
App.tsx
├── SetupScreen
│   └── PresetSelector
├── TopBar
├── TableArea
│   ├── PokerTable
│   ├── PlayerSeat
│   │   ├── PlayingCard
│   │   └── PlayerStats
│   └── ActionPanel
└── SidePanel
│   └── ResultsScreen (conditional)

All components → game-store.ts (Zustand selectors)
```

---

## Cross-Layer Dependencies

| Consumer | Dependency | Note |
|----------|-----------|------|
| `orchestrator.ts` | `action-selector.ts` | Engine calls AI for each AI seat's action |
| `orchestrator.ts` | `stats-tracker.ts` | Engine updates stats after each action |
| `game-store.ts` | `worker-manager.ts` | Store receives state updates from Worker |
| `game-store.ts` | `hand-history-store.ts` | Store persists completed hands after HAND_COMPLETE |
| `game-store.ts` | `session-store.ts` | Store saves tournament snapshot on pause/close |
| `SetupScreen` | `config-store.ts` | Loads/saves configuration on the main thread |

---

## External Package Dependencies (by Module)

### Engine

| Package | Used By | Purpose |
|---------|---------|---------|
| (none — vanilla TS) | all engine modules | Engine has zero runtime npm dependencies |

### AI

| Package | Used By | Purpose |
|---------|---------|---------|
| (none — vanilla TS) | all ai modules | AI logic is self-contained |

### Storage

| Package | Used By | Purpose |
|---------|---------|---------|
| `idb` (optional) | `indexed-db.ts` | Promise-based IndexedDB wrapper (if used) |

### Store

| Package | Used By | Purpose |
|---------|---------|---------|
| `zustand` | `game-store.ts` | State management |
| `immer` | `game-store.ts` | Immutable state updates |

### Components

| Package | Used By | Purpose |
|---------|---------|---------|
| `react` | all components | UI framework |
| `react-dom` | `main.tsx` | DOM rendering |
| `zustand` | all components | Store selectors |
| `tailwindcss` | all components | Utility CSS |

### Build / Dev

| Package | Purpose |
|---------|---------|
| `vite` | Build tool and dev server |
| `typescript` | Type checking |
| `@types/react` | React type definitions |

---

## Circular Dependency Analysis

No circular dependencies are expected given the strict layering:

```
components → store → engine/ai (Worker) → (no upward references)
                  → storage
```

Potential risk areas:

- `blueprint.ts` ↔ `presets.ts`: `blueprint.ts` reads preset parameters. `presets.ts` is a pure data module with no imports — safe.
- `event-reducer.ts` and `events.ts`: `event-reducer.ts` imports event type definitions from `events.ts`. `events.ts` does not import `event-reducer.ts` — safe.
- `export-import.ts` importing `hand-history-store.ts`: This is a one-way dependency; `hand-history-store.ts` does not import `export-import.ts` — safe.

**Recommendation**: Add a circular dependency lint rule (e.g., `eslint-plugin-import/no-cycle`) to enforce these boundaries as the codebase grows.
