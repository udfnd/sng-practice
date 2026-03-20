# SPEC-ENGINE-002: Hand Evaluator

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-001

---

## 1. Overview

Implement a high-performance hand evaluator using Cactus Kev's lookup table algorithm. Given 7 cards (2 hole + 5 community), determine the best 5-card hand and its ranking for comparison.

## 2. Requirements (EARS Format)

### R1: 7-Card Evaluation
**When** given 7 cards (2 hole + up to 5 community), **the system shall** evaluate all C(7,5)=21 combinations and return the best 5-card hand.

### R2: Hand Ranking
**The system shall** rank hands in standard poker order:
1. Royal Flush
2. Straight Flush
3. Four of a Kind
4. Full House
5. Flush
6. Straight
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

### R3: Kicker Resolution
**When** two hands have the same category, **the system shall** compare kickers in descending order to determine the winner or declare a tie.

### R4: Performance
**The system shall** evaluate a single 7-card hand in < 0.1ms using lookup tables.

### R5: Hand Description
**The system shall** return a human-readable description of the evaluated hand (e.g., "Two Pair, Aces and Kings, Queen kicker").

### R6: Comparison Function
**The system shall** provide a `compareHands(handA, handB)` function returning -1 (A wins), 0 (tie), or 1 (B wins).

## 3. Acceptance Criteria

- [ ] AC1: Correctly identifies all 10 hand categories
- [ ] AC2: Royal Flush beats all other hands
- [ ] AC3: Kicker resolution works for all categories (One Pair through Four of a Kind)
- [ ] AC4: Tie detection works correctly (same rank and kickers)
- [ ] AC5: Ace-low straight (A-2-3-4-5) correctly identified as straight
- [ ] AC6: 7-card evaluation selects the best 5-card combination
- [ ] AC7: Performance: < 0.1ms per evaluation (benchmark test)
- [ ] AC8: Known hand test vectors (≥ 20 cases covering all categories)

## 4. Files to Create

```
src/engine/evaluator.ts           - Hand evaluation logic + lookup tables
src/engine/evaluator-tables.ts    - Pre-computed lookup tables
tests/engine/evaluator.test.ts    - Comprehensive hand evaluation tests
```

## 5. Design Doc Reference

- Section 2.1: Module Overview (HandEvaluator)
- Section 10.1: Performance targets (< 0.1ms)
- Section 13.1: Testing priorities (Critical)
