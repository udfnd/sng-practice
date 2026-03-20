# SPEC-UI-001: Project Setup & Layout

## Status: Draft
## Phase: 3 (UI)
## Priority: P0 (Foundation)
## Dependencies: SPEC-ENGINE-007

---

## 1. Overview

Initialize the React 18 + Vite 5 project with TypeScript 5, Tailwind CSS 3, and Zustand state management. Create the responsive application shell with Top Bar, Table area, Seats, Action panel, and Side panel zones.

## 2. Requirements (EARS Format)

### R1: Project Scaffold
**The system shall** initialize a Vite 5 project with:
- React 18 + TypeScript 5 (strict mode)
- Tailwind CSS 3
- Zustand with immer middleware
- Vitest + React Testing Library
- ESLint + Prettier

### R2: Responsive Layout Shell
**The system shall** provide a responsive layout with breakpoints:
- Desktop: ≥ 1200px (full layout)
- Tablet: ≥ 768px (condensed)
- Mobile: < 768px (stacked)

### R3: Layout Zones
**The system shall** define 5 layout zones:
- **Top Bar**: Blind level, remaining hands, player count, avg stack, M-ratio
- **Table**: Community cards, pot display, dealer button
- **Seats**: 8 seat positions arranged around table
- **Action Panel**: Fold/Check/Call/Raise buttons + slider + presets
- **Side Panel**: Hand history, opponent profiles, action log

### R4: Theme System
**The system shall** implement CSS variable-based theming:
- Dark green default (poker table aesthetic)
- Dark/Light mode toggle
- All colors via CSS custom properties

### R5: Performance Targets
- FCP (First Contentful Paint): < 2s
- UI Frame Rate: ≥ 30fps during animations
- Lighthouse performance score: ≥ 90

## 3. Acceptance Criteria

- [ ] AC1: `npm run dev` starts the development server without errors
- [ ] AC2: `npm run build` produces production build without errors
- [ ] AC3: TypeScript strict mode enabled with zero type errors
- [ ] AC4: Responsive layout renders correctly at all 3 breakpoints
- [ ] AC5: All 5 layout zones visible on desktop view
- [ ] AC6: Dark/Light theme toggle works
- [ ] AC7: Vitest runs successfully with sample test
- [ ] AC8: Tailwind CSS classes apply correctly

## 4. Files to Create

```
package.json                   - Dependencies
vite.config.ts                 - Vite configuration
tsconfig.json                  - TypeScript config (strict)
tailwind.config.ts             - Tailwind configuration
postcss.config.js              - PostCSS config
index.html                     - Entry HTML
src/main.tsx                   - React entry point
src/App.tsx                    - Root component with layout zones
src/components/layout/         - TopBar, TableArea, SeatArea, ActionPanel, SidePanel
src/styles/                    - Global CSS, theme variables
vitest.config.ts               - Vitest configuration
```

## 5. Design Doc Reference

- Section 1.3: Tech Stack
- Section 9.1: Layout
- Section 9.2: Responsive & Theme
- Section 10.1: Performance (FCP, frame rate)
