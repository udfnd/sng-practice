# Data Flow

## Game Lifecycle

### Phase 1: Configuration

```
User input (SetupScreen)
  → config-store.ts (LocalStorage read/write)
  → game-store.ts.config (Zustand state)
```

Data shape: `GameConfig { playerCount, blindStructure, aiPresets, noLimp, seed? }`

---

### Phase 2: Game Start

```
game-store.ts: startGame(config)
  → worker-manager.ts: start(config)
    → new Worker(game-worker.ts) spawned
      → orchestrator.ts: initialize engine
        ├── seat-resolver.ts: assign seats
        ├── tournament.ts: set blind level 1
        ├── prng.ts: seed PRNG (config.seed or Date.now())
        └── post STATE_UPDATE to main thread
```

The Worker is a fresh JS context with no shared memory with the main thread. All data crosses the boundary via `postMessage` (structured clone).

---

### Phase 3: Hand Loop

Each hand cycles through these sub-phases:

```
orchestrator.ts: runHand()
  │
  ├─ DEALING
  │   ├── deck.ts: shuffle + deal 2 hole cards per seat
  │   ├── seat-resolver.ts: rotate button/blinds
  │   └── events.ts: DealEvent[]
  │
  ├─ PREFLOP / FLOP / TURN / RIVER (betting rounds)
  │   ├── action-order.ts: compute action sequence
  │   ├── For each active seat:
  │   │   ├── [AI seat] → action-selector.ts → returns Action
  │   │   └── [Human seat] → post REQUEST_ACTION to main thread
  │   │         ↑ waits for PLAYER_ACTION message from main thread
  │   ├── betting.ts: resolveAction(action)
  │   ├── pot.ts: update pot(s)
  │   └── stats-tracker.ts: update VPIP/PFR etc.
  │
  ├─ SHOWDOWN
  │   ├── evaluator.ts: rank each hand
  │   └── showdown.ts: determine winner(s), split pots
  │
  └─ HAND_COMPLETE
      ├── tournament.ts: eliminate busted players, advance blinds
      ├── events.ts: HandCompleteEvent
      └── post HAND_COMPLETE to main thread
```

State updates are throttled to 100ms intervals to avoid overwhelming the React render cycle.

---

### Phase 4: Tournament End

```
orchestrator.ts: tournament.isFinished() → true
  → post TOURNAMENT_END { standings, payouts }
    → game-store.ts: setStandings(), setIsPlaying(false)
      → App.tsx: renders ResultsScreen
```

---

## Request Lifecycle: Human Action

```
┌──────────────────────────────────────────────┐
│  Main Thread                                  │
│                                               │
│  ActionPanel.tsx                             │
│    onClick(action)                           │
│      → game-store.ts: submitAction(action)   │
│        → worker-manager.ts: send({           │
│            type: 'PLAYER_ACTION',            │
│            action: { type, amount }          │
│          })                                  │
└────────────────────────┬─────────────────────┘
           postMessage   │
┌────────────────────────▼─────────────────────┐
│  Worker Thread                                │
│                                               │
│  game-worker.ts: onmessage                   │
│    → orchestrator.ts: handlePlayerAction()   │
│      → betting.ts: resolveAction(action)     │
│        → pot.ts: addToPot(amount)            │
│        → stats-tracker.ts: recordAction()   │
│        → events.ts: create BetEvent          │
│      → state-machine.ts: maybeAdvancePhase() │
│      → [next seat's turn or new street]      │
│                                               │
│  [100ms throttle] → postMessage({            │
│      type: 'STATE_UPDATE', state             │
│    })                                        │
└────────────────────────┬─────────────────────┘
           postMessage   │
┌────────────────────────▼─────────────────────┐
│  Main Thread                                  │
│                                               │
│  worker-manager.ts: onmessage                │
│    → game-store.ts: applyWorkerUpdate(state) │
│      → Zustand: produce (Immer mutation)     │
│        → React components: re-render         │
│          (only components with changed       │
│           selector output re-render)         │
└──────────────────────────────────────────────┘
```

---

## State Management Pattern (Zustand + Immer)

`game-store.ts` uses Zustand's `create` with the `immer` middleware:

```
State shape:
{
  gameState: GameState | null      // live game snapshot from Worker
  isPlaying: boolean               // controls App routing
  standings: Standing[]            // set on TOURNAMENT_END
  actionLog: FormattedEvent[]      // for SidePanel display
  config: GameConfig               // from SetupScreen
}
```

Components subscribe via selectors:

```
// Only re-renders when gameState.pot changes
const pot = useGameStore(s => s.gameState?.pot)

// Only re-renders when standings array changes
const standings = useGameStore(s => s.standings)
```

This selector-based subscription means most components are unaffected by unrelated state changes, keeping renders minimal.

---

## Event Sourcing Flow

```
Game events generated in Worker:
  events.ts → event objects (immutable, serializable)
    ↓
  orchestrator.ts accumulates events per hand
    ↓
  HAND_COMPLETE message carries full event log
    ↓
  game-store.ts receives events
    ↓
  hand-history-store.ts persists to IndexedDB
    (max 1000 hands, FIFO eviction)
```

Replay path:

```
hand-history-store.ts: loadHand(handId)
  → event log retrieved from IndexedDB
    → replay.ts: step through events
      → event-reducer.ts: fold events → GameState snapshot at each step
        → UI renders the reconstructed state
```

The reducer is a pure function `(state, event) => state`, making replays deterministic and testable in isolation.

---

## Persistence Data Flow

```
                 ┌─ config-store.ts ─► LocalStorage
                 │    (sync, small, always-available)
                 │
game-store.ts ──-├─ hand-history-store.ts ─► IndexedDB
                 │    (async, up to 1000 hands, FIFO)
                 │
                 └─ session-store.ts ─► IndexedDB
                      (async, latest tournament snapshot)
```

On next browser open:

```
App.tsx mounts
  → session-store.ts: loadSnapshot()
    → if snapshot exists: offer "Resume Tournament" in SetupScreen
    → if none: start fresh
```
