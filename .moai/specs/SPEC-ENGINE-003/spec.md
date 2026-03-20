# SPEC-ENGINE-003: Pot Manager

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P0 (Critical)
## Dependencies: SPEC-ENGINE-001

---

## 1. Overview

Implement pot management including main pot, side pots (auto-created on all-in), uncalled bet return, collectBets() atomic operation, and odd chip distribution. The pot manager enforces the 3-bucket chip accounting invariant.

## 2. Requirements (EARS Format)

### R1: 3-Bucket Chip Accounting
**The system shall** maintain chips in exactly 3 buckets at all times:
- `stack`: Player.chips (player holdings)
- `streetBets`: Player.currentBet (bet but not yet in pot)
- `pots`: mainPot + sidePots[] (collected into pot)

**Invariant**: `sum(player.chips) + sum(player.currentBet) + mainPot + sum(sidePots) === totalChips` — asserted after every event.

### R2: collectBets()
**When** a street ends, **the system shall** atomically move all player.currentBet amounts into pots:
- Reset all player.currentBet to 0
- Create side pots when all-in amounts differ
- Verify invariant before and after

### R3: Side Pot Creation
**When** a player goes all-in with less than the current bet, **the system shall** create a side pot:
- Each side pot tracks `eligiblePlayerIds`
- Main pot (potIndex=0) first, then side pots oldest→newest

### R4: Uncalled Bet Return
**When** a bet/raise receives no call (all others fold or are all-in for less), **the system shall** return the uncalled portion to the bettor immediately.

### R5: Pot Distribution (Showdown)
**The system shall** distribute pots from main pot (index 0) through side pots (oldest→newest):
- Each pot awarded to the best hand among eligible players
- Split pots evenly among tied winners
- Odd chip → button-clockwise nearest winner

### R6: AWARD_POT Atomic Move
**The system shall** move chips from pots directly to winner.chips (pot→stack) with no intermediate bucket. Invariant verified immediately after.

### R7: BBA Routing
**The system shall** route BBA (Big Blind Ante) as dead money directly into mainPot, not into player.currentBet. BB and SB are live bets → player.currentBet.

## 3. Acceptance Criteria

- [ ] AC1: 3-bucket invariant holds after every operation (unit test with assert)
- [ ] AC2: Simple pot (no all-in): collectBets moves all bets to mainPot correctly
- [ ] AC3: Single all-in creates correct side pot with eligible players
- [ ] AC4: Multiple all-ins create multiple side pots in correct order
- [ ] AC5: Uncalled bet returns correct amount to bettor
- [ ] AC6: Odd chip awarded to button-clockwise nearest winner
- [ ] AC7: Split pot divides evenly among tied winners
- [ ] AC8: BBA goes to mainPot, BB/SB go to currentBet
- [ ] AC9: AWARD_POT leaves all pots at 0 after full distribution

## 4. Files to Create

```
src/engine/pot.ts              - PotManager class
tests/engine/pot.test.ts       - Comprehensive pot management tests
```

## 5. Design Doc Reference

- Section 2.4: Pot Management
- Section 3.3: Uncalled Bet Return
- Section 3.4: Odd Chip
- Section 4.2: Chip Accounting Model
- Section 4.6: Invariants
