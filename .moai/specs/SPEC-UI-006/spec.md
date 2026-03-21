# SPEC-UI-006: Modern UI/UX Design Plan

## Metadata

| Field    | Value                      |
| -------- | -------------------------- |
| SPEC ID  | SPEC-UI-006                |
| Title    | Modern UI/UX Design Plan   |
| Created  | 2026-03-21                 |
| Status   | Design Document Complete   |
| Priority | Medium                     |
| Related  | SPEC-UI-001, SPEC-UI-004, SPEC-UI-005 |

---

## Environment

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom theme in `tailwind.config.ts`
- **Current Theme**: Dark mode with felt green table (`--felt-color: #1a5c2a`)
- **Fonts**: Inter (system-ui fallback)
- **Components**: `src/components/` with layout/, seat/, table/, card/, setup/, results/ directories
- **Animations**: CSS keyframes (deal, flip, chipSlide, activePulse, fadeIn, slideInRight)
- **Current Layout**: Full-height flex column (TopBar + TableArea + ActionPanel), SidePanel slides from right on mobile
- **Responsive**: Basic responsive with `sm:` breakpoints, `safe-bottom` for notched phones

## Assumptions

- A1: This SPEC produces a design document (blueprint), not implementation code
- A2: The design plan will be executed across multiple future implementation SPECs
- A3: The existing component architecture (React + Tailwind) will be preserved
- A4: No external UI library (e.g., shadcn, MUI) will be introduced; all components are custom
- A5: The target audience is poker enthusiasts practicing SNG strategy; not a real-money platform
- A6: Mobile-first design is critical because most poker practice happens on phones
- A7: Accessibility must meet WCAG 2.1 AA compliance at minimum

## Requirements

### Ubiquitous Requirements

- R1: The design system **shall** define a comprehensive token set (colors, typography, spacing, elevation) documented in this SPEC as the single source of truth for all future UI work.
- R2: All interactive elements **shall** meet WCAG 2.1 AA color contrast requirements (4.5:1 for normal text, 3:1 for large text).
- R3: All designs **shall** be described in text/ASCII wireframe format within this document, not as implementation code.

### Event-Driven Requirements

- R4: **When** the design plan is approved, **then** it **shall** be decomposed into granular implementation SPECs (one per design area).
- R5: **When** a card is dealt, the design **shall** specify a dealing animation path from a deck position to the target player/community card slot.
- R6: **When** a pot is awarded, the design **shall** specify a chip collection animation from pot to winner.

### State-Driven Requirements

- R7: **While** in the preflop phase, the design **shall** prioritize showing: player stacks, position badges, hole cards, and blind level.
- R8: **While** in postflop phases, the design **shall** additionally show: community cards (prominent), pot size, and current bet amounts.
- R9: **While** it is the human player's turn, the design **shall** maximize ActionPanel visibility and provide clear call-to-action hierarchy.
- R10: **While** in a mobile portrait viewport, the design **shall** use a compact layout with the table occupying the top 60% and action controls in the bottom 40%.

### Optional Requirements

- R11: **Where possible**, the design **shall** include a HUD (Heads-Up Display) overlay showing AI opponent stats (VPIP, PFR).
- R12: **Where possible**, the design **shall** include a hand strength meter for the human player.
- R13: **Where possible**, the design **shall** plan keyboard shortcuts for all primary actions.
- R14: **Where possible**, the design **shall** plan sound effects for key events (deal, bet, fold, win, all-in).

## Specifications

### 1. Visual Design System

#### 1.1 Color Palette

```
Core Colors:
  Background:   #0a0e14 (deep navy-black)
  Surface:      #141b24 (card/panel background)
  Surface-2:    #1c2530 (elevated panels)
  Felt:         #1a5c2a (table green, unchanged)
  Felt-dark:    #0f3d1a (table border, unchanged)

Accent Colors:
  Primary:      #3b82f6 (blue - human player, call actions)
  Danger:       #ef4444 (red - fold, all-in)
  Warning:      #eab308 (yellow - raise/bet, dealer button)
  Success:      #22c55e (green - win, check)
  Info:         #6366f1 (indigo - info badges)

Chip Colors:
  White:   #f0f0f0  (1 unit)
  Red:     #cc3333  (5 units)
  Blue:    #3366cc  (25 units)
  Green:   #339933  (100 units)
  Black:   #333333  (500 units)

Card Colors:
  Hearts/Diamonds:  #dc2626 (red suits)
  Spades/Clubs:     #e5e7eb (light gray on dark)
  Card Face:        #1e293b (dark card background)
  Card Border:      #334155 (subtle border)

Text:
  Primary:    #f1f5f9 (bright white)
  Secondary:  #94a3b8 (muted gray)
  Tertiary:   #64748b (dimmed)
  On-accent:  #ffffff (text on colored backgrounds)
```

