# SPEC-POLISH-002: Hand History & Stats

## Status: Draft
## Phase: 4 (Polish)
## Priority: P2 (Medium)
## Dependencies: SPEC-POLISH-001, SPEC-UI-004

---

## 1. Overview

Implement the hand history viewer with event log display, player statistics dashboard (VPIP, PFR, 3-Bet, C-Bet, WTSD, W$SD), and deterministic replay UI allowing step-through of past hands.

## 2. Requirements (EARS Format)

### R1: Hand History List
**The system shall** display a list of past hands:
- Hand number, result (won/lost), pot size
- Players involved, winning hand
- Sortable and filterable
- Loaded from IndexedDB

### R2: Hand Detail View
**When** a hand is selected, **the system shall** show:
- Full action log (each player action in sequence)
- Community cards at each street
- Pot amounts at each street
- Final results (winner, pot awarded)

### R3: Player Statistics
**The system shall** display live and historical stats per player:
- VPIP% (vpipCount / handsEligible)
- PFR% (pfrCount / handsEligible)
- 3-Bet% (threeBetCount / threeBetOpportunities)
- C-Bet% (cBetCount / cBetOpportunities)
- WTSD% (wentToShowdown)
- W$SD% (wonAtShowdown / wentToShowdown)
- Hands played count

### R4: Stats Display
**The system shall** show stats in the side panel:
- Current tournament stats (live updating)
- Per-opponent summary (click to expand)
- Visual indicators (bars/gauges for each stat)

### R5: Deterministic Replay
**The system shall** replay a hand from history:
- Load HAND_START snapshot + event sequence
- Step-forward through events (play/pause/step buttons)
- Visual state matches each event point
- Forward-only (no rewind; jump = restart from beginning)

### R6: Action Log
**The system shall** display a running action log during play:
- "Player X raises to 300"
- "Player Y folds"
- "Flop: [As Kh 7d]"
- Scrollable, most recent at bottom

## 3. Acceptance Criteria

- [ ] AC1: Hand history list loads past hands from IndexedDB
- [ ] AC2: Hand detail view shows complete action sequence
- [ ] AC3: Stats display correct VPIP/PFR/3-Bet with right denominators
- [ ] AC4: Stats update live during active tournament
- [ ] AC5: Replay: stepping through events reproduces correct visual state
- [ ] AC6: Action log shows all events in natural language
- [ ] AC7: Side panel responsive on tablet/mobile

## 4. Files to Create

```
src/components/history/HandList.tsx       - Hand history list
src/components/history/HandDetail.tsx     - Individual hand replay view
src/components/stats/PlayerStats.tsx      - Stats display component
src/components/stats/StatGauge.tsx        - Visual stat indicator
src/components/sidebar/ActionLog.tsx      - Live action log
src/hooks/useHandHistory.ts              - IndexedDB query hook
src/hooks/usePlayerStats.ts              - Stats calculation hook
tests/components/history/HandList.test.tsx
tests/components/stats/PlayerStats.test.tsx
```

## 5. Design Doc Reference

- Section 4.7: Replay (deterministic forward-only)
- Section 7.6: Stats & Elimination (PlayerStats interface)
- Section 9.1: Layout (Side panel)
- Section 13.4: Stat Denominator Definitions
