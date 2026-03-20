# SPEC-UI-003: Player Seats & Action Panel

## Status: Draft
## Phase: 3 (UI)
## Priority: P1 (High)
## Dependencies: SPEC-UI-001, SPEC-UI-002

---

## 1. Overview

Implement the 8 player seat components showing player info, chip stacks, hole cards, and bet amounts. Build the action panel with Fold/Check/Call/Raise buttons, raise slider, and preset bet sizes.

## 2. Requirements (EARS Format)

### R1: Player Seat Component
**The system shall** display per-seat information:
- Player name (nickname)
- Chip stack (formatted)
- AI preset icon/badge (for AI players)
- Hole cards (face-up for human, face-down for AI unless showdown)
- Current bet amount (when bet is active)
- Status indicators: folded (grayed), all-in (highlighted), active (border glow)
- Timer/turn indicator for current player

### R2: Seat Layout
**The system shall** position 8 seats around the oval table:
- Seats numbered 0-7
- Human player always at bottom-center (seat 0 or configurable)
- Consistent positions across all device sizes

### R3: Action Panel
**When** it is the human player's turn, **the system shall** display:
- **Fold** button (always available)
- **Check** button (when no bet to call)
- **Call** button with amount (when facing a bet)
- **Raise/Bet** button with amount
- **All-in** quick button

### R4: Raise Slider
**When** the player selects Raise/Bet, **the system shall** show:
- Slider from minimum raise to all-in
- Current value display
- Preset size buttons: 1/3 pot, 1/2 pot, 2/3 pot, pot, 2× pot
- Manual input field for exact amount

### R5: Action Panel Disabling
**When** it is not the human player's turn, **the system shall** disable the action panel with a "Waiting..." indicator.

### R6: Eliminated Players
**When** a player is eliminated, **the system shall** show the seat as empty/grayed with finish position badge.

## 3. Acceptance Criteria

- [ ] AC1: All 8 seats render with correct player information
- [ ] AC2: Human player's hole cards visible, AI's cards face-down
- [ ] AC3: Current player highlighted with turn indicator
- [ ] AC4: Fold/Check/Call buttons show correctly based on game state
- [ ] AC5: Raise slider range: min-raise to all-in
- [ ] AC6: Preset bet sizes calculate correctly (1/3, 1/2, 2/3, pot)
- [ ] AC7: Action panel disabled when not human's turn
- [ ] AC8: Eliminated player seat shows grayed state with position badge
- [ ] AC9: Mobile layout: seats and action panel usable on small screens

## 4. Files to Create

```
src/components/seat/PlayerSeat.tsx      - Individual seat component
src/components/seat/SeatLayout.tsx      - 8-seat arrangement
src/components/action/ActionPanel.tsx   - Main action panel
src/components/action/RaiseSlider.tsx   - Raise amount slider
src/components/action/BetPresets.tsx    - Quick bet size buttons
tests/components/seat/PlayerSeat.test.tsx    - Seat rendering tests
tests/components/action/ActionPanel.test.tsx - Action panel tests
```

## 5. Design Doc Reference

- Section 9.1: Layout (Seats, Action areas)
- Section 9.2: Responsive design
