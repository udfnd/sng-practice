# Module Reference

## Directory Structure

```
src/
├── engine/       # Core game engine (20 modules)
├── ai/           # AI decision engine (15 modules)
├── storage/      # Persistence layer (8 modules)
├── store/        # Zustand state management (1 module)
├── simulation/   # Testing and calibration (3 modules)
└── components/   # React UI (11 components)
```

---

## src/engine/ — Core Game Engine

Owns all rules-level game logic. Runs entirely inside the Web Worker.

| Module | Responsibility |
|--------|---------------|
| `orchestrator.ts` | Top-level game loop. Sequences phases (deal → bet → evaluate) and dispatches engine sub-modules. The single entry point for Worker message handling. |
| `state-machine.ts` | Enforces `GamePhase` transitions. Accepts phase-change requests and validates them against the allowed transition table. |
| `tournament.ts` | Blind schedule progression, player elimination detection, and payout distribution at tournament end. |
| `game-worker.ts` | Web Worker entry point. Registers `self.onmessage` and delegates to orchestrator. |
| `worker-manager.ts` | Main-thread side: spawns, stops, and restarts the Worker; owns the Worker reference. |
| `worker-protocol.ts` | Shared typed message definitions for main↔Worker communication (action requests, state updates, error messages). |
| `betting.ts` | Betting round state machine: tracks who has acted, resolves all-ins, detects round completion. |
| `action-order.ts` | Computes seat-ordered action sequence based on position and street. Calculates valid actions (fold/call/raise) for the active player. |
| `pot.ts` | Pot arithmetic: accumulates bets, splits side pots for all-in scenarios, returns uncalled amounts. |
| `seat-resolver.ts` | Assigns Button/SB/BB seats at hand start and rotates them each hand. |
| `showdown.ts` | Determines winners by comparing evaluated hands, handles split-pot scenarios. |
| `deck.ts` | Shuffles and deals cards using the PRNG. |
| `card.ts` | Immutable card value object (rank 2–A, suit ♠♥♦♣). |
| `evaluator.ts` | Hand strength evaluator using the Cactus Kev lookup table. Returns a numeric rank comparable across all hand categories. |
| `prng.ts` | Seedable xoshiro256** pseudo-random number generator for deterministic replay. |
| `stats-tracker.ts` | Accumulates per-player statistics: VPIP, PFR, 3-bet frequency, c-bet frequency. |
| `events.ts` | Factory functions that construct typed game events (DealEvent, BetEvent, etc.). |
| `event-formatter.ts` | Converts raw events into human-readable English strings for the action log. |
| `event-reducer.ts` | Pure reducer: folds an ordered event list into a `GameState` snapshot. Enables replay and time-travel debugging. |
| `replay.ts` | High-level replay controller: loads a stored hand's events and steps through them at configurable speed. |

**Public interface to other modules**: Only `orchestrator.ts` and `worker-protocol.ts` are consumed outside the engine. All other modules are engine-internal.

---

## src/ai/ — AI Decision Engine

Provides action decisions for all AI-controlled seats. Runs inside the Web Worker.

| Module | Responsibility |
|--------|---------------|
| `action-selector.ts` | Top-level dispatcher. Inspects current street and routes to `preflop.ts` or `postflop.ts`. |
| `preflop.ts` | 5-situation preflop state machine: open, call, 3-bet, face-3-bet, and short-stack push/fold. |
| `postflop.ts` | Flop/turn/river decisions using board texture, SPR, and hand classification. |
| `hand-ranges.ts` | 169 canonical starting hands mapped to position-adjusted opening percentiles. |
| `position.ts` | Classifies seat index into position groups: EP, MP, CO, BTN, SB, BB. |
| `board-texture.ts` | Categorizes a 3–5 card board as dry, wet, paired, or connected. Used by `postflop.ts` to adjust aggression. |
| `board-cluster.ts` | Equity clustering: groups board runouts into a small set of texture archetypes for postflop lookups. |
| `spr.ts` | Stack-to-Pot Ratio calculations used to calibrate commitment thresholds. |
| `icm.ts` | Independent Chip Model equity adjustments. Scales raw EV by tournament payouts and chip values. |
| `nash-tables.ts` | Precomputed Nash equilibrium push/fold tables keyed by effective stack size (in big blinds). |
| `hand-classifier.ts` | Classifies current hand strength: made hand category, draw type, and relative strength vs range. |
| `blueprint.ts` | Exploitative adjustment layer: detects player tendencies from `stats-tracker.ts` and overrides base strategy. |
| `strategy-key.ts` | Encodes/decodes a compact strategy context string (street + position + board + stack) for table lookups. |
| `presets.ts` | 6 AI personality profiles (e.g., Tight-Passive, LAG) with parameter overrides applied to the strategy engine. |
| `calibration.ts` | Ring-game-to-tournament scaling factors applied to strategy parameters. |

