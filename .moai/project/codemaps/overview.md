# Architecture Overview

## Project Summary

**Project**: Texas Hold'em 8-Max SNG (Sit & Go) Practice Tool
**Codename**: holdem-sng
**Purpose**: Single-player practice tool simulating a full 8-player SNG tournament with AI opponents

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 18.x |
| Language | TypeScript | 5.7 |
| State Management | Zustand + Immer | latest |
| Build Tool | Vite | latest |
| Styling | Tailwind CSS | latest |
| Persistence | IndexedDB + LocalStorage | browser native |
| Concurrency | Web Worker | browser native |

## Design Patterns

### Event Sourcing
All game state changes are recorded as immutable events. The `event-reducer.ts` reconstructs current state from the event log, enabling replay, debugging, and undo functionality. Events are persisted to IndexedDB via `hand-history-store.ts`.

### State Machine
The game lifecycle is modeled as an explicit finite state machine in `state-machine.ts`. Legal phase transitions are enforced:

```
WAITING → DEALING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → HAND_COMPLETE
```

This prevents invalid state transitions and makes game flow auditable.

### Web Worker Isolation
The game engine runs in a dedicated Web Worker thread (`game-worker.ts`), separating CPU-intensive game logic from the React rendering thread. Communication happens via a typed message protocol (`worker-protocol.ts`), keeping the UI responsive even during complex AI calculations.

### Zustand + Immer State Management
The React layer uses a single Zustand store with Immer for immutable state updates. Components subscribe to specific slices via selectors, minimizing re-renders.

## System Boundaries

```
┌─────────────────────────────────────────────────────┐
│  Browser Main Thread                                 │
│  ┌─────────────┐    ┌──────────────────────────┐   │
│  │  React UI   │◄──►│  Zustand Store           │   │
│  │ Components  │    │  (game-store.ts)          │   │
│  └─────────────┘    └──────────┬───────────────┘   │
│                                │ worker-manager.ts   │
└────────────────────────────────┼────────────────────┘
                    postMessage  │  onmessage
┌────────────────────────────────▼────────────────────┐
│  Web Worker Thread                                   │
│  ┌──────────────────────────────────────────────┐   │
│  │  Game Engine (orchestrator.ts)               │   │
│  │  ├── state-machine.ts                        │   │
│  │  ├── betting.ts / pot.ts / showdown.ts       │   │
│  │  ├── ai/action-selector.ts                   │   │
│  │  └── tournament.ts                           │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│  Browser Storage                                     │
│  ├── IndexedDB (hand-history-store, session-store)  │
│  └── LocalStorage (config-store)                    │
└─────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### Why Web Worker?
Poker AI (especially ICM calculations and Nash equilibrium lookups) is CPU-intensive. Running it in the main thread would block the UI. The Worker keeps the 60fps render loop smooth.

### Why Event Sourcing?
Hand history replay is a core feature. With event sourcing, replaying a hand is trivial—just re-run the reducer over the stored events. It also simplifies debugging because state is fully derivable from the event log.

### Why Zustand over Redux?
Zustand has minimal boilerplate and integrates cleanly with Immer for immutable updates. The game state shape is relatively flat, so Redux's additional complexity is not warranted.

### Why IndexedDB over localStorage?
Hand history can grow large (up to 1000 hands). IndexedDB supports async reads, binary data, and significantly larger storage quotas than localStorage.

## Source Directory Summary

| Directory | Modules | Responsibility |
|-----------|---------|---------------|
| `src/engine/` | 20 | Core game logic, state machine, tournament management |
| `src/ai/` | 15 | AI decision engine, preflop/postflop strategy, ICM |
| `src/storage/` | 8 | Persistence layer (IndexedDB, localStorage, serialization) |
| `src/store/` | 1 | Zustand state bridge between Worker and React |
| `src/simulation/` | 3 | Batch testing and calibration utilities |
| `src/components/` | 11 | React UI components |
