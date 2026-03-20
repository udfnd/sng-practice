# SPEC-AI-004: Tournament Manager

## Status: Draft
## Phase: 2 (AI + Tournament)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-005, SPEC-ENGINE-006

---

## 1. Overview

Implement the tournament manager handling blind level progression (10-level schedule with BBA), player elimination and ranking, simultaneous elimination tiebreaking, HU transition, payout calculation, and tournament completion.

## 2. Requirements (EARS Format)

### R1: Blind Schedule
**The system shall** implement the 10-level blind schedule with BBA:

| Lv | SB | BB | BBA | Notes |
|----|----|----|-----|-------|
| 1 | 10 | 20 | 5 | Opening |
| 2 | 15 | 30 | 5 | |
| 3 | 25 | 50 | 10 | |
| 4 | 50 | 100 | 15 | |
| 5 | 75 | 150 | 25 | |
| 6 | 100 | 200 | 25 | |
| 7 | 150 | 300 | 50 | |
| 8 | 200 | 400 | 50 | Push/Fold |
| 9 | 300 | 600 | 100 | |
| 10 | 500 | 1000 | 100 | Hyper |

Level-up every N hands (configurable: Slow=20, Normal=10, Turbo=6, Hyper=3).

### R2: Player Elimination
**When** a player's chips reach 0, **the system shall**:
- Emit PLAYER_ELIMINATED event with finishPosition, chipsAtHandStart, payout
- Remove from active players
- Track in eliminations[] and standings[]

### R3: Simultaneous Elimination
**When** multiple players are eliminated in the same hand, **the system shall**:
- Higher finish position (better rank) for player with more chips at hand start
- Equal chips at hand start → same rank (tie)
- ITM boundary tie: split the boundary prize equally

### R4: HU Transition
**When** transitioning from 3→2 players, **the system shall** apply:
- General rule: previous BB's clockwise next surviving player = new BB
- Case A (prev BB survives): prev BB → BTN/SB, opponent → BB
- Case B (prev BB eliminated): clockwise next from prev BB → BB, other → BTN/SB

### R5: Payout Structure
**The system shall** support two payout structures:
- Top 3: 50% / 30% / 20%
- Top 2: 65% / 35%
- Prize pool = startingChips × 8 (notional)

### R6: Tournament Configuration
**The system shall** accept configurable parameters:
- Starting chips: 500~10,000 (100 increments)
- Blind speed: Slow(20)/Normal(10)/Turbo(6)/Hyper(3) hands per level
- Payout: Top 2 or Top 3
- Custom seed: empty = random, string = deterministic

### R7: Tournament Completion
**When** only 1 player remains, **the system shall**:
- Emit TOURNAMENT_END with standings[] and payouts[]
- Set isComplete = true
- Total chips invariant: winner.chips === startingChips × 8

### R8: M-Ratio Calculation
**The system shall** calculate M = stack / (SB + BB + BBA) for each player.

## 3. Acceptance Criteria

- [ ] AC1: Blind levels advance correctly after configured hands-per-level
- [ ] AC2: Eliminated player gets correct finish position
- [ ] AC3: Simultaneous elimination: more chips at hand start → better rank
- [ ] AC4: Simultaneous elimination with equal chips → tied rank, split prize
- [ ] AC5: 3→2 HU transition: all 3 cases produce correct BTN/SB/BB assignment
- [ ] AC6: Top 3 payout: 50/30/20 distribution correct
- [ ] AC7: Tournament completes with winner holding all chips
- [ ] AC8: M-ratio calculation matches design doc Avg M column

## 4. Files to Create

```
src/engine/tournament.ts           - TournamentManager class
tests/engine/tournament.test.ts    - Tournament flow tests
tests/engine/tournament-hu.test.ts - HU transition specific tests
```

## 5. Design Doc Reference

- Section 5: SNG Tournament Structure
- Section 5.2: Blind Schedule
- Section 5.3: Settings
- Section 3.5: HU Transition
- Section 3.6: Simultaneous Elimination
