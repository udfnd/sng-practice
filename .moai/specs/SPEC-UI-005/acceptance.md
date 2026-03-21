# SPEC-UI-005: Acceptance Criteria

## AC-1: Format Utility - Chips Mode

**Given** the display mode is "chips"
**When** `formatChips(1500, 20, 'chips')` is called
**Then** the result is `"1,500"`

**Given** the display mode is "chips"
**When** `formatChips(0, 20, 'chips')` is called
**Then** the result is `"0"`

---

## AC-2: Format Utility - BB Mode

**Given** the display mode is "bb"
**When** `formatChips(1500, 20, 'bb')` is called
**Then** the result is `"75.0 BB"`

**Given** the display mode is "bb"
**When** `formatChips(250, 20, 'bb')` is called
**Then** the result is `"12.5 BB"`

**Given** the display mode is "bb" and bb is 0
**When** `formatChips(1500, 0, 'bb')` is called
**Then** the result falls back to chips mode: `"1,500"`

---

## AC-3: Toggle Button

**Given** the game is in progress and display mode is "chips"
**When** the user clicks the display mode toggle in the TopBar
**Then** the toggle shows "BB" as active
**And** all chip displays across all visible components update to BB format
**And** the preference is saved to localStorage

**Given** the display mode is "bb"
**When** the user refreshes the page and resumes the game
**Then** the display mode is "bb" (persisted from localStorage)

---

## AC-4: Player Seat Display

**Given** a player has 1500 chips, the BB is 20, and display mode is "bb"
**When** the PlayerSeat component renders
**Then** the stack display shows "75.0 BB"

**Given** a player has a current bet of 60 chips, BB is 20, display mode is "bb"
**When** the PlayerSeat component renders
**Then** the bet display shows "3.0 BB"

---

## AC-5: Pot Display

**Given** the pot is 250 chips, BB is 20, display mode is "bb"
**When** the PokerTable component renders
**Then** the pot display shows "Pot: 12.5 BB"

**Given** the pot is 0, display mode is "bb"
**When** the PokerTable component renders
**Then** the pot display is hidden (existing behavior preserved)

---

## AC-6: ActionPanel - BB Mode Slider

**Given** BB mode is active, BB is 20, min raise is 40 (2 BB), player has 1500 chips
**When** the bet slider renders
**Then** the slider min is 2 BB (displayed), max is 75 BB, step is 0.5 BB
**And** the slider value label shows BB units

**Given** the user sets the slider to 3.5 BB with BB=20
**When** the user clicks the Bet/Raise button
**Then** the submitted amount is 70 chips (3.5 * 20)

---

## AC-7: ActionPanel - BB Preset Buttons

**Given** BB mode is active and BB is 20
**When** the ActionPanel renders with bet/raise available
**Then** BB preset buttons are visible: [2.5 BB, 3 BB, 4 BB]
**And** pot-relative presets remain visible: [1/2, 3/4, Pot]

**Given** the user clicks "3 BB" preset
**When** the preset is applied
**Then** the slider moves to 3.0 BB (60 chips internally)

---

## AC-8: ActionPanel - Call and All-In Display

**Given** BB mode is active, call amount is 40, BB is 20
**When** the Call button renders
**Then** it shows "Call 2.0 BB"

**Given** BB mode is active, player chips are 1500, BB is 20
**When** the All-In button renders
**Then** it shows "All-In 75.0 BB"

---

## AC-9: Bet Conversion Validation

**Given** BB mode is active, BB is 20, min raise is 40 chips
**When** the user enters 1.5 BB (= 30 chips, below minimum)
**Then** the system clamps the bet to the minimum raise (40 chips / 2.0 BB)
**And** does NOT submit the invalid amount

---

## AC-10: Engine Integrity

**Given** a bet is submitted in BB mode
**When** the action reaches the game engine
**Then** the action amount is in chip units (integer)
**And** the action history event payload contains chip amounts, never BB values
**And** the game state `player.chips` and `mainPot` remain in chip units

---

## AC-11: Blind Level Change

**Given** BB mode is active, BB changes from 20 to 40
**When** the blind level advances
**Then** all BB displays recalculate (e.g., 1500 chips was "75.0 BB", now shows "37.5 BB")
**And** the slider presets update to new BB-relative values

---

## Quality Gate Criteria

- [ ] All existing unit tests pass (no regressions)
- [ ] `format-chips.ts` has 100% branch coverage
- [ ] Manual verification: toggle between modes during active gameplay
- [ ] Manual verification: submit bets in BB mode at various blind levels
- [ ] Manual verification: persistence across page refresh
- [ ] Accessibility: toggle button has `aria-label` and `aria-pressed`
- [ ] No chip/BB values leak into game engine state or event payloads
