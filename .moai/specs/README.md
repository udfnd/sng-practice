# SPEC Index — Texas Hold'em 8-Max SNG Practice Tool

## Phase 1: Engine + Worker (Foundation)

| SPEC | Name | Priority | Dependencies | Status |
|------|------|----------|-------------|--------|
| SPEC-ENGINE-001 | Core Types & Card System | P0 | None | Draft |
| SPEC-ENGINE-002 | Hand Evaluator | P0 | ENGINE-001 | Draft |
| SPEC-ENGINE-003 | Pot Manager | P0 | ENGINE-001 | Draft |
| SPEC-ENGINE-004 | Betting Round | P0 | ENGINE-001, ENGINE-003 | Draft |
| SPEC-ENGINE-005 | Game State Machine | P0 | ENGINE-001~004 | Draft |
| SPEC-ENGINE-006 | Event System & Invariants | P0 | ENGINE-001, ENGINE-005 | Draft |
| SPEC-ENGINE-007 | Web Worker | P1 | ENGINE-001~006 | Draft |

## Phase 2: AI + Tournament

| SPEC | Name | Priority | Dependencies | Status |
|------|------|----------|-------------|--------|
| SPEC-AI-001 | AI Presets & Range Tables | P0 | ENGINE-001 | Draft |
| SPEC-AI-002 | Preflop Decision Engine | P0 | AI-001, ENGINE-004 | Draft |
| SPEC-AI-003 | Postflop Decision Engine | P1 | AI-001, AI-002, ENGINE-002 | Draft |
| SPEC-AI-004 | Tournament Manager | P0 | ENGINE-005, ENGINE-006 | Draft |
| SPEC-AI-005 | Calibration & Validation | P1 | AI-001~004, ENGINE-007 | Draft |

## Phase 3: UI

| SPEC | Name | Priority | Dependencies | Status |
|------|------|----------|-------------|--------|
| SPEC-UI-001 | Project Setup & Layout | P0 | ENGINE-007 | Draft |
| SPEC-UI-002 | Table & Card Components | P1 | UI-001, ENGINE-001 | Draft |
| SPEC-UI-003 | Player Seats & Action Panel | P1 | UI-001, UI-002 | Draft |
| SPEC-UI-004 | Game Flow & Zustand Store | P0 | UI-001~003, ENGINE-007 | Draft |

## Phase 4: Polish

| SPEC | Name | Priority | Dependencies | Status |
|------|------|----------|-------------|--------|
| SPEC-POLISH-001 | Storage & Persistence | P1 | ENGINE-006, AI-004, UI-004 | Draft |
| SPEC-POLISH-002 | Hand History & Stats | P2 | POLISH-001, UI-004 | Draft |
| SPEC-POLISH-003 | AI Tuning & Settings UI | P2 | AI-001, UI-001, POLISH-001 | Draft |

## Dependency Graph (Simplified)

```
ENGINE-001 (Types/Card/PRNG)
├── ENGINE-002 (Evaluator)
├── ENGINE-003 (Pot)
│   └── ENGINE-004 (Betting)
│       └── ENGINE-005 (State Machine)
│           └── ENGINE-006 (Events)
│               └── ENGINE-007 (Worker)
├── AI-001 (Presets/Range)
│   ├── AI-002 (Preflop)
│   │   └── AI-003 (Postflop)
│   └── AI-004 (Tournament)
│       └── AI-005 (Calibration)
└── UI-001 (Setup)
    ├── UI-002 (Table/Cards)
    │   └── UI-003 (Seats/Action)
    │       └── UI-004 (Store/Flow)
    └── POLISH-001 (Storage)
        ├── POLISH-002 (History)
        └── POLISH-003 (Settings)
```

## Design Document

`docs/holdem_sng_design_doc_v4.2_final.docx` — System Design Document v4.2 (Final)
