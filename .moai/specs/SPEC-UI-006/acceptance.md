# SPEC-UI-006: Acceptance Criteria

## AC-1: Design Token Completeness

**Given** the design plan is finalized
**When** the color palette section is reviewed
**Then** it contains:
- At least 5 background/surface colors with hex values
- At least 5 accent colors with hex values and usage descriptions
- Chip and card color sets
- Text color hierarchy (primary, secondary, tertiary)

**Given** the design plan is finalized
**When** the typography section is reviewed
**Then** it contains:
- Font stack specification
- At least 5 size levels with rem values
- Weight usage guidelines
- Numeric display formatting rules

---

## AC-2: Color Contrast Compliance

**Given** the color palette is defined
**When** each foreground/background combination is tested
**Then** all combinations meet WCAG 2.1 AA minimum contrast ratios:
- Normal text: 4.5:1 minimum
- Large text (18px+ or 14px+ bold): 3:1 minimum
- UI components and graphical objects: 3:1 minimum

---

## AC-3: Design Is Descriptive, Not Code

**Given** the entire SPEC-UI-006 document
**When** the content is reviewed
**Then** it contains zero implementation code (no React components, no TypeScript)
**And** all layouts are described via ASCII wireframes or text descriptions
**And** all specifications use design language (tokens, values, behaviors), not code syntax

---

## AC-4: Implementation Roadmap

**Given** the design plan is approved
**When** the implementation roadmap section is reviewed
**Then** it contains:
- At least 5 distinct future SPEC identifiers (SPEC-UI-007 through SPEC-UI-015)
- Each future SPEC has a clear scope description
- Each future SPEC has a priority level (Primary, Secondary, Optional)
- The SPECs are ordered by dependency (tokens before layout, layout before animations)

---

## AC-5: Animation Specifications

**Given** the animation section is reviewed
**When** card dealing animation is described
**Then** it specifies:
- Animation duration in milliseconds
- Stagger timing between cards
- Easing function name or cubic-bezier value
- Start and end states (position, opacity, scale)

**When** chip movement animation is described
**Then** it specifies:
- Animation path (from player to pot, from pot to winner)
- Duration and easing
- Visual feedback (stack count update)

---

## AC-6: Information Architecture

**Given** the information architecture section is reviewed
**When** the phase-based priority matrix is checked
**Then** it maps Essential/Detail/Hidden information for at least 4 game phases:
- PREFLOP
- FLOP/TURN/RIVER (postflop)
- SHOWDOWN
- Human player's turn

---

## AC-7: Responsive Design Coverage

**Given** the responsive strategy section is reviewed
**When** viewport coverage is checked
**Then** it contains design specifications for at least 3 viewports:
- Mobile portrait (< 640px)
- Tablet (768-1024px)
- Desktop (1024px+)

**And** each viewport specification includes:
- Table layout description or wireframe
- Component sizing adaptations
- Information density adjustments

---

## AC-8: Accessibility Specification

**Given** the accessibility section is reviewed
**When** ARIA specifications are checked
**Then** ARIA labels are defined for at least:
- All action buttons (Fold, Call, Check, Raise, All-in)
- Bet slider
- Player seat elements
- Community cards
- Toggle controls

**When** keyboard navigation is checked
**Then** a tab order is defined covering all interactive elements
**And** keyboard shortcuts are mapped to primary actions

---

## AC-9: Optional Feature Designs

**Given** the optional features section is reviewed
**When** the HUD design is checked
**Then** it describes layout, toggle mechanism, and stat display format

**When** the hand strength meter is checked
**Then** it describes visual representation, placement, and color mapping

---

## Quality Gate Criteria

- [ ] All 7 design system sections are complete (color, typography, spacing, elevation, layout, interaction, responsive)
- [ ] Color contrast audit covers all primary text/background combinations
- [ ] ASCII wireframes exist for desktop and mobile portrait viewports
- [ ] Information priority matrix covers all game phases
- [ ] Accessibility section defines ARIA labels for all interactive elements
- [ ] Implementation roadmap lists at least 5 future SPECs with priorities
- [ ] Animation specifications include timing, easing, and state descriptions
- [ ] No implementation code in the document
- [ ] Sound effect mapping covers at least 5 game events
- [ ] Keyboard shortcuts are mapped for primary actions
