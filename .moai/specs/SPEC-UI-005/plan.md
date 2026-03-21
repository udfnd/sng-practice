# SPEC-UI-005: Implementation Plan

## Overview

Add a BB (Big Blind) unit display mode that allows the player to view all chip amounts relative to the current big blind and submit bets in BB units. This is a UI-only feature; the game engine remains unchanged.

---

## Milestone 1 (Primary Goal): Core Utility & Store

**Objective**: Create the formatting utility and extend the game store.

### Tasks

1. **Create `src/utils/format-chips.ts`**
   - Export `DisplayMode` type: `'chips' | 'bb'`
   - Export `formatChips(amount, bb, mode)` function
   - Export `formatChipsCompact(amount, bb, mode)` for compact display
   - Handle edge cases: bb=0 (fallback to chips mode), negative amounts, zero amounts

2. **Extend `game-store.ts`**
   - Add `displayMode: DisplayMode` to store state (default: `'chips'`)
   - Add `toggleDisplayMode()` action
   - Initialize from `localStorage` on store creation
   - Persist changes to `localStorage` on toggle

3. **Unit tests for `format-chips.ts`**
   - Test chips mode formatting (locale string)
   - Test BB mode formatting (decimal precision)
   - Test edge cases (0 chips, bb=0 fallback, very large stacks)
   - Test compact formatting thresholds

### Files Modified
- `src/utils/format-chips.ts` (new)
- `src/store/game-store.ts` (modify)
- `src/utils/__tests__/format-chips.test.ts` (new)

---

## Milestone 2 (Primary Goal): Component Integration

**Objective**: Wire all chip-displaying components to use the new formatter.

### Tasks

1. **Update `PlayerSeat.tsx`**
   - Import `useGameStore` for `displayMode` and `blindLevel.bb`
   - Replace `player.chips.toLocaleString()` with `formatChips()`
   - Replace `player.currentBet` display with `formatChips()`

2. **Update `PokerTable.tsx`**
   - Remove local `formatChips()` function
   - Import shared `formatChips` from utility
   - Pass `displayMode` and `bb` from store

3. **Update `ActionPanel.tsx`**
   - BB mode slider: step = `0.5 * bb`, display value as BB
   - BB mode presets: render [2.5 BB, 3 BB, 4 BB] alongside pot-relative presets
   - Conversion on submit: `Math.round(bbInput * bb)`, clamp to valid range
   - Display call/raise amounts using `formatChips()`
   - Manual input field: accept BB float in BB mode

4. **Update `TopBar.tsx`**
   - Add toggle button (pill style: "BB" | "Chips")
   - Optionally show human player stack in BB

### Files Modified
- `src/components/seat/PlayerSeat.tsx` (modify)
- `src/components/table/PokerTable.tsx` (modify)
- `src/components/layout/ActionPanel.tsx` (modify)
- `src/components/layout/TopBar.tsx` (modify)

---

## Milestone 3 (Secondary Goal): Polish & Edge Cases

**Objective**: Handle edge cases and improve UX.

### Tasks

1. **Blind level transition**
   - Verify BB displays update correctly when blind level changes mid-hand
   - No special logic needed if components reactively read `blindLevel.bb`

2. **All-in display**
   - When player stack is not a clean BB multiple, show 1 decimal (e.g., "12.3 BB")
   - All-in button: show both BB and chip value in parentheses when in BB mode

3. **Accessibility**
   - Toggle button: proper `aria-label`, `aria-pressed` state
   - Slider: `aria-valuetext` shows BB value when in BB mode

4. **localStorage persistence**
   - Verify mode persists across page refresh
   - Verify mode resets gracefully if localStorage is cleared

### Files Modified
- Various component files (minor tweaks)
- No new files expected

---

## Technical Approach

### Architecture

```
game-store.ts
  displayMode: 'chips' | 'bb'
  toggleDisplayMode()
       |
       v
format-chips.ts (pure utility, no side effects)
  formatChips(amount, bb, mode) -> string
       |
       v
[PlayerSeat, PokerTable, ActionPanel, TopBar]
  - Read displayMode + bb from store
  - Call formatChips() for all numeric displays
  - ActionPanel: convert BB input -> chips on submit
```

### Key Design Decisions

- **Pure utility function**: `formatChips` has no dependencies on React or Zustand; easily testable
- **Store-level toggle**: All components reactively update via Zustand selector
- **No engine changes**: All conversion is at the display/input boundary
- **Slider step in BB mode**: `0.5 * bb` chips per step ensures clean BB increments

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Rounding errors cause invalid bets | Medium | High | Clamp converted amount to `[minRaise, chips]`; validate before submit |
| BB=0 at game start before blinds posted | Low | Medium | Fallback to chips mode when bb=0 |
| Performance: frequent re-renders on toggle | Low | Low | `formatChips` is pure; memoized components already in use |
| Slider precision with fractional BB | Medium | Low | Use 0.5 BB steps; round to nearest valid chip amount |
