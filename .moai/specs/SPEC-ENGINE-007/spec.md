# SPEC-ENGINE-007: Web Worker

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P1 (High)
## Dependencies: SPEC-ENGINE-001 through SPEC-ENGINE-006

---

## 1. Overview

Implement the Web Worker entry point that runs the game engine off the main thread. Supports both interactive mode (with artificial delays for UX) and headless batch mode (for calibration/simulation). Defines the message protocol between main thread and worker.

## 2. Requirements (EARS Format)

### R1: Worker Entry Point
**The system shall** provide `engine.worker.ts` that runs the complete game engine in a Web Worker context, preventing UI thread blocking.

### R2: Message Protocol
**The system shall** define a typed message protocol:
- Main → Worker: START_GAME, PLAYER_ACTION, RESUME_GAME
- Worker → Main: GAME_EVENT, STATE_UPDATE, GAME_ERROR, AI_THINKING

### R3: Interactive Mode
**When** running in interactive mode, **the system shall**:
- Add artificial delay (0.3~1.5s) before AI actions for natural feel
- Emit AI_THINKING messages during delay
- Wait for PLAYER_ACTION from main thread for human player turns

### R4: Batch/Headless Mode
**When** running in batch mode, **the system shall**:
- Run without UI delays (pure math, no artificial wait)
- Target: full hand < 5ms, 10K hands < 60s, 1K SNG < 10min
- Return only final results (no per-event UI updates)

### R5: Error Isolation
**When** an error occurs in the worker, **the system shall** emit a GAME_ERROR message to the main thread with error details, without crashing the worker.

### R6: State Serialization
**The system shall** serialize all messages as structured-cloneable objects (no functions, no class instances) for postMessage transfer.

## 3. Acceptance Criteria

- [ ] AC1: Worker starts and processes START_GAME message
- [ ] AC2: Game events are emitted back to main thread in correct order
- [ ] AC3: Human player turn pauses until PLAYER_ACTION received
- [ ] AC4: AI actions include configurable delay in interactive mode
- [ ] AC5: Batch mode: 10K hands complete within 60s
- [ ] AC6: Worker errors don't crash — GAME_ERROR message sent instead
- [ ] AC7: All messages are structured-cloneable (no serialization errors)

## 4. Files to Create

```
src/engine/engine.worker.ts       - Worker entry point
src/engine/worker-protocol.ts     - Message type definitions
src/store/worker-bridge.ts        - Main thread ↔ Worker bridge (stub)
tests/engine/worker.test.ts       - Worker message protocol tests
```

## 5. Design Doc Reference

- Section 2.1: Module Overview (engine.worker.ts)
- Section 10.1: Performance — Interactive Path
- Section 10.2: Performance — Batch Path