#### 1.2 Typography Scale

```
Font Stack: 'Inter', system-ui, -apple-system, sans-serif
Monospace:  'JetBrains Mono', 'Fira Code', monospace (for chip amounts)

Scale:
  xs:    0.75rem / 1.0   (10px at 16px base) - bet amounts, badges
  sm:    0.875rem / 1.25  (12px) - player names, stats
  base:  1rem / 1.5       (14px) - default body text
  lg:    1.125rem / 1.75  (16px) - pot amount, action buttons
  xl:    1.5rem / 2.0     (20px) - hand number, headlines
  2xl:   2rem / 2.5       (28px) - tournament results

Weights:
  Regular (400): body text, descriptions
  Medium (500): labels, navigation
  Semibold (600): player names, amounts
  Bold (700): action buttons, headings

Chip Amounts: tabular-nums, monospace font for alignment
```

#### 1.3 Spacing System

```
Base unit: 4px (0.25rem)

Scale:
  0.5: 2px   - card gaps
  1:   4px   - icon padding
  1.5: 6px   - tight spacing
  2:   8px   - element padding
  3:   12px  - group spacing
  4:   16px  - section padding
  6:   24px  - section gaps
  8:   32px  - major sections
  12:  48px  - layout gaps
  16:  64px  - top-level padding
```

#### 1.4 Elevation System

```
Level 0: No shadow (flat elements, felt surface)
Level 1: 0 1px 2px rgba(0,0,0,0.3)  (cards, badges)
Level 2: 0 2px 4px rgba(0,0,0,0.4)  (player seats, panels)
Level 3: 0 4px 8px rgba(0,0,0,0.5)  (floating menus, modals)
Level 4: 0 8px 16px rgba(0,0,0,0.6) (dealer button highlight)

Special:
  Glow:  0 0 12px rgba(accent, 0.4) (active player highlight)
  Inner: inset 0 2px 4px rgba(0,0,0,0.3) (felt surface)
```

### 2. Table Layout Redesign

#### 2.1 Desktop Layout (ASCII Wireframe)

```
+-------------------------------------------------------------------+
| [Level 3: 25/50 (5)] [Hand #42]        [75.0 BB] [6 players] [BB]|  <- TopBar
+-------------------------------------------------------------------+
|                                                                   |
|              [P7]                 [P8]                [P1]        |
|                                                                   |
|       [P6]    +-------------------------------------------+      |
|               |        Community Cards Area               |[P2]  |
|               |    [Ac] [Kh] [7d] [__] [__]             |      |
|       [P5]    |           Pot: 450                        |      |
|               +-------------------------------------------+[P3]  |
|                                                                   |
|                         [P4]                                      |
|                     (Human - YOU)                                  |
|                                                                   |
+-------------------------------------------------------------------+
| [FOLD]  [CHECK]  [CALL 100]  [|====slider====|]  [RAISE 200]    |
| [2.5x] [3x] [4x]  [1/2] [3/4] [Pot]  [ALL-IN 1500]            |  <- ActionPanel
+-------------------------------------------------------------------+
```

#### 2.2 Mobile Portrait Layout (ASCII Wireframe)

```
+---------------------------+
| Lv3: 25/50  Hand#42  [BB]|  <- TopBar (compact)
+---------------------------+
|    [P5] [P6] [P7] [P8]   |  <- Opponents (compact arc)
|                           |
|  [P4]+---+---+---+---+   |
|      |Ac |Kh |7d |   |   |  <- Community cards (centered)
|      +---+---+---+---+   |
|        Pot: 450           |
|                           |
|    [P1] [P2] [P3]        |  <- Opponents (compact arc)
|                           |
| YOU: 1,500  [Ah][Ks]     |  <- Human player (fixed bottom)
+---------------------------+
| [FOLD] [CHECK] [CALL 100]|
| [========slider========] |
| [2.5x][3x][4x][1/2][Pot]|
| [ALL-IN 1500]            |  <- ActionPanel (40% height)
+---------------------------+
```

