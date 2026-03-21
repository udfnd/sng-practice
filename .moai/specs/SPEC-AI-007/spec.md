# SPEC-AI-007: Deterministic RNG Guardrail & Math.random() Elimination

## Status: Draft
## Priority: P0 (Critical - Prerequisite for SPEC-AI-008, 009, 010)
## Dependencies: None
## Affected Files: src/engine/game-worker.ts, src/engine/orchestrator.ts, src/ai/preflop.ts, src/ai/postflop.ts, src/ai/action-selector.ts

---

## 1. Overview

Eliminate all non-deterministic `Math.random()` usage in AI decision and engine code paths, replacing them with the existing seeded PRNG (`xoshiro256**` from `src/engine/prng.ts`). This guarantees deterministic replay: given the same seed, the same tournament produces identical results, which is a prerequisite for testing, debugging, and all subsequent AI improvement SPECs.

## 2. Problem Analysis

### P1: game-worker.ts Line 104 -- Math.random Passed to AI in ActionProvider

The `actionProvider` closure inside `handleStartGame` calls `selectAIAction(player, tournament.gameState, null, Math.random)` with `Math.random` as the RNG. This bypasses the seeded `handPrng` that `orchestrator.ts` correctly creates per hand. The worker's action provider is an independent code path from the orchestrator's `runBettingRound`, so when the game runs inside the Web Worker (the production path), AI decisions are NOT deterministic.

**Root cause**: The action provider was written as a simple callback before the seeded PRNG system was integrated into the orchestrator. It was never updated to use `handPrng`.

### P2: orchestrator.ts Line 327 -- Math.random Fallback

In `runBettingRound`, line 327: `const rng = handPrng ? () => nextFloat(handPrng) : Math.random;`. If `handPrng` is null (seed initialization failed), the engine silently falls back to `Math.random`. This should be a hard error, not a silent degradation.

### P3: Default Parameter Signatures

Functions `makePreflopDecision`, `makePostflopDecision`, and `selectAIAction` all use `rng: () => number = Math.random` as default parameters. This is acceptable for backward compatibility and testing convenience, but should be documented as intentional, and production callers should ALWAYS pass an explicit RNG.

## 3. Requirements (EARS Format)

### R1: Worker PRNG Integration (Event-Driven)

**When** the game-worker action provider is invoked for an AI player, **the system shall** use a per-hand seeded PRNG derived from the hand seed, NOT `Math.random`.

Implementation detail: The worker must maintain a `handPrng` state per hand, seeded from the same hand seed that the orchestrator uses. Since the worker runs `runTournament` which calls `runHand` which creates `handPrng`, the worker's separate `actionProvider` callback path must be removed or unified with the orchestrator's internal AI handling.

### R2: Orchestrator Hard Failure (Unwanted Behavior)

**If** `handPrng` is null after seed initialization in `runBettingRound`, **then the system shall** throw an error with message "Hand PRNG initialization failed: cannot proceed without deterministic RNG". The system **shall not** fall back to `Math.random`.

### R3: Static Analysis Guard (Ubiquitous)

**The system shall** include a test that scans all files in `src/ai/` and `src/engine/` for direct `Math.random` calls (excluding default parameter declarations and test files), and fails if any are found.

### R4: Deterministic Replay Verification (Event-Driven)

**When** a tournament is run twice from the game-worker with the same `initialSeed` and identical player configuration, **the system shall** produce identical sequences of `GameEvent` objects (same actions, same amounts, same community cards, same winners).

### R5: Default Parameter Documentation (Ubiquitous)

**The system shall** include JSDoc comments on all functions with `rng: () => number = Math.random` default parameters, documenting that `Math.random` is a development/testing convenience and that production callers must always provide a seeded PRNG.

## 4. Architecture Notes

### Option A: Unify Worker with Orchestrator Path (Recommended)

The game-worker action provider currently duplicates AI action selection logic. The orchestrator's `runBettingRound` already handles AI players correctly (with `handPrng`). The worker should rely on the orchestrator's internal AI handling rather than re-implementing it in the action provider.

**Change**: The worker's `actionProvider` should only handle human players. AI players should be handled by the orchestrator's existing code path in `runBettingRound` (lines 325-328), which already passes `handPrng`.

This means: remove the `if (player && !player.isHuman && player.aiProfile)` branch from the worker's action provider entirely. The orchestrator already has this logic.

### Option B: Pass handPrng to Worker ActionProvider

If Option A is not feasible, create a per-hand PRNG in the worker's action provider using the same seed derivation as the orchestrator.

## 5. Constraints

- The seeded PRNG (`xoshiro256**`) uses `crypto.subtle.digest` which is async. The `rng: () => number` interface is sync. This is already solved by `seedFromString` being called once per hand (async), then `nextFloat(state)` being called synchronously.
- Web Worker environment has `crypto.subtle` available.
- The `randomDelay` function in game-worker.ts (line 51) legitimately uses `Math.random` for cosmetic think-time delays. This is NOT an AI decision and should be excluded from the static analysis guard.

## 6. Traceability

| Requirement | Source | Validates |
|------------|--------|-----------|
| R1 | game-worker.ts:104 | Worker determinism |
| R2 | orchestrator.ts:327 | Fail-safe guarantee |
| R3 | Project-wide | Regression prevention |
| R4 | Design Doc 6.5 | Replay reproducibility |
| R5 | Code quality | Documentation |
