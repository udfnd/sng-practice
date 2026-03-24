# holdem-sng — Project Structure

## Directory Tree

```
sng-practice/
├── src/
│   ├── ai/                  # AI decision logic (15 modules)
│   ├── engine/              # Core game engine (20 modules)
│   ├── storage/             # Persistence layer (8 modules)
│   ├── store/               # Zustand global state (1 module)
│   ├── simulation/          # Batch simulation and calibration (3 modules)
│   ├── components/          # React UI components (11 components)
│   ├── types/               # Shared TypeScript type definitions
│   ├── utils/               # Utility functions
│   └── styles/              # Global CSS
├── .moai/                   # MoAI-ADK project metadata
│   ├── config/              # Agent and workflow configuration
│   ├── design/              # Design artifacts
│   ├── docs/                # Generated documentation
│   ├── project/             # Product, structure, and tech overview docs
│   ├── specs/               # SPEC-driven requirement documents
│   └── state/               # Workflow state and checkpoints
├── public/                  # Static assets served by Vite
├── holdem_sng_design_doc_v4.2_final.docx  # Authoritative design document
├── vite.config.ts           # Vite build configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript compiler options
└── package.json             # Dependencies and scripts
```

---

## Source Directory Breakdown

### `src/ai/` — AI Decision Logic

Contains all logic for AI opponent behavior. Modules are composable: higher-level modules call lower-level ones.

| Module | Responsibility |
|---|---|
| `action-selector` | Top-level dispatcher: chooses the final action given context |
| `preflop` | Preflop range construction and action selection |
| `postflop` | Postflop bet sizing and action selection |
| `hand-ranges` | Hand range definitions keyed by position and situation |
| `position` | Position encoding (UTG through BTN/SB/BB) |
| `board-texture` | Board wetness, connectivity, and pair classification |
| `board-cluster` | Clusters boards into strategic categories |
| `spr` | Stack-to-Pot Ratio calculations driving postflop logic |
| `icm` | ICM equity calculations for payout-adjusted decisions |
| `nash-tables` | Pre-computed Nash equilibrium push/fold lookup tables |
| `hand-classifier` | Classifies made hands and draws on a given board |
| `blueprint` | Strategy blueprint linking situation to action frequencies |
| `strategy-key` | Generates lookup keys for strategy table queries |
| `presets` | Defines the 6 AI personality presets and their parameters |
| `calibration` | Adjusts AI frequency parameters based on simulation feedback |

### `src/engine/` — Core Game Engine

The game engine runs entirely inside a Web Worker. It manages tournament state, card dealing, betting, and action ordering.

| Module | Responsibility |
|---|---|
| `orchestrator` | Top-level coordinator that drives the game loop |
| `state-machine` | Manages transitions through 5 preflop and postflop betting states |
| `tournament` | Blind schedule, level progression, and prize structure |
| `game-worker` | Web Worker entry point; receives messages and dispatches to engine |
| `worker-manager` | Main-thread interface to spawn, communicate with, and terminate the worker |
| `worker-protocol` | Type-safe message schema between main thread and worker |
| `betting` | Validates bets, raises, and all-ins; enforces minimum raise rules |
| `action-order` | Determines player action order by position and street |
| `pot` | Pot and side-pot calculation logic |
| `seat-resolver` | Maps seat indices to player roles (dealer, SB, BB) |
| `showdown` | Evaluates and ranks hands; awards pots |
| `deck` | Card deck representation and shuffle |
| `card` | Card value/suit encoding |
| `evaluator` | Fast 7-card hand strength evaluator |
| `prng` | xoshiro256** seedable PRNG for deterministic card dealing |
| `stats-tracker` | Accumulates per-player statistics (VPIP, PFR, etc.) |
| `events` | Event type definitions for the event-sourced log |
| `event-formatter` | Converts raw events to human-readable strings |
| `event-reducer` | Rebuilds game state from an event log (replay) |
| `replay` | Orchestrates step-by-step hand replay |

### `src/storage/` — Persistence Layer

Handles all data persistence using IndexedDB as the primary store with a local-storage fallback for configuration.

| Module | Responsibility |
|---|---|
| `hand-history-store` | Stores up to 1000 hands in IndexedDB (FIFO eviction) |
| `session-store` | Saves and restores session snapshots for resume capability |
| `config-store` | Persists user configuration (AI presets, table settings) |
| `envelope` | Wraps stored objects with metadata (timestamp, version) |
| `serialization` | JSON serialization helpers with type safety |
| `local-storage` | Key-value wrapper around `window.localStorage` |
| `indexed-db` | Low-level IndexedDB abstraction (open, read, write, delete) |
| `export-import` | JSON export and import of hand history and configuration |