#### 2.3 Table Visual Design

- **Felt texture**: CSS gradient or subtle SVG pattern on the oval table
- **Table border**: 3D bevel effect using box-shadow (inner shadow + outer shadow)
- **Dealer button**: White circle with "D", subtle drop shadow, positioned near active dealer seat
- **Blind chips**: Small colored circles near SB/BB seats showing blind amounts
- **Card dealing area**: Cards animate from center-top of table to each player seat position

### 3. Information Architecture

#### 3.1 Information Priority by Phase

| Phase     | Essential (Always Show)            | Detail (Show on Hover/Tap) | Hidden |
| --------- | ---------------------------------- | -------------------------- | ------ |
| PREFLOP   | Stacks, position, hole cards, blinds | AI profile type, stats    | Community cards |
| FLOP      | Community cards, pot, stacks, bets | Hand strength, outs        | Blind level detail |
| TURN      | Community cards, pot, stacks, bets | Hand strength, outs        | - |
| RIVER     | Community cards, pot, stacks, bets | Hand strength              | Outs (no more draws) |
| SHOWDOWN  | Hands, winner, pot awarded         | Hand name, stats update    | Betting controls |

#### 3.2 HUD Design (Optional)

```
+-------+
| P2    |
| TAG   |  <- Profile type badge
| 19/16 |  <- VPIP/PFR compact display
| 1,200 |  <- Stack
+-------+
```

- Toggle via settings
- Non-intrusive: small overlay on player seat
- Show VPIP/PFR as `{vpip}/{pfr}` in percentage
- Color-coded profile badge: Nit=gray, TAG=blue, LAG=orange, Station=green, Maniac=red, Shark=purple

#### 3.3 Hand Strength Meter (Optional)

```
Human player's hand:
[||||||||----] Top Pair, Good Kicker
  (relative strength indicator, 0-100%)
```

- Displayed below human player's hole cards
- Color gradient: red (weak) -> yellow (medium) -> green (strong)
- Text label: "High Card", "Pair", "Two Pair", etc.
- Only visible during postflop (preflop: hidden or show starting hand category)

### 4. Interaction Patterns

#### 4.1 Bet Sizing Interface

```
Current design (keep and enhance):
  [========slider========] [value]
  [1/2] [3/4] [Pot] [preset] [preset]

Enhancements:
  - Slider: larger touch target (44px minimum height)
  - Presets: pill-shaped buttons, responsive wrapping
  - Manual input: tap the value display to enter exact amount
  - BB mode presets: [2.5x] [3x] [4x] when BB display active
```

#### 4.2 Quick Action Placement

```
Desktop:  [FOLD] [CHECK/CALL] [BET/RAISE] [ALL-IN]
          Left              Center              Right

Mobile:   [FOLD]  [CHECK/CALL]  [BET/RAISE]
          Full-width row, equal sizing
          [ALL-IN] separate row below
```

- Fold: always leftmost (least desired action, deliberate reach)
- Check/Call: center (default/safe action)
- Bet/Raise: right side (aggressive action)
- All-in: separate, with confirmation on mobile (prevent accidental)

#### 4.3 Keyboard Shortcuts

| Key | Action |
| --- | ------ |
| F   | Fold |
| C   | Check / Call |
| R   | Raise (opens slider) |
| A   | All-in |
| 1-9 | Preset bet sizes |
| Space | Confirm current action |
| Esc | Cancel / close modal |

#### 4.4 Sound Effects Plan

| Event | Sound Type | File Suggestion |
| ----- | ---------- | --------------- |
| Card deal | Soft snap | `deal.mp3` |
| Chip bet | Chip stack click | `bet.mp3` |
| Check | Soft tap | `check.mp3` |
| Fold | Card slide | `fold.mp3` |
| All-in | Dramatic chip push | `allin.mp3` |
| Win pot | Chip collection | `win.mp3` |
| Blind level up | Subtle chime | `levelup.mp3` |
| Your turn | Attention ping | `turn.mp3` |

