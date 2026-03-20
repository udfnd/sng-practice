# SPEC-AI-005: Calibration & Validation

## Status: Draft
## Phase: 2 (AI + Tournament)
## Priority: P1 (High)
## Dependencies: SPEC-AI-001 through SPEC-AI-004, SPEC-ENGINE-007

---

## 1. Overview

Implement calibration simulation (10K hands per preset) and validation suite (1K SNG completion, determinism verification, balance soft assertions). Calibration results are hardcoded into presets.ts for zero runtime overhead.

## 2. Requirements (EARS Format)

### R1: Stat Tracking
**The system shall** track per-player statistics with correct denominators:
- VPIP = vpipCount / handsEligible (handsEligible = cards dealt - walks)
- PFR = pfrCount / handsEligible
- 3-Bet% = threeBetCount / threeBetOpportunities
- C-Bet% = cBetCount / cBetOpportunities

### R2: Calibration Simulation
**The system shall** run 10K-hand simulations per preset:
- Measure actual VPIP/PFR (handsEligible denominator) ±2% of target
- Measure actual 3-Bet (threeBetOpportunities denominator) ±2% of target
- Results hardcoded into presets.ts (no runtime calibration)

### R3: SNG Completion Test
**The system shall** run 1K complete SNG tournaments without error:
- All tournaments must terminate (1 winner)
- Chip conservation invariant verified every event
- No illegal actions or state machine violations

### R4: Determinism Verification
**The system shall** verify deterministic replay:
- Same seed × 100 runs = identical results
- Event sequences byte-for-byte identical (excluding timestamps)

### R5: Balance Soft Assertions (95% CI)
**The system shall** perform balance validation (warnings, not failures):
- Each preset 1K SNG: 1st place rate in 2~40% range
- Shark/TAG average finish position < Nit/Station (lower = better)
- Maniac variance > other presets
- All assertions use N≥1000 SNG with 95% confidence interval

### R6: Push/Fold Validation
**The system shall** verify push/fold mode activates correctly:
- Players with ≤10BB stack use push/fold strategy
- Push ranges align with Nash chart approximations

### R7: Performance Targets (Batch)
- AI decision: < 0.5ms (no delay, pure math)
- Full hand: < 5ms (~15 actions average)
- 10K hands: < 60s
- 1K SNG: < 10 minutes

## 3. Acceptance Criteria

- [ ] AC1: VPIP within ±2% of preset target (10K hands, per preset)
- [ ] AC2: PFR within ±2% of preset target
- [ ] AC3: 3-Bet% within ±2% of preset target (threeBetOpportunities denominator)
- [ ] AC4: 1K SNG complete without errors
- [ ] AC5: Determinism: 100 runs with same seed produce identical results
- [ ] AC6: Balance: Shark/TAG outperform Nit/Station in average rank (soft assert)
- [ ] AC7: Performance: 1K SNG < 10 minutes in batch mode
- [ ] AC8: Chip conservation verified across all simulated events

## 4. Files to Create

```
src/ai/calibration.ts              - Calibration runner
src/ai/push-fold.ts                - Nash push/fold approximation
tests/ai/calibration.test.ts       - Stat accuracy tests (10K hands)
tests/ai/sng-completion.test.ts    - 1K SNG completion test
tests/ai/determinism.test.ts       - Determinism verification
tests/ai/balance.test.ts           - Balance soft assertions
```

## 5. Design Doc Reference

- Section 6.5: Calibration
- Section 6.4.6: Equity (push/fold Nash)
- Section 10.2: Performance — Batch Path
- Section 13.2: Simulation Validation
- Section 13.3: Balance Validation
- Section 13.4: Stat Denominator Definitions
