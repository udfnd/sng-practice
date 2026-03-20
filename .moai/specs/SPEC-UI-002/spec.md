# SPEC-UI-002: Table & Card Components

## Status: Draft
## Phase: 3 (UI)
## Priority: P1 (High)
## Dependencies: SPEC-UI-001, SPEC-ENGINE-001

---

## 1. Overview

Create the poker table visual components: SVG playing cards, community card display area, pot display, and dealer button indicator. Cards use SVG sprites for crisp rendering at all sizes.

## 2. Requirements (EARS Format)

### R1: SVG Card Components
**The system shall** render playing cards as SVG:
- 52 unique card faces (4 suits × 13 ranks)
- Card back design
- Face-down state (hole cards of opponents)
- Responsive sizing (scales with viewport)

### R2: Community Card Display
**The system shall** display community cards:
- Empty slots (pre-flop)
- Progressive reveal: 3 (flop), 1 (turn), 1 (river)
- Card deal animation (flip/slide)

### R3: Pot Display
**The system shall** show pot information:
- Main pot amount (prominent)
- Side pot amounts (labeled: Side Pot 1, 2, ...)
- Chip count formatting (e.g., 1.5K for 1500)

### R4: Dealer Button
**The system shall** display a dealer button (D):
- Positioned next to the current button player's seat
- Animates when moving to next player between hands

### R5: Table Background
**The system shall** render an oval poker table:
- Green felt texture (CSS/SVG)
- 8 seat positions distributed evenly around the oval
- Responsive to container size

## 3. Acceptance Criteria

- [ ] AC1: All 52 cards render correctly as SVG
- [ ] AC2: Card back renders for face-down cards
- [ ] AC3: Community cards show progressive dealing (empty → flop → turn → river)
- [ ] AC4: Pot display shows correct amounts with formatting
- [ ] AC5: Side pots displayed separately with labels
- [ ] AC6: Dealer button positioned at correct seat
- [ ] AC7: Cards and table scale correctly on resize
- [ ] AC8: Card deal animation plays smoothly (≥ 30fps)

## 4. Files to Create

```
src/components/table/Table.tsx           - Poker table component
src/components/table/CommunityCards.tsx  - Community card display
src/components/table/PotDisplay.tsx      - Pot amount display
src/components/table/DealerButton.tsx    - Dealer button
src/components/card/Card.tsx             - Individual card (SVG)
src/components/card/CardBack.tsx         - Card back design
src/assets/cards/                        - SVG card assets
tests/components/table/Table.test.tsx    - Table component tests
tests/components/card/Card.test.tsx      - Card rendering tests
```

## 5. Design Doc Reference

- Section 9.1: Layout (Table area)
- Section 9.2: SVG cards, CSS transform animations