### `src/store/` — Zustand State

| Module | Responsibility |
|---|---|
| `game-store` | Single Zustand store combining game state slices with Immer middleware for immutable updates |

### `src/simulation/` — Batch Simulation

| Module | Responsibility |
|---|---|
| `batch-runner` | Runs N simulated hands programmatically for AI calibration |
| `calibration-report` | Aggregates simulation results into statistical summaries |
| `determinism-checker` | Runs the same seed twice and asserts identical outcomes |

### `src/components/` — React UI

| Component | Responsibility |
|---|---|
| `App` | Root component; renders SetupScreen, game table, or ResultsScreen based on phase |
| `SetupScreen` | Game configuration UI (stack sizes, AI presets, blind structure) |
| `TableArea` | Container for the poker table canvas and overlays |
| `PokerTable` | SVG/CSS poker table layout with seat positioning |
| `PlayerSeat` | Individual seat rendering (stack, cards, action indicator) |
| `PlayingCard` | Card face/back rendering with suit and rank |
| `TopBar` | Tournament info bar (level, blinds, antes, pot) |
| `ActionPanel` | Hero action controls (fold/call/raise with sizing slider) |
| `SidePanel` | Live statistics panel (hand history, session stats) |
| `ResultsScreen` | End-of-session summary with placement and statistics |
| `PlayerStats` | Per-player stat display (VPIP, PFR, 3-bet %) |
| `PresetSelector` | Dropdown for assigning AI personality presets to seats |

### `src/types/` — Type Definitions

`index.ts` (335 lines) is the single source of truth for all shared types including `Card`, `Player`, `GameState`, `Action`, `Event`, `HandHistory`, `SessionSnapshot`, `AIPreset`, and tournament configuration interfaces.

### `src/utils/`

`format-chips.ts` — Formats chip counts for display (e.g., `1500` → `1.5K`).

---

## Component Tree Hierarchy

```
App
├── SetupScreen
│   └── PresetSelector (per seat)
├── TableArea
│   ├── TopBar
│   ├── PokerTable
│   │   └── PlayerSeat (×8)
│   │       └── PlayingCard (×2 for hero)
│   ├── ActionPanel
│   └── SidePanel
│       └── PlayerStats (×8)
└── ResultsScreen
    └── PlayerStats (×8)
```

---

## Module Organization and Relationships

```
components/App
    └── store/game-store (Zustand)
            ├── engine/worker-manager  ←→  engine/game-worker (Web Worker)
            │       └── engine/orchestrator
            │               ├── engine/state-machine
            │               ├── engine/tournament
            │               ├── engine/betting / pot / action-order
            │               ├── engine/deck / card / prng
            │               ├── engine/evaluator / showdown
            │               ├── engine/events / event-reducer / replay
            │               ├── engine/stats-tracker
            │               └── ai/action-selector
            │                       ├── ai/preflop / postflop
            │                       ├── ai/hand-ranges / position
            │                       ├── ai/board-texture / board-cluster
            │                       ├── ai/spr / icm / nash-tables
            │                       ├── ai/hand-classifier / blueprint
            │                       ├── ai/strategy-key / presets
            │                       └── ai/calibration
            └── storage/
                    ├── hand-history-store
                    ├── session-store
                    └── config-store
```

---

## Architecture Pattern Description

**Event Sourcing**: Every game action (deal, bet, fold, showdown) is appended as an immutable event to a log. Game state is derived by reducing over this log. This enables deterministic replay, debugging, and hand history export.

**State Machine**: The preflop and postflop betting rounds are modeled as explicit state transitions. The engine refuses invalid transitions, enforcing game rule correctness at compile time via discriminated union types.

**Web Worker Offloading**: The entire game engine runs in a dedicated Web Worker to keep the main thread free for UI rendering. Communication uses a typed message protocol (`worker-protocol.ts`), preventing untyped `postMessage` calls.

**Zustand + Immer**: Global UI state lives in a single Zustand store. Immer middleware allows writing mutating-style update logic while producing immutable state snapshots, simplifying reducer code.

**Seedable PRNG**: All randomness flows through the xoshiro256** generator seeded at session start. This makes any session fully reproducible from its seed, supporting the batch simulation and determinism-checking workflows.
