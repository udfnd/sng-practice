# Entry Points

## Application Entry Points

### `src/main.tsx` — Browser Entry Point

The Vite bundle entry point. Responsibilities:
- Mounts the React application into `#root` DOM element
- Wraps the app in `React.StrictMode`
- Imports global Tailwind CSS

No game logic runs here. This file exists solely to bootstrap React.

### `src/App.tsx` — React Root Component

The first stateful component. Responsibilities:
- Reads `isPlaying` from `game-store.ts`
- Conditionally renders `SetupScreen` (pre-game) or the live table layout (`TopBar` + `TableArea` + `SidePanel`)
- Acts as the router for the two main application views

Key selector:
```
const isPlaying = useGameStore(state => state.isPlaying)
```

---

## Web Worker Entry Point

### `src/engine/game-worker.ts` — Worker Entry Point

Registered by Vite as a separate Worker bundle. Responsibilities:
- Registers `self.onmessage` to receive typed `WorkerMessage` objects
- Delegates all messages to `orchestrator.ts`
- Posts `WorkerStateUpdate` messages back to the main thread

This file is the only file that references `self` (the Worker global). It must not import anything from `src/components/` or `src/store/`.

**Worker message handler signature:**
```
self.onmessage = (event: MessageEvent<WorkerMessage>) => { ... }
```

---

## Worker Lifecycle Entry Point

### `src/engine/worker-manager.ts` — Worker Lifecycle (Main Thread)

The main-thread counterpart to `game-worker.ts`. Responsibilities:
- `start(config)`: spawns a new Worker instance with initial configuration
- `stop()`: terminates the Worker
- `restart(config)`: stop + start sequence (used on new game)
- `send(message)`: typed `postMessage` wrapper
- Registers `onmessage` on the Worker to pipe state updates into `game-store.ts`

---

## Key Function Entry Points

### Game Start

```
SetupScreen → user clicks "Start Game"
  → game-store.ts: startGame(config)
    → worker-manager.ts: start(config)
      → game-worker.ts: self.onmessage receives START_GAME
        → orchestrator.ts: startGame(config)
```

### Human Action Submission

```
ActionPanel → user clicks Fold/Call/Raise
  → game-store.ts: submitAction(action)
    → worker-manager.ts: send({ type: 'PLAYER_ACTION', action })
      → game-worker.ts: self.onmessage receives PLAYER_ACTION
        → orchestrator.ts: handlePlayerAction(action)
          → betting.ts: resolveAction(action)
```

### AI Action Decision

```
orchestrator.ts: it is an AI seat's turn
  → action-selector.ts: selectAction(gameState, seatIndex)
    → preflop.ts OR postflop.ts
      → returns Action { type, amount }
  → betting.ts: resolveAction(aiAction)
```

### State Update to UI

```
orchestrator.ts: state changes
  → self.postMessage({ type: 'STATE_UPDATE', state }) [throttled 100ms]
    → worker-manager.ts: onmessage handler
      → game-store.ts: applyWorkerUpdate(state)
        → React components: re-render via Zustand selectors
```

### Hand Completion and Persistence

```
orchestrator.ts: HAND_COMPLETE phase reached
  → events.ts: creates HandCompleteEvent
  → game-worker.ts: posts HAND_COMPLETE message with event log
    → game-store.ts: receives HAND_COMPLETE
      → hand-history-store.ts: saveHand(events)  [IndexedDB]
      → session-store.ts: saveSnapshot(tournament) [IndexedDB]
```

### Tournament End

```
orchestrator.ts: tournament.isFinished() returns true
  → self.postMessage({ type: 'TOURNAMENT_END', standings })
    → game-store.ts: setStandings(standings), setIsPlaying(false)
      → App.tsx: isPlaying === false
        → ResultsScreen renders
```

---

## Storage Entry Points

| Entry Point | Trigger | Storage Target |
|-------------|---------|---------------|
| `config-store.ts: load()` | `SetupScreen` mount | LocalStorage |
| `config-store.ts: save(config)` | User changes settings | LocalStorage |
| `hand-history-store.ts: saveHand(events)` | HAND_COMPLETE event | IndexedDB |
| `session-store.ts: saveSnapshot(t)` | Each hand complete | IndexedDB |
| `session-store.ts: loadSnapshot()` | App start (resume check) | IndexedDB |
| `export-import.ts: exportToFile()` | User clicks Export | File download |
| `export-import.ts: importFromFile(file)` | User clicks Import | IndexedDB |