- Master volume control in settings
- Individual event toggles
- Default: sounds ON

### 5. Responsive Strategy

#### 5.1 Breakpoint System

```
Mobile portrait:   < 640px  (sm)  - Compact table, stacked layout
Mobile landscape:  640-768px       - Wider table, side controls
Tablet:           768-1024px (md)  - Full table, hover states
Desktop:          1024px+ (lg)     - Maximum info density, side panel
```

#### 5.2 Adaptive Components

| Component   | Mobile Portrait        | Mobile Landscape      | Tablet/Desktop         |
| ----------- | ---------------------- | --------------------- | ---------------------- |
| Table       | 60% height, oval      | 50% height, wider     | Centered, full oval    |
| Player Seats| Compact (name+stack)  | Medium (+ position)   | Full (+ cards + stats) |
| ActionPanel | Bottom 40%, stacked   | Bottom 30%, inline    | Bottom bar, inline     |
| Cards       | Small (32x44px)       | Medium (40x56px)      | Large (52x72px)        |
| SidePanel   | Slide overlay          | Slide overlay         | Always visible right   |
| TopBar      | 1 row, compact        | 1 row, medium         | 1 row, full            |
| HUD         | Hidden                 | Minimal               | Full display           |

#### 5.3 Touch Optimization

- All interactive targets: minimum 44x44px
- Bet slider: 48px track height on mobile
- Action buttons: minimum 48px height
- Card tap area: extends beyond visible card by 8px padding
- Swipe gesture: left/right to adjust bet (future consideration)

### 6. Accessibility Plan

#### 6.1 ARIA Labels

| Element | ARIA | Value |
| ------- | ---- | ----- |
| Fold button | aria-label | "Fold hand" |
| Call button | aria-label | "Call {amount}" (dynamic) |
| Bet slider | aria-label, aria-valuetext | "Bet amount: {value} chips" or "Bet amount: {value} big blinds" |
| Player seat | aria-label | "{name}, {chips} chips, {position}" |
| Community cards | aria-label | "Community cards: {card descriptions}" |
| Toggle | aria-pressed | true/false for BB toggle |
| Cards | aria-label | "Ace of spades", "King of hearts" |

#### 6.2 Keyboard Navigation

```
Tab order:
  1. TopBar controls (settings, toggle)
  2. Community cards (read-only)
  3. Action buttons (Fold -> Check/Call -> Bet/Raise -> All-in)
  4. Bet slider
  5. Preset buttons
  6. Side panel toggle
```

#### 6.3 Color Contrast Compliance

| Element | Foreground | Background | Ratio | Pass? |
| ------- | ---------- | ---------- | ----- | ----- |
| Body text | #f1f5f9 | #0a0e14 | 16.2:1 | AA |
| Secondary text | #94a3b8 | #0a0e14 | 6.8:1 | AA |
| Button text | #ffffff | #3b82f6 | 4.6:1 | AA |
| Danger button | #ffffff | #ef4444 | 4.6:1 | AA |
| Warning text | #eab308 | #0a0e14 | 9.1:1 | AA |
| Chip amount | #f1f5f9 | #141b24 | 13.5:1 | AA |

#### 6.4 Screen Reader Game Events

- Announce dealing: "Cards dealt. Your hand: Ace of spades, King of hearts"
- Announce actions: "Player 3 raises to 200"
- Announce turn: "It is your turn. You can fold, call 100, or raise"
- Announce winner: "You won 450 chips with top pair"
- Use `aria-live="polite"` region for game event announcements

### 7. Micro-Interactions

#### 7.1 Card Dealing Sequence

```
Timing:
  1. Deck appears at center-top of table (0ms)
  2. First card flies to first player (0-200ms)
  3. Second card flies to second player (100-300ms, overlapping)
  4. ... continues for all active players
  5. Second round same pattern (staggered 100ms each)

CSS: transform + opacity transition with cubic-bezier(0.4, 0, 0.2, 1)
Duration: 200ms per card, 100ms stagger
```

#### 7.2 Chip Animation

