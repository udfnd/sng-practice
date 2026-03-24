# holdem-sng — Product Overview

## Project Name and Description

**holdem-sng** is a web-based simulation environment for practicing 8-max Sit & Go (SNG) poker tournaments in Texas Hold'em format. The tool places one human player (hero) against seven AI-controlled opponents, providing a realistic practice environment with accurate game mechanics and strategy feedback.

The primary goal is skill development — players can practice ICM-aware decision-making, push/fold strategy, and tournament-specific adjustments without financial risk or real-time pressure from human opponents.

---

## Target Audience

- Poker players preparing for live or online SNG tournaments
- Students of poker theory who want to apply push/fold charts and ICM concepts interactively
- Intermediate players looking to improve positional awareness, aggression calibration, and end-game strategy
- Coaches or study groups who want a reproducible simulation environment for scenario analysis

---

## Core Features

### Tournament Engine
- 8-max SNG format with a realistic blind structure including antes
- Accurate stack management, side-pot calculation, and showdown resolution
- ICM-weighted equity calculations for prize pool distribution decisions
- Nash equilibrium push/fold tables integrated into AI decision logic

### AI Opponents
- 7 AI opponents per session, each with an assignable personality preset
- 6 built-in presets: Nit, TAG (Tight Aggressive), LAG (Loose Aggressive), Calling Station, Maniac, and Shark
- Position-aware hand ranges adjusted by stack depth and ICM pressure
- 5-situation preflop state machine (open-raise, limp, 3-bet, 4-bet, shove/call)
- Postflop decisions informed by board texture analysis and hand classification

### Strategy Tools
- Raise-or-fold mode (no-limp toggle) for short-stack discipline practice
- Real-time SPR (Stack-to-Pot Ratio) calculations driving postflop sizing
- Board clustering and texture classification for contextual decision-making

### Reproducibility and Analysis
- Seedable PRNG (xoshiro256**) for fully deterministic replays
- Event-sourced architecture: every game action is stored as an immutable event
- Batch simulation runner for AI calibration and variance analysis
- Determinism checker to verify reproducibility across runs

### Statistics and History
- Per-session statistics: VPIP, PFR, 3-bet %, c-bet %, and more
- IndexedDB hand history storage (up to 1000 hands, FIFO eviction)
- Session snapshots for pause-and-resume capability
- Export and import of hand history and configuration data

### User Interface
- Dark-mode Tailwind CSS interface
- Setup screen for configuring table composition and AI presets
- In-game table view with seat positions, card display, and action panel
- Results screen with session summary and statistical breakdown
- Side panel for live hand statistics

---

## Use Cases

| Use Case | Description |
|---|---|
| Push/fold drill | Practice ICM-correct shove/call decisions in late-SNG spots with varying stack depths |
| Aggression calibration | Use the raise-or-fold mode to build discipline against limping tendencies |
| Opponent modeling | Observe how different AI presets respond to various lines |
| Variance analysis | Run batch simulations to evaluate strategy robustness across large sample sizes |
| Session replay | Review hand history to identify mistakes and study decision points |
| Config export | Share session configurations or hand histories with study partners |

---

## Current Status

The project is in active development with a functional simulation loop, full AI decision pipeline, and comprehensive UI. Test coverage is at approximately 82% by file ratio (51 test files covering 62 source files). A design document (v4.2) exists capturing the architectural intent.

Recent development focus areas include UI/UX redesign, the raise-or-fold mode, and AI simulation verification tests.
