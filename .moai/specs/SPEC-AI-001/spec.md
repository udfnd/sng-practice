# SPEC-AI-001: AI Presets & Range Tables

## Status: Draft
## Phase: 2 (AI + Tournament)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-001

---

## 1. Overview

Implement the 6 AI presets (Nit, TAG, LAG, Station, Maniac, Shark) with all parameters, the 169×7 combo-weighted hand range table, position mapping from active seat order, and the two-tier architecture (Preset → Fine-tune).

## 2. Requirements (EARS Format)

### R1: AI Presets
**The system shall** define 6 presets with all AIProfile parameters:

| Preset | VPIP | PFR | 3-Bet | Bluff | Key Trait |
|--------|------|-----|-------|-------|-----------|
| Nit | 0.10 | 0.07 | 0.03 | 0.05 | Premium only |
| TAG | 0.19 | 0.16 | 0.07 | 0.15 | Strong standard |
| LAG | 0.30 | 0.24 | 0.12 | 0.30 | Wide + aggressive |
| Station | 0.45 | 0.08 | 0.02 | 0.05 | Calls too much |
| Maniac | 0.55 | 0.40 | 0.18 | 0.45 | Ultra aggressive |
| Shark | 0.23 | 0.19 | 0.09 | 0.22 | GTO-ish, best opponent |

All parameters stored as 0.0~1.0 internally, displayed as % in UI.

### R2: Parameter Constraints
**The system shall** enforce:
- PFR ≤ VPIP
- openLimpFreq + PFR ≤ VPIP
- cBetFreq ≥ turnBarrel ≥ riverBarrel

### R3: Range Table (169×7)
**The system shall** provide a combo-weighted range table:
- 169 starting hand classes × 7 position groups (EP, MP, CO, BTN, SB, BB, HU)
- Combo-weighted: pair=6, suited=4, offsuit=12 (total 1326 combos)
- Percentile 0.0~1.0 per hand per position

### R4: Position Mapping
**The system shall** map players to position groups based on active seat order:
- activeSeats = active players sorted clockwise from dealer
- relativePos → position group per player-count table (2p~8p)
- EP1/EP2 both map to EP group
- HU: BTN=SB, uses separate HU range table

### R5: Two-Tier Architecture
- **Tier 1 (Preset)**: Select preset → all parameters auto-set
- **Tier 2 (Fine-Tune)**: Adjust individual parameters from preset baseline, constraint validation automatic

### R6: Parameter Unit Convention
**The system shall** store all ratios as 0.0~1.0 internally:
- vpip, pfr, threeBetFreq, etc. → 0.0~1.0
- openRaiseSize → 2.0~4.0 (BB multiplier)
- fourBetRatio → 0.10~0.30
- cBetSize → 0.25~1.0 (pot fraction)

## 3. Acceptance Criteria

- [ ] AC1: All 6 presets load with correct parameter values
- [ ] AC2: Constraint validation rejects PFR > VPIP
- [ ] AC3: Range table: top 10% = ~133 combos (combo-weighted)
- [ ] AC4: Position mapping: 8-player table maps correctly per design doc example
- [ ] AC5: HU position mapping uses separate HU range group
- [ ] AC6: Fine-tune mode: adjusting one parameter auto-validates constraints
- [ ] AC7: All parameters serializable to JSON (StorageEnvelope compatible)

## 4. Files to Create

```
src/ai/presets.ts              - 6 preset definitions + constraint validation
src/ai/hand-ranges.ts          - 169×7 range table (combo-weighted percentiles)
src/ai/position.ts             - Position mapping (activeSeats → group)
tests/ai/presets.test.ts       - Preset loading + constraint tests
tests/ai/hand-ranges.test.ts   - Range table combo-weight verification
tests/ai/position.test.ts      - Position mapping for 2p~8p
```

## 5. Design Doc Reference

- Section 6.1: Two-Tier Architecture
- Section 6.2: Presets
- Section 6.3: Parameter Definitions & Constraints
- Section 6.4.1: Combo-Weighted Range Percentile
- Section 6.4.2: Position Mapping
- Section 7.4: AIProfile interface
- Section 7.4.1: Parameter Unit Convention
