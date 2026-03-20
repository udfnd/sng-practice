# SPEC-AI-003: Postflop Decision Engine

## Status: Draft
## Phase: 2 (AI + Tournament)
## Priority: P1 (High)
## Dependencies: SPEC-AI-001, SPEC-AI-002, SPEC-ENGINE-002

---

## 1. Overview

Implement postflop AI decision-making including board texture analysis, made hand/draw tier classification, C-bet/barrel logic, bluff frequency (semi-bluff vs pure bluff split), and facing-bet defense.

## 2. Requirements (EARS Format)

### R1: Board Texture Analysis
**The system shall** classify board texture as:
- **Wet**: flush + straight draws possible
- **Dry**: low connectivity
- **Monotone**: 3+ cards of same suit
- **Paired**: board contains a pair

### R2: Made Hand Tiers
**The system shall** classify made hands into 4 tiers:
1. Overpair / Top pair strong kicker
2. Top pair weak kicker / Second pair
3. Bottom pair / Ace-high
4. Nothing (no pair, no draw)

### R3: Draw Tiers
**The system shall** classify draws into 4 tiers:
1. Combo draw (pair + draw, or flush + straight)
2. Flush draw (4 to flush)
3. OESD (open-ended straight draw)
4. Gutshot / Backdoor draw

### R4: Aggressor Betting (C-bet/Barrel)
**When** the AI is the preflop aggressor, **the system shall**:
- Flop: use cBetFreq as base probability
- Turn: use turnBarrel
- River: use riverBarrel
- Apply board texture adjustment: dry +10~15%, wet -10~15%
- Apply made hand tier bonus (strong hand → always bet, nothing → bluff frequency)

### R5: Bluff Categories
**The system shall** split bluffFreq into:
- Semi-bluff (60%): bluff with a draw (prioritized)
- Pure bluff (40%): complete air

### R6: Facing Bet Defense
**When** facing a bet, **the system shall**:
- Use foldToCBet as base fold probability on all postflop streets
- Adjust by made hand tier: tier 1 rarely folds, tier 4 usually folds
- Check-raise: checkRaiseFreq applied when holding tier 1-2 hands

### R7: Bet Sizing
**The system shall** size bets as fraction of pot:
- cBetSize parameter (0.25~1.0 of pot)
- Apply per street (can vary by board texture)

### R8: Global Clamp
**The system shall** clamp all adjusted probabilities to [0.0, 1.0].

## 3. Acceptance Criteria

- [ ] AC1: Board texture correctly classified (test vectors for wet/dry/monotone/paired)
- [ ] AC2: Made hand tiers: top pair with AK on A-7-2 = Tier 1
- [ ] AC3: Draw tiers: 4 hearts on board with heart in hand = Tier 2 (flush draw)
- [ ] AC4: C-bet frequency: TAG on dry board ≈ 80%, on wet board ≈ 55%
- [ ] AC5: Bluff split: 60% semi-bluff, 40% pure bluff
- [ ] AC6: Facing bet with nothing → fold rate near foldToCBet
- [ ] AC7: Check-raise triggers with strong hands at checkRaiseFreq
- [ ] AC8: All probabilities clamped to [0, 1]

## 4. Files to Create

```
src/ai/postflop.ts             - Postflop decision engine
src/ai/board-texture.ts        - Board texture analysis
src/ai/hand-classifier.ts      - Made hand tier + draw tier classification
tests/ai/postflop.test.ts      - Postflop decision tests
tests/ai/board-texture.test.ts - Board texture classification tests
tests/ai/hand-classifier.test.ts - Hand classification tests
```

## 5. Design Doc Reference

- Section 6.4.5: Postflop Decision
- Section 6.4.7: Global Numeric Rules
