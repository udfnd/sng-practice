# SPEC-ENGINE-001: Core Types & Card System

## Status: Draft
## Phase: 1 (Engine + Worker)
## Priority: P0 (Foundation)
## Dependencies: None

---

## 1. Overview

Establish all core TypeScript interfaces, card encoding system, and seedable PRNG (xoshiro256**) that form the foundation for the entire game engine. This is the lowest-level building block upon which all other engine modules depend.

## 2. Requirements (EARS Format)

### R1: Type Definitions
**When** the project is initialized, **the system shall** provide TypeScript interfaces for Card, Action, Player, GameState, TournamentConfig, TournamentState, BlindLevel, SidePot, BettingRoundState, AIProfile, PlayerStats, Elimination, Standing, and StorageEnvelope as defined in design doc Section 7.

### R2: Card Encoding
**The system shall** encode cards as `encoded = suit_index * 13 + rank_index` (0-based, 0–51).
- suit_index: 0=spades, 1=hearts, 2=diamonds, 3=clubs
- rank_index: 0=2, 1=3, ..., 12=Ace
- `toEncoded()` and `fromEncoded()` shall be the only encoding/decoding functions.

### R3: PRNG (xoshiro256**)
**The system shall** implement a seedable PRNG using xoshiro256** with:
- Seed → 256-bit state via SHA-256(UTF-8(seed)) → 4 × uint64 BigInt
- All bit operations masked with `& 0xFFFFFFFFFFFFFFFFn`
- Float conversion: `Number(next() >> 11n) / 2**53` → [0, 1)
- Empty seed: `crypto.getRandomValues(Uint8Array(32))` → hex string

### R4: Fisher-Yates Shuffle
**The system shall** implement Fisher-Yates shuffle using the seedable PRNG for bias-free card shuffling of a 52-card deck.

### R5: Deck Module
**The system shall** provide a Deck class that:
- Creates a standard 52-card deck
- Shuffles using seeded PRNG
- Deals cards (removing from deck)
- Records the seed for each hand

### R6: Serialization Rules
**The system shall** enforce JSON-safe serialization:
- No `Set<T>` → use `T[]`
- No `Map<K,V>` → use `Record<K,V>`
- No `Date` → use `number` (timestamp)
- No `undefined` → use `null`

## 3. Acceptance Criteria

- [ ] AC1: All TypeScript interfaces compile with strict mode enabled
- [ ] AC2: `toEncoded(suit, rank)` and `fromEncoded(encoded)` are inverse functions for all 52 cards
- [ ] AC3: Same seed produces identical PRNG sequence across runs (determinism test)
- [ ] AC4: SHA-256 seed initialization matches spec (cross-browser determinism)
- [ ] AC5: Fisher-Yates shuffle produces uniform distribution (chi-squared test with 10K shuffles)
- [ ] AC6: Deck deals all 52 unique cards per shuffle
- [ ] AC7: Empty seed generates valid random hex string via crypto.getRandomValues()

## 4. Files to Create

```
src/types/index.ts          - All TypeScript interfaces
src/engine/card.ts          - Card encoding (toEncoded/fromEncoded)
src/engine/prng.ts          - xoshiro256** implementation
src/engine/deck.ts          - Deck class (shuffle, deal)
tests/engine/card.test.ts   - Card encoding tests
tests/engine/prng.test.ts   - PRNG determinism tests
tests/engine/deck.test.ts   - Deck shuffle/deal tests
```

## 5. Design Doc Reference

- Section 2.3: Card Encoding
- Section 2.3.1: PRNG Implementation Spec
- Section 7: Core Data Models
- Section 8.3: Serialization Rules
