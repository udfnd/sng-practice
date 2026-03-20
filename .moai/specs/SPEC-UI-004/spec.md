# SPEC-UI-004: Game Flow & Zustand Store

## Status: Draft
## Phase: 3 (UI)
## Priority: P0 (Critical)
## Dependencies: SPEC-UI-001 through SPEC-UI-003, SPEC-ENGINE-007

---

## 1. Overview

Implement the Zustand store with immer middleware for game state management, the Worker bridge for main thread ↔ Web Worker communication, game flow orchestration (new game → play → complete), and deal/bet/showdown animations.

## 2. Requirements (EARS Format)

### R1: Zustand Store
**The system shall** manage game state via Zustand with immer middleware:
- TournamentState (current game state)
- UI state (selected action, animation state, sidebar tab)
- Settings (tournament config, AI presets)
- Read-only game state derived from worker events

### R2: Worker Bridge
**The system shall** bridge the main thread and Web Worker:
- Send: START_GAME, PLAYER_ACTION, RESUME_GAME
- Receive: GAME_EVENT, STATE_UPDATE, AI_THINKING, GAME_ERROR
- Auto-reconnect on worker crash
- Typed message handlers

### R3: Game Flow
**The system shall** orchestrate the game lifecycle:
1. New Game: Create tournament config → send START_GAME to worker
2. Play: Receive events → update store → render UI → wait for human action
3. AI Turn: Show thinking indicator → receive AI action event → animate
4. Hand Complete: Show results → auto-advance to next hand (with delay)
5. Tournament End: Show final standings and payouts

### R4: Deal Animation
**The system shall** animate card dealing:
- Hole cards dealt one at a time with stagger
- Community cards revealed with flip animation
- Configurable animation speed

### R5: Bet Animation
**The system shall** animate betting:
- Chips moving from player stack to bet area
- Pot collection animation (street end)
- Pot award animation (showdown)

### R6: Showdown Animation
**The system shall** animate showdown:
- Cards flipping face-up in reveal order
- Best hand highlighted
- Winner announcement with pot amount

### R7: AI Thinking Delay
**When** an AI player is deciding, **the system shall**:
- Show a thinking indicator (dots animation or timer)
- Delay 0.3~1.5s before showing the action (configurable)

### R8: Auto-Deal
**When** a hand completes, **the system shall** automatically start the next hand after a configurable delay (default 2s), unless the tournament is complete.

## 3. Acceptance Criteria

- [ ] AC1: Zustand store initializes with correct default state
- [ ] AC2: Worker bridge sends START_GAME and receives events
- [ ] AC3: Human action dispatched via PLAYER_ACTION message
- [ ] AC4: Game events update store → UI re-renders automatically
- [ ] AC5: Deal animation plays for hole cards and community cards
- [ ] AC6: Pot collection animates at street end
- [ ] AC7: Showdown reveals cards in correct order with highlight
- [ ] AC8: AI thinking delay visible between 0.3~1.5s
- [ ] AC9: Auto-deal starts next hand after 2s delay
- [ ] AC10: Tournament end shows standings and payouts

## 4. Files to Create

```
src/store/game-store.ts        - Zustand store definition
src/store/worker-bridge.ts     - Worker ↔ main thread bridge
src/store/actions.ts           - Store action creators
src/hooks/useGameState.ts      - Custom hooks for game state
src/components/animation/      - Animation components (deal, bet, showdown)
tests/store/game-store.test.ts - Store tests
tests/store/worker-bridge.test.ts - Bridge message tests
```

## 5. Design Doc Reference

- Section 1.3: Tech Stack (Zustand)
- Section 9.1: Layout (interactions)
- Section 10.1: Performance (frame rate, AI delay)
