# SPEC-AI-007 Implementation Plan: Deterministic RNG Guardrail

## Milestone 1: Worker ActionProvider Fix (Primary Goal)

### Task 1.1: Remove Duplicate AI Logic from game-worker.ts

- Remove the `if (player && !player.isHuman && player.aiProfile)` branch from the `actionProvider` closure in `handleStartGame`
- The orchestrator's `runBettingRound` (line 325-328) already handles AI players with `handPrng`
- The worker's action provider should ONLY handle human players (the `else` branch)
- Verify that `runTournament` -> `runHand` -> `runBettingRound` correctly detects AI players and uses `handPrng`

### Task 1.2: Verify Orchestrator AI Path

- Confirm that `runBettingRound` line 325: `if (!player.isHuman && player.aiProfile)` correctly intercepts ALL AI player turns
- Confirm that the `actionProvider` callback is NEVER invoked for AI players when using the orchestrator path
- Add a defensive assertion: if the `actionProvider` is called for an AI player, throw an error

### Task 1.3: Remove randomDelay for AI Path

- The `randomDelay(AI_THINK_MIN_MS, AI_THINK_MAX_MS)` call in the worker's AI branch should be moved to the orchestrator level or handled via event emission
- If cosmetic delay is desired, emit an `AI_THINKING` event from the orchestrator and let the UI layer add delay

**Files modified**: `src/engine/game-worker.ts`

## Milestone 2: Orchestrator Hard Failure (Primary Goal)

### Task 2.1: Replace Math.random Fallback

- In `runBettingRound` (orchestrator.ts ~line 327), replace:
  ```
  const rng = handPrng ? () => nextFloat(handPrng) : Math.random;
  ```
  with:
  ```
  if (!handPrng) throw new Error("Hand PRNG initialization failed");
  const rng = () => nextFloat(handPrng);
  ```
- In `runHand` (~line 150-153), if `seedFromString` fails, propagate the error instead of setting `handPrng = null`

**Files modified**: `src/engine/orchestrator.ts`

## Milestone 3: Static Analysis Guard (Secondary Goal)

### Task 3.1: Create Math.random Scanner Test

- Create `tests/engine/no-math-random.test.ts`
- Use `fs.readFileSync` + regex to scan all `.ts` files in `src/ai/` and `src/engine/`
- Pattern to detect: `/Math\.random(?!\s*\)?\s*$)/` (match `Math.random` that is NOT part of a default parameter `= Math.random`)
- More precise: detect `Math.random` used as a value (passed as argument, assigned to variable, called directly) but NOT in function signature defaults
- Allowlist: `game-worker.ts` line with `randomDelay` (cosmetic only)
- Test fails if any non-allowlisted `Math.random` usage is found

**Files created**: `tests/engine/no-math-random.test.ts`

## Milestone 4: Deterministic Replay Test (Secondary Goal)

### Task 4.1: Create Deterministic Replay Test

- Create `tests/engine/deterministic-replay.test.ts`
- Set up a tournament with `initialSeed = "test-seed-007"` and fixed AI profiles
- Run tournament twice using `runTournament` directly (not via worker)
- Collect all `GameEvent` objects from both runs
- Assert: event count is identical, and every event matches (type, payload)
- Use `JSON.stringify` comparison for deep equality

### Task 4.2: Worker-Level Replay Test (Optional)

- If feasible in test environment, test deterministic replay through the Web Worker message interface
- This may require a mock worker environment

**Files created**: `tests/engine/deterministic-replay.test.ts`

## Milestone 5: Documentation (Final Goal)

### Task 5.1: Add JSDoc to Default Parameter Functions

- `src/ai/preflop.ts`: `makePreflopDecision` - add JSDoc noting `Math.random` default is for testing only
- `src/ai/postflop.ts`: `makePostflopDecision` - same
- `src/ai/action-selector.ts`: `selectAIAction` - same

**Files modified**: `src/ai/preflop.ts`, `src/ai/postflop.ts`, `src/ai/action-selector.ts`

## Technical Approach

- **Strategy**: Unify AI decision path through orchestrator only; worker delegates to orchestrator
- **Risk**: If the orchestrator's `runBettingRound` is not the actual code path used in production (if the worker bypasses it), the fix needs to be in the worker instead
- **Mitigation**: Add integration test that verifies the orchestrator path is used for AI in worker context

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Worker action provider is the actual production path | High - fix would be incomplete | Task 1.2 verification step; integration test |
| AI think delay removed breaks UI expectations | Medium - UX regression | Emit AI_THINKING event from orchestrator; UI handles delay |
| seedFromString failure in edge cases | Low - breaks tournament | Ensure seed is always provided; add fallback seed generation |
| Static analysis false positives | Low - flaky test | Maintain explicit allowlist with line references |