```
Bet placed:
  - Chip stack appears at player seat
  - Slides toward pot area (300ms ease-out)
  - Fades into pot total

Pot awarded:
  - Pot chips scatter briefly (100ms)
  - Collect toward winner seat (400ms ease-in-out)
  - Winner's stack count animates up
```

#### 7.3 Win Celebration

```
Small pot win:
  - Subtle green glow on winner seat (500ms)
  - Stack count ticks up with counter animation

Large pot / all-in win:
  - Bright golden glow pulse (800ms)
  - Confetti particles (optional, 1.5s)
  - Stack count ticks up with emphasis
```

#### 7.4 Turn Timer (Optional)

```
Visual:
  - Circular progress ring around human player seat
  - Starts at 100%, counts down to 0%
  - Color transition: green -> yellow -> red
  - Duration: configurable (default 30s for tournament)

Behavior:
  - Auto-fold on timeout (or auto-check if no bet facing)
  - Warning pulse at 10s remaining
  - Sound notification at 5s remaining
```

---

## Implementation Roadmap

This design plan should be decomposed into the following future implementation SPECs:

| Future SPEC | Scope | Priority |
| ----------- | ----- | -------- |
| SPEC-UI-007 | Design System Tokens (colors, typography, spacing in Tailwind config) | Primary |
| SPEC-UI-008 | Table Layout Redesign (oval table, seat positions, card areas) | Primary |
| SPEC-UI-009 | ActionPanel Redesign (touch targets, presets, keyboard shortcuts) | Primary |
| SPEC-UI-010 | Animation System (dealing, chip movement, win celebration) | Secondary |
| SPEC-UI-011 | Responsive Refinement (mobile portrait/landscape, tablet) | Secondary |
| SPEC-UI-012 | Accessibility (ARIA labels, keyboard nav, screen reader) | Secondary |
| SPEC-UI-013 | HUD & Hand Strength Meter | Optional |
| SPEC-UI-014 | Sound Effects System | Optional |
| SPEC-UI-015 | Turn Timer | Optional |

---

## Traceability

| Requirement | Plan Reference          | Acceptance Reference |
| ----------- | ----------------------- | -------------------- |
| R1          | M1: Design Tokens       | AC-1                 |
| R2          | M1: Color Contrast      | AC-2                 |
| R3          | All sections            | AC-3                 |
| R4          | Implementation Roadmap  | AC-4                 |
| R5-R6       | M3: Animations          | AC-5                 |
| R7-R9       | M2: Info Architecture   | AC-6                 |
| R10         | M4: Responsive          | AC-7                 |
| R11-R14     | M5: Optional Features   | AC-8                 |

---

## Design Document Status

**Completion**: The comprehensive design blueprint has been created and documented in `design.md` at `/Users/seungmok/WebstormProjects/sng-practice/holdem-sng/.moai/specs/SPEC-UI-006/design.md`.

**What's Included in design.md:**

1. **Visual Design System (Part 1)**: Complete color palette with 30+ defined colors, typography scale, spacing system (4px-based), elevation/shadow system, motion tokens
2. **Table Layout Blueprint (Part 2)**: Desktop, mobile portrait, mobile landscape, and tablet layouts with ASCII wireframes
3. **Information Architecture (Part 3)**: Phase-specific information display, HUD design, hand strength meter specifications
4. **Component Design Specs (Part 4)**: Detailed specs for PlayingCard, PlayerSeat, ActionPanel, SidePanel, TopBar, PokerTable with visual states and sizing
5. **Interaction Patterns (Part 5)**: Betting flow, keyboard shortcuts (F/C/R/A keys), sound effects plan with 8 event types
6. **Responsive Strategy (Part 6)**: 4 breakpoints (mobile portrait < 640px, landscape 640-768px, tablet 768-1024px, desktop 1024px+) with adaptive component changes
7. **Accessibility (Part 7)**: WCAG 2.1 AA compliance verified, ARIA labels, keyboard navigation, screen reader announcements
8. **Micro-Interactions (Part 8)**: Card dealing animation sequences, chip movements, win celebrations, turn timer design
9. **Implementation Roadmap (Part 9)**: 10 future SPECs (SPEC-UI-007 through SPEC-UI-015) with scope, priority, and estimated LOE

**Next Step**: Begin implementation with SPEC-UI-007 (Design Token System) to establish Tailwind config based on this blueprint.
