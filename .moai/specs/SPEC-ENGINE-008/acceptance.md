# SPEC-ENGINE-008 Acceptance Criteria

---

## AC-1: All-In Runout Requires All Actions Complete

### Scenario 1.1: Shove with pending action

**Given** 3 players: A (UTG), B (SB), C (BB) all with 1500 chips at BB=20
**When** A folds, B goes all-in for 1500
**Then** C must receive a WAITING_FOR_ACTION prompt with valid actions [FOLD, CALL]
**And** the engine must NOT deal community cards until C acts

### Scenario 1.2: All players all-in

**Given** 3 players all-in after preflop betting completes
**When** betting round ends normally (all have acted)
**Then** community cards are dealt automatically (flop, turn, river)
**And** showdown occurs with all hands revealed

### Scenario 1.3: Single non-all-in player matched bet

**Given** 3 players: A all-in 500, B all-in 500, C calls 500 (still has chips)
**When** C has already acted (called) and no more facing bet
**Then** runout proceeds normally (C's action is complete)

---

## AC-2: Short All-In Does Not Reopen Betting

### Scenario 2.1: Short all-in after full action cycle

**Given** A bets 100 (full bet), B calls 100, both have acted
**When** C goes all-in for 150 (increase of 50, less than lastFullRaiseSize of 100)
**Then** A's valid actions are [FOLD, CALL] only (no RAISE)
**And** B's valid actions are [FOLD, CALL] only (no RAISE)

### Scenario 2.2: Short all-in before first action

**Given** BB=20, A (UTG) goes all-in for 30 (increase of 10, short all-in)
**When** B (next to act) has never acted this round
**Then** B's valid actions include RAISE (B has full action rights)

### Scenario 2.3: Full raise resets action

**Given** A bets 100, B calls 100
**When** C raises to 200 (full raise increment of 100)
**Then** A's valid actions include RAISE (betting reopened by full raise)

---

## AC-3: Fold-Win Event Sourcing Parity

### Scenario 3.1: BB walk (everyone folds preflop)

**Given** 8 players post blinds SB=10 BB=20
**When** all 6 non-blind players fold, SB folds
**Then** UNCALLED_RETURN event: playerId=BB, amount=10 (BB - SB)
**And** AWARD_POT event: playerId=BB, amount=10 (matched portion)
**And** BB's final chips = startingChips + 10 (net gain = SB's blind)
**And** replaying events through reducer produces identical chip counts for ALL players

### Scenario 3.2: Post-flop fold-win

**Given** A bets 200 on flop, B calls 200, C folds
**When** A bets 300 on turn, B folds
**Then** UNCALLED_RETURN event: playerId=A, amount=300
**And** AWARD_POT event: amount = total matched pot (blinds + flop bets)
**And** event replay state === live state (exact chip match per player)

### Scenario 3.3: Pot amount never zero for fold-win

**Given** any hand ending by fold-win where pot > 0
**When** AWARD_POT event is emitted
**Then** AWARD_POT payouts total > 0
**And** mainPot === 0 after settlement
**And** all sidePots amounts === 0 after settlement

---

## AC-4: Side-Pot Eligible Assertion

### Scenario 4.1: Empty eligible set throws

**Given** a corrupted game state where side pot eligible IDs don't match any reveal player
**When** the engine attempts to settle that side pot
**Then** the engine throws an Error (not silently proceeds)
**And** the error message contains the mismatched IDs for debugging

### Scenario 4.2: Normal side-pot works correctly

**Given** A all-in 100, B all-in 300, C calls 300
**When** showdown occurs
**Then** main pot (300) is contested by A, B, C
**And** side pot (400) is contested by B, C only
**And** A cannot win the side pot

---

## AC-5: Side-Pot Settlement Order

### Scenario 5.1: Side pots settled before main

**Given** A all-in 100, B all-in 250, C all-in 400
**When** showdown settlement events are emitted
**Then** first AWARD_POT event is for the most-restricted side pot (C-only excess)
**And** second AWARD_POT is for the B+C side pot
**And** last AWARD_POT is for the main pot (A+B+C)

---

## AC-6: Showdown Reveal Logic

### Scenario 6.1: All-in runout reveals all

**Given** all remaining players are all-in after preflop
**When** community cards are dealt (runout)
**Then** all non-folded players' hole cards are visible during the runout

### Scenario 6.2: Normal showdown order

**Given** a hand reaches river with betting action
**When** showdown begins
**Then** the last aggressor on the final street is listed first in reveals
**And** subsequent players follow clockwise from button position

---

## AC-7: Event Parity Invariant (Cross-Cutting)

### Scenario 7.1: Every hand maintains parity

**Given** any completed hand (fold-win, showdown, or all-in runout)
**When** the event sequence is replayed through the event reducer
**Then** for each player: `replayState.chips === liveState.chips`
**And** `replayState.mainPot === 0`
**And** `replayState.sidePots` all have amount === 0
**And** total chip sum === initial tournament chip total

### Scenario 7.2: 100-SNG simulation parity

**Given** 100 complete SNG tournaments run with deterministic seeds
**When** every hand's events are replayed
**Then** 0 parity violations detected across all hands