**Public interface**: Only `action-selector.ts` is called by `orchestrator.ts`. All other modules are AI-internal.

---

## src/storage/ — Persistence Layer

Handles all data persistence. Runs on the main thread (accessed by `game-store.ts`).

| Module | Responsibility |
|--------|---------------|
| `hand-history-store.ts` | IndexedDB store: saves completed hand event logs. Enforces a 1000-hand FIFO rolling window. |
| `session-store.ts` | Persists tournament snapshot (chip counts, blinds, standings) to allow browser-close resume. |
| `config-store.ts` | Saves game configuration (table size, blind structure, AI presets) to localStorage. |
| `envelope.ts` | `StorageEnvelope<T>` wrapper adding schema version and timestamp to any stored object. |
| `serialization.ts` | Type-safe JSON serialization helpers (date revival, enum coercion, unknown validation). |
| `local-storage.ts` | Thin typed wrappers around `window.localStorage` with error boundaries. |
| `indexed-db.ts` | Low-level IndexedDB open/upgrade/transaction helpers used by `hand-history-store` and `session-store`. |
| `export-import.ts` | Serializes the full hand history to a JSON file for download; parses an imported file back into IndexedDB. |

---

## src/store/ — Zustand State Bridge

| Module | Responsibility |
|--------|---------------|
| `game-store.ts` | Single Zustand store with Immer middleware. Holds `gameState`, `isPlaying`, `standings`, and `actionLog`. Consumes Worker messages via `worker-manager.ts`. Exposes typed selectors used by React components. |

This module is the sole communication boundary between the Worker and the React component tree.

---

## src/simulation/ — Testing and Calibration

Used during development and tuning; not loaded in the production bundle.

| Module | Responsibility |
|--------|---------------|
| `batch-runner.ts` | Runs multiple complete SNG simulations headlessly to generate statistical samples. |
| `calibration-report.ts` | Aggregates batch results into win-rate, VPIP/PFR stats, and payout-distribution reports. |
| `determinism-checker.ts` | Runs the same seed twice and asserts bit-identical results, verifying the PRNG and engine are deterministic. |

---

## src/components/ — React UI

All components consume state exclusively from `game-store.ts` via Zustand selectors.

| Component | Responsibility |
|-----------|---------------|
| `App.tsx` | Root component. Renders either `SetupScreen` or (`TopBar` + `TableArea` + `SidePanel`) based on `isPlaying`. |
| `SetupScreen` | Pre-game configuration: player count, blind structure, AI preset selection, no-limp toggle. |
| `TableArea` | Positions and renders the oval poker table with seats, community cards, and pot display. |
| `PokerTable` | SVG/Canvas poker table surface (felt, board card area, pot label). |
| `PlayerSeat` | Individual seat: avatar, chip count, hole cards, dealer button indicator, and action overlay. |
| `PlayingCard` | Single card visual with rank/suit rendering and face-down state. |
| `TopBar` | Persistent header: blind level, hand count, tournament clock, and settings access. |
| `ActionPanel` | Human player action buttons (Fold, Check, Call, Raise). Renders only on the human's turn. |
| `SidePanel` | Live action log, pot odds, and per-player statistics panel. |
| `ResultsScreen` | Post-tournament screen: final standings, payout amounts, and session stats summary. |
| `PlayerStats` | Detailed HUD overlay showing VPIP, PFR, 3-bet, and c-bet for a selected seat. |
| `PresetSelector` | Dropdown component for choosing AI personality presets during setup or mid-tournament. |
