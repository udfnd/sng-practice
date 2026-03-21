# SPEC-UI-006: Implementation Plan

## Overview

This is a design plan SPEC. The output is a comprehensive UI/UX blueprint that will be decomposed into multiple future implementation SPECs. No code is produced by this SPEC; instead, it creates the design foundation and roadmap for all future UI work.

---

## Milestone 1 (Primary Goal): Design Token Definition

**Objective**: Establish the complete design system token set as the foundation for all UI work.

### Tasks

1. **Color Palette Finalization**
   - Define all color tokens (background, surface, accent, chip, card, text)
   - Verify WCAG 2.1 AA contrast ratios for all foreground/background combinations
   - Document color usage guidelines (which colors for which purposes)
   - Map colors to Tailwind config extensions

2. **Typography Scale**
   - Define font stack (Inter + monospace for amounts)
   - Define size scale (xs through 2xl)
   - Define weight usage patterns
   - Specify tabular-nums for all numeric displays

3. **Spacing System**
   - Define 4px base unit scale
   - Document component-specific spacing patterns
   - Define touch target minimums per breakpoint

4. **Elevation System**
   - Define shadow levels 0-4
   - Define special effects (glow, inner shadow)
   - Map to Tailwind shadow utilities

### Deliverables
- Color token table with hex values and contrast ratios
- Typography reference sheet
- Spacing scale documentation
- Elevation examples with use cases

---

## Milestone 2 (Primary Goal): Layout & Information Architecture

**Objective**: Define the table layout, seat positioning, and information hierarchy.

### Tasks

1. **Table Layout Design**
   - Desktop: oval table with 8 seat positions around the perimeter
   - Mobile portrait: compact table (60% height) with stacked opponents
   - Mobile landscape: wider table with side controls
   - Define coordinate system for seat positions (percentage-based for responsiveness)

2. **Information Priority Matrix**
   - Map essential vs detail vs hidden information per game phase
   - Define progressive disclosure patterns (tap-to-reveal on mobile)
   - Design HUD overlay concept for opponent stats

3. **Component Hierarchy**
   - TopBar: blind level, hand number, player count, toggles
   - TableArea: felt surface, community cards, pot display, seats
   - ActionPanel: action buttons, slider, presets
   - SidePanel: log, stats, settings

4. **Wireframe Production**
   - Desktop wireframe (ASCII)
   - Mobile portrait wireframe (ASCII)
   - Mobile landscape wireframe (ASCII)
   - Tablet wireframe (ASCII)

### Deliverables
- Layout wireframes for 4 viewports
- Information priority matrix
- Component hierarchy diagram
- Seat position coordinate system

---

## Milestone 3 (Secondary Goal): Interaction & Animation Design

**Objective**: Define all interactions, animations, and micro-interactions.

### Tasks

1. **Action Button Interaction**
   - Define button states (default, hover, active, disabled)
   - Define touch feedback patterns (scale, color shift)
   - Map keyboard shortcuts to actions
   - Design confirmation pattern for all-in on mobile

2. **Card Animation Choreography**
   - Define dealing animation timing (stagger, duration, easing)
   - Define card flip animation for showdown
   - Define community card placement animation

3. **Chip Movement Animation**
   - Define bet-to-pot animation path
   - Define pot-to-winner collection animation
   - Define stack count animation (tick-up counter)

4. **Win Celebration Design**
   - Small pot: subtle glow
   - Large pot: golden pulse + optional particles
   - All-in showdown win: extended celebration

5. **Sound Effect Mapping**
   - Map events to sound categories
   - Define volume levels and priority
   - Design mute/settings UI

### Deliverables
- Animation timing specification
- Interaction state diagrams
- Sound effect mapping table
- Keyboard shortcut reference

---

## Milestone 4 (Secondary Goal): Responsive & Accessibility Design

**Objective**: Define responsive behavior and accessibility requirements.

### Tasks

1. **Breakpoint Behavior**
   - Define component behavior at each breakpoint
   - Define show/hide rules for information density
   - Design adaptive card sizes
   - Plan SidePanel behavior (overlay vs always-visible)

2. **Touch Optimization**
   - Define minimum touch targets per viewport
   - Design slider interaction for mobile
   - Plan gesture support (swipe for bet adjustment)

3. **ARIA Specification**
   - Define aria-labels for all interactive elements
   - Define aria-live regions for game announcements
   - Define tab order and focus management
   - Plan screen reader narrative for game flow

4. **Color Contrast Audit**
   - Verify all color combinations meet AA standards
   - Document any exceptions with justification
   - Plan high-contrast mode (optional)

### Deliverables
- Responsive behavior matrix
- Touch target specification
- ARIA label table
- Contrast audit results

---

## Milestone 5 (Optional Goal): Advanced Feature Design

**Objective**: Design optional features that enhance the experience.

### Tasks

1. **HUD Design**
   - Layout for stat overlay on player seats
   - Toggle mechanism
   - Stat display format (VPIP/PFR compact)

2. **Hand Strength Meter**
   - Visual design (bar/ring indicator)
   - Placement relative to human player
   - Color gradient mapping (strength to color)

3. **Turn Timer Design**
   - Circular progress indicator
   - Color transition scheme
   - Auto-action behavior

### Deliverables
- HUD mockup (ASCII)
- Hand strength meter concept
- Timer interaction flow

---

## Technical Approach

### Design Principles

1. **Mobile-first**: All designs start from mobile portrait and scale up
2. **Progressive disclosure**: Show essential info by default, detail on demand
3. **Consistent tokens**: All visual properties derived from the design token system
4. **Performance-conscious**: Animations use CSS transforms (GPU-accelerated), not layout properties
5. **Accessible by default**: Every interactive element has an accessible counterpart

### How This Plan Becomes Code

```
SPEC-UI-006 (this plan)
  |
  v
SPEC-UI-007: Tailwind config update (tokens -> tailwind.config.ts, globals.css)
SPEC-UI-008: TableArea refactor (layout -> PokerTable.tsx, seat positions)
SPEC-UI-009: ActionPanel refactor (interactions -> ActionPanel.tsx)
SPEC-UI-010: Animation system (animations -> CSS keyframes, transition utilities)
SPEC-UI-011: Responsive refinement (breakpoints -> component responsive classes)
SPEC-UI-012: Accessibility (ARIA -> component attributes, keyboard handler)
SPEC-UI-013: HUD + hand strength (new components)
SPEC-UI-014: Sound system (new audio utility + asset files)
SPEC-UI-015: Turn timer (new component + game store extension)
```

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Design plan too abstract to implement | Medium | Medium | Include specific values (hex codes, pixel sizes, timing) not just concepts |
| Responsive design breaks existing layout | Medium | High | Implement token system first (SPEC-UI-007), then refactor layout |
| Animation performance on low-end devices | Low | Medium | Use CSS transforms only; provide reduced-motion fallback |
| Accessibility scope creep | Medium | Low | Prioritize AA compliance first; AAA as optional enhancement |
| Sound assets licensing | Low | Low | Use open-source sound libraries (Freesound, OpenGameArt) |
