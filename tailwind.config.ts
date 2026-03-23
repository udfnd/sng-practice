import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background palette — references CSS variables (single source of truth)
        bg: {
          primary:    'var(--bg-primary)',
          surface:    'var(--bg-surface)',
          'surface-2': 'var(--bg-surface-2)',
        },
        // Felt colors
        felt: {
          DEFAULT: 'var(--felt-color)',
          dark:    'var(--felt-dark)',
          light:   'var(--felt-light)',
        },
        // Accent colors
        accent: {
          primary: 'var(--accent-primary)',
          danger:  'var(--accent-danger)',
          warning: 'var(--accent-warning)',
          success: 'var(--accent-success)',
          info:    'var(--accent-info)',
          muted:   'var(--accent-muted)',
        },
        // Chip colors
        chip: {
          white: 'var(--chip-white)',
          red:   'var(--chip-red)',
          blue:  'var(--chip-blue)',
          green: 'var(--chip-green)',
          black: 'var(--chip-black)',
        },
        // Card suit colors
        card: {
          red:    'var(--card-red)',
          black:  'var(--card-black)',
          face:   'var(--card-face)',
          border: 'var(--card-border)',
        },
        // Text colors
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
        },
      },
      fontFamily: {
        poker: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'poker-xs':  ['12px', { lineHeight: '12px' }],
        'poker-sm':  ['14px', { lineHeight: '17.5px' }],
        'poker-base':['16px', { lineHeight: '24px' }],
        'poker-lg':  ['18px', { lineHeight: '31.5px' }],
        'poker-xl':  ['20px', { lineHeight: '40px' }],
        'poker-2xl': ['28px', { lineHeight: '70px' }],
      },
      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      transitionDuration: {
        fast:   'var(--motion-fast)',
        normal: 'var(--motion-normal)',
        slow:   'var(--motion-slow)',
      },
      boxShadow: {
        'level-0':    'var(--shadow-level-0)',
        'level-1':    'var(--shadow-level-1)',
        'level-2':    'var(--shadow-level-2)',
        'level-3':    'var(--shadow-level-3)',
        'level-4':    'var(--shadow-level-4)',
        'table':      '0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3)',
        'glow-blue':  'var(--shadow-glow-blue)',
        'glow-yellow':'var(--shadow-glow-yellow)',
        'glow-green': 'var(--shadow-glow-green)',
        'inner-felt': 'inset 0 2px 4px rgba(0,0,0,0.3)',
      },
      animation: {
        'deal':           'deal 200ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'flip':           'flip 0.4s ease-in-out',
        'slide-chip':     'slideChip 0.3s ease-out',
        'active-pulse':   'activePulse 1.5s ease-in-out infinite',
        'fade-in':        'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        // New animations
        'chip-to-pot':    'chipToPot 300ms ease-out forwards',
        'pot-award':      'potAward 500ms ease-in-out',
        'win-glow':       'winGlow 800ms ease-in-out',
        'win-glow-gold':  'winGlowGold 800ms ease-in-out 2',
        'card-flip':      'cardFlip 400ms ease-in-out',
        'stack-change':   'stackChange 300ms ease-out',
      },
      keyframes: {
        deal: {
          '0%':   { transform: 'translateY(-60px) scale(0.7)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        flip: {
          '0%':   { transform: 'rotateY(0deg)' },
          '50%':  { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        slideChip: {
          '0%':   { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-20px) scale(0.7)', opacity: '0' },
        },
        activePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.6)' },
          '50%':      { boxShadow: '0 0 0 12px rgba(59, 130, 246, 0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        // New keyframes
        chipToPot: {
          '0%':   { transform: 'translateX(0) translateY(0) scale(0.8)', opacity: '0' },
          '100%': { transform: 'translateX(var(--tx, 0px)) translateY(var(--ty, 0px)) scale(1)', opacity: '1' },
        },
        potAward: {
          '0%':   { transform: 'scale(1)' },
          '20%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '0.8' },
        },
        winGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(34, 197, 94, 0)' },
          '50%':      { boxShadow: '0 0 16px rgba(34, 197, 94, 0.5)' },
        },
        winGlowGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(234, 179, 8, 0)' },
          '50%':      { boxShadow: '0 0 24px rgba(234, 179, 8, 0.6)' },
        },
        cardFlip: {
          '0%':   { transform: 'rotateY(0deg)' },
          '50%':  { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        stackChange: {
          '0%':   { transform: 'translateY(0)' },
          '50%':  { transform: 'translateY(-4px)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
