# Texas Hold'em 8-Max SNG Practice Tool

Web-based simulation tool for practicing 8-max Sit & Go tournaments.
1 Human + 7 AI players with customizable strategy presets.

## Tech Stack

- **Frontend**: React 18 + TypeScript 5
- **State**: Zustand (immer middleware)
- **Styling**: Tailwind CSS 3
- **Build**: Vite 5
- **Evaluator**: Custom TS (Cactus Kev lookup table)
- **AI Compute**: Web Worker
- **RNG**: Seedable PRNG (xoshiro256**)
- **Testing**: Vitest + React Testing Library

## Features

- Real-time 8-max SNG simulation in the browser
- 6 AI presets: Nit, TAG, LAG, Station, Maniac, Shark
- Two-tier AI customization (Preset + Fine-tune)
- Event-sourced game engine with deterministic replay
- Hand history recording and analysis
- Responsive UI for desktop and mobile

## Development

```bash
npm install
npm run dev
```

## Design Document

See `docs/holdem_sng_design_doc_v4.2_final.docx` for the complete system design specification.

## License

Private
