# SPEC-AI-007 Acceptance Criteria: Deterministic RNG Guardrail

## AC-1: Worker Uses Seeded PRNG for AI Decisions

**Given** a tournament started via game-worker with `initialSeed = "replay-test-001"`
**When** an AI player's turn arrives in the worker
**Then** the AI decision is computed using a seeded PRNG derived from the hand seed, not `Math.random`

**Verification**: Run tournament twice with same seed via worker, compare AI action events.

---

## AC-2: Orchestrator Throws on Null PRNG

**Given** the orchestrator's `runHand` function is executing
**When** `seedFromString` fails and `handPrng` would be null
**Then** an error is thrown with message containing "PRNG initialization failed"
**And** `Math.random` is never used as fallback

**Verification**: Unit test that mocks `crypto.subtle.digest` to throw, asserts error propagation.

---

## AC-3: No Math.random in AI/Engine Production Code

**Given** all TypeScript files in `src/ai/` and `src/engine/`
**When** scanned for `Math.random` usage
**Then** no direct `Math.random` calls are found except:
  - Default parameter declarations (e.g., `rng: () => number = Math.random`)
  - Cosmetic delay in `game-worker.ts` (`randomDelay`)
  - Test files

**Verification**: Automated test `no-math-random.test.ts` runs in CI.

---

## AC-4: Deterministic Replay -- Same Seed Produces Same Results

**Given** two tournament runs with:
  - Same `initialSeed = "determinism-check-42"`
  - Same 8 player configuration (Nit, TAG, LAG, Station, Maniac, Shark, TAG, Shark)
  - Same starting chips (1500) and blind schedule
**When** both tournaments run to completion
**Then** the following are identical across both runs:
  - Total number of hands played
  - Every `PLAYER_ACTION` event (playerId, action type, amount)
  - Every `DEAL_HOLE` event (card assignments)
  - Every `DEAL_COMMUNITY` event (board cards)
  - Every `AWARD_POT` event (winners and amounts)
  - Final standings (positions and chip counts)

**Verification**: Integration test `deterministic-replay.test.ts` with deep comparison.

---

## AC-5: Worker ActionProvider Only Handles Humans

**Given** a tournament running inside the Web Worker
**When** the orchestrator encounters an AI player's turn
**Then** the `actionProvider` callback is NOT invoked for that player
**And** the orchestrator handles AI internally using `selectAIAction` with `handPrng`

**Verification**: Add counter/flag in actionProvider; assert it is never called for AI players.

---

## AC-6: JSDoc Documentation Present

**Given** functions `makePreflopDecision`, `makePostflopDecision`, and `selectAIAction`
**When** their signatures are inspected
**Then** each has a JSDoc comment explaining that the `Math.random` default parameter is for testing/development convenience only, and production callers must provide a seeded PRNG

**Verification**: Code review; optionally, a documentation linter check.

---

## Quality Gate

- All existing tests pass (no regressions)
- New tests: `no-math-random.test.ts`, `deterministic-replay.test.ts`
- Zero `Math.random` calls in production AI/engine paths (verified by AC-3)
- Deterministic replay passes for at least 3 different seeds

## Definition of Done

- [ ] game-worker.ts no longer calls `selectAIAction` with `Math.random`
- [ ] orchestrator.ts throws error instead of falling back to `Math.random`
- [ ] Static analysis test prevents future `Math.random` introduction
- [ ] Deterministic replay test passes
- [ ] JSDoc added to all functions with `Math.random` default parameters
- [ ] All existing tests continue to pass
