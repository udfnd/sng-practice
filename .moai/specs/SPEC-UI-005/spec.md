# SPEC-UI-005: BB Unit Display & Betting

## Metadata

| Field    | Value             |
| -------- | ----------------- |
| SPEC ID  | SPEC-UI-005       |
| Title    | BB Unit Display & Betting |
| Created  | 2026-03-21        |
| Status   | Planned           |
| Priority | Medium            |
| Related  | SPEC-UI-001, SPEC-UI-004 |

---

## Environment

- **Runtime**: React 19 + Vite, TypeScript, Tailwind CSS
- **State Management**: Zustand with immer middleware (`game-store.ts`)
- **Blind Data**: `BlindLevel` type contains `sb`, `bb`, and `ante` fields
- **Current Chip Display**: `PlayerSeat.tsx` uses `player.chips.toLocaleString()`, `PokerTable.tsx` has a local `formatChips()` utility, `ActionPanel.tsx` displays raw chip amounts for call/raise
- **Persistence**: `localStorage` already used for session snapshots

## Assumptions

- A1: BB value is always available via `gameState.blindLevel.bb` and is never zero during active play
- A2: All chip amounts in the codebase are integers (no fractional chips)
- A3: BB display is purely cosmetic; all internal game logic continues to use chip amounts
- A4: The toggle state should persist across browser sessions but NOT across tournaments
- A5: BB values will display with 1 decimal place (e.g., "12.5 BB") for readability
- A6: The minimum bet in BB mode rounds to the nearest 0.5 BB for slider steps

## Requirements

### Ubiquitous Requirements

- R1: The system **shall** maintain all internal game state, bet resolution, and pot calculation in chip units regardless of display mode.
- R2: The system **shall** provide a single `formatChips(amount: number, bb: number, mode: DisplayMode): string` utility used by all chip-displaying components.

### Event-Driven Requirements

- R3: **When** the user toggles the display mode, **then** all visible chip values (player stacks, pot, current bets, action panel amounts) **shall** update simultaneously without re-rendering the game state.
- R4: **When** the user submits a bet in BB mode, **then** the system **shall** convert the BB value to the nearest valid chip amount (`Math.round(bbValue * currentBB)`) before sending to the game engine.
- R5: **When** the blind level changes, **then** all BB-denominated displays **shall** recalculate using the new BB value.
- R6: **When** the user changes the bet slider in BB mode, **then** the slider **shall** step in 0.5 BB increments with the value displayed as BB.

### State-Driven Requirements

- R7: **While** BB display mode is active, player stacks **shall** display as `"{value} BB"` (e.g., "75.0 BB").
- R8: **While** BB display mode is active, the pot display **shall** show `"Pot: {value} BB"` (e.g., "Pot: 12.5 BB").
- R9: **While** BB display mode is active, the ActionPanel preset buttons **shall** display BB-denominated values: 2.5 BB, 3 BB, 4 BB, alongside pot-relative presets (1/2 Pot, 3/4 Pot, Pot).
- R10: **While** chip display mode is active, all components **shall** render chip values exactly as they do today (no behavioral change).

### Optional Requirements

- R11: **Where possible**, the TopBar **shall** display an effective stack indicator showing the human player's stack in BB alongside the blind level info.
- R12: **Where possible**, the manual bet input field **shall** accept both BB values (e.g., "3.5") and chip values (e.g., "70") with auto-detection based on magnitude.

### Unwanted Behavior Requirements

- R13: The system **shall not** allow submitting a bet that converts to less than the minimum legal bet in chips.
- R14: The system **shall not** store BB-converted values in game state, action history, or event payloads.

## Specifications

### State Design

Add to `game-store.ts`:

```
displayMode: 'chips' | 'bb'   // default: 'chips'
toggleDisplayMode: () => void  // toggles between modes
```

Persist `displayMode` to `localStorage` key `holdem-sng-display-mode`.

### Utility Function

```
// src/utils/format-chips.ts
type DisplayMode = 'chips' | 'bb';

formatChips(amount: number, bb: number, mode: DisplayMode): string
  - chips mode: amount.toLocaleString() (existing behavior)
  - bb mode: (amount / bb).toFixed(1) + ' BB'

formatChipsCompact(amount: number, bb: number, mode: DisplayMode): string
  - chips mode: compact format (e.g., "1.5K" for 1500)
  - bb mode: same as formatChips
```

### Component Changes

| Component      | Current Display          | BB Mode Display          |
| -------------- | ------------------------ | ------------------------ |
| PlayerSeat     | `player.chips.toLocaleString()` | `formatChips(chips, bb, mode)` |
| PlayerSeat     | `player.currentBet`     | `formatChips(currentBet, bb, mode)` |
| PokerTable     | `Pot: {formatChips(pot)}` (local fn) | `Pot: {formatChips(pot, bb, mode)}` |
| ActionPanel    | `Call {callAmount}`       | `Call {formatChips(callAmount, bb, mode)}` |
| ActionPanel    | `Raise {amount}`          | `Raise {formatChips(amount, bb, mode)}` |
| ActionPanel    | All-In {chips}            | `All-In {formatChips(chips, bb, mode)}` |
| TopBar         | Blind level text          | Add stack-in-BB indicator |

### ActionPanel BB Mode Behavior

- Slider: min = 2 BB, max = playerStack / bb, step = 0.5 BB
- BB preset buttons: [2.5 BB, 3 BB, 4 BB, All-in]
- Pot-relative presets remain: [1/2 Pot, 3/4 Pot, Pot]
- Manual input: accepts BB float, converts on submit
- On submit: `amount = Math.round(inputBB * bb)`, clamped to `[minRaise, playerChips]`

### Toggle Button

- Location: TopBar, right side, next to player count
- Label: "BB" / "Chips" toggle pill
- Persist: `localStorage.setItem('holdem-sng-display-mode', mode)`
- Load: read on store initialization

---

## Traceability

| Requirement | Plan Reference | Acceptance Reference |
| ----------- | -------------- | -------------------- |
| R1-R2       | M1: Utility    | AC-1, AC-2           |
| R3-R6       | M2: ActionPanel| AC-3, AC-4, AC-5     |
| R7-R10      | M2, M3         | AC-6, AC-7           |
| R11-R12     | M3: TopBar     | AC-8                 |
| R13-R14     | M1, M2         | AC-9, AC-10          |
