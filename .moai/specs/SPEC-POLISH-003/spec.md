# SPEC-POLISH-003: AI Tuning & Settings UI

## Status: Draft
## Phase: 4 (Polish)
## Priority: P2 (Medium)
## Dependencies: SPEC-AI-001, SPEC-UI-001, SPEC-POLISH-001

---

## 1. Overview

Implement the UI for AI preset selection (Tier 1), fine-tune parameter adjustment (Tier 2), tournament configuration settings, and game options (sound, animation speed, custom seed).

## 2. Requirements (EARS Format)

### R1: AI Preset Selector (Tier 1)
**The system shall** provide a preset selector per AI player:
- 6 preset options: Nit, TAG, LAG, Station, Maniac, Shark
- Visual description of each preset (style, key trait)
- Select preset → all parameters auto-filled

### R2: Fine-Tune Panel (Tier 2)
**When** fine-tune mode is enabled, **the system shall** show:
- All AIProfile parameters as sliders/inputs
- Parameter grouping: Preflop (VPIP, PFR, 3-Bet, openLimp, etc.), Postflop (C-bet, barrels, bluff), Tournament (ICM, push/fold, bubble)
- Real-time constraint validation (PFR ≤ VPIP, etc.)
- Warning: "Custom values not calibrated — actual stats may differ"

### R3: Tournament Settings
**The system shall** provide tournament configuration:
- Starting chips: slider 500~10,000 (100 increments)
- Blind speed: Slow / Normal / Turbo / Hyper
- Payout: Top 2 (65/35) or Top 3 (50/30/20)
- Custom seed: text input (empty = random)

### R4: Game Options
**The system shall** provide game options:
- Sound effects: on/off
- Animation speed: slow / normal / fast / instant
- Auto-deal delay: slider (0~5s)
- Theme: dark / light

### R5: Settings Persistence
**The system shall** save all settings to LocalStorage via StorageEnvelope.

### R6: Per-Player AI Assignment
**The system shall** allow assigning different presets to each of the 7 AI players before starting a tournament. Default: random assignment from presets.

### R7: Pre-Game Setup Screen
**The system shall** show a setup screen before tournament start:
- Tournament configuration
- AI player assignment (7 seats)
- Start Game button

## 3. Acceptance Criteria

- [ ] AC1: Preset selector shows all 6 presets with descriptions
- [ ] AC2: Selecting a preset fills all parameters correctly
- [ ] AC3: Fine-tune mode: slider changes update parameter values
- [ ] AC4: Constraint violation shows error (e.g., PFR > VPIP)
- [ ] AC5: Tournament settings saved and loaded across sessions
- [ ] AC6: Custom seed produces deterministic game
- [ ] AC7: Different AI presets assignable to each AI player
- [ ] AC8: Pre-game setup screen accessible and functional
- [ ] AC9: Sound/animation/theme preferences persist

## 4. Files to Create

```
src/components/settings/PresetSelector.tsx    - Tier 1 preset picker
src/components/settings/FineTunePanel.tsx     - Tier 2 parameter adjustment
src/components/settings/TournamentConfig.tsx  - Tournament settings
src/components/settings/GameOptions.tsx       - Sound, animation, theme
src/components/setup/SetupScreen.tsx          - Pre-game setup screen
src/components/setup/AIPlayerConfig.tsx       - Per-AI preset assignment
tests/components/settings/PresetSelector.test.tsx
tests/components/settings/FineTunePanel.test.tsx
tests/components/setup/SetupScreen.test.tsx
```

## 5. Design Doc Reference

- Section 5.3: Settings
- Section 6.1: Two-Tier Architecture
- Section 6.2: Presets
- Section 6.3: Parameter Constraints
