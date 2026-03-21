import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background palette
        bg: {
          primary: '#0a0e14',
          surface: '#141b24',
          'surface-2': '#1c2530',
        },
        // Felt colors (unchanged)
        felt: {
          DEFAULT: '#1a5c2a',
          dark: '#0f3d1a',
          light: '#2d7a3f',
        },
        // Accent colors
        accent: {
          primary: '#3b82f6',
          danger: '#ef4444',
          warning: '#eab308',
          success: '#22c55e',
          info: '#6366f1',
          muted: '#64748b',
        },
        // Chip colors
        chip: {
          white: '#f0f0f0',
          red: '#cc3333',
          blue: '#3366cc',
          green: '#339933',
          black: '#333333',
        },
        // Card suit colors
        card: {
          red: '#dc2626',
          black: '#e5e7eb',
          face: '#1e293b',
          border: '#334155',
        },
        // Text colors
        text: {
          primary: '#f1f5f9',
          secondary: '#94a3b8',
          tertiary: '#64748b',
        },
      },
      fontFamily: {
        poker: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'poker-xs': ['12px', { lineHeight: '12px' }],
        'poker-sm': ['14px', { lineHeight: '17.5px' }],
        'poker-base': ['16px', { lineHeight: '24px' }],
        'poker-lg': ['18px', { lineHeight: '31.5px' }],
        'poker-xl': ['20px', { lineHeight: '40px' }],
        'poker-2xl': ['28px', { lineHeight: '70px' }],
      },
      boxShadow: {
        'level-0': 'none',
        'level-1': '0 1px 2px rgba(0,0,0,0.3)',
        'level-2': '0 2px 4px rgba(0,0,0,0.4)',
        'level-3': '0 4px 8px rgba(0,0,0,0.5)',
        'level-4': '0 8px 16px rgba(0,0,0,0.6)',
        'table': '0 4px 8px rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.3)',
        'glow-blue': '0 0 12px rgba(59, 130, 246, 0.4)',
        'glow-yellow': '0 0 12px rgba(234, 179, 8, 0.4)',
        'glow-green': '0 0 16px rgba(34, 197, 94, 0.5)',
        'inner-felt': 'inset 0 2px 4px rgba(0,0,0,0.3)',
      },
      animation: {
        'deal': 'deal 0.2s ease-out',
        'flip': 'flip 0.4s ease-in-out',
        'slide-chip': 'slideChip 0.3s ease-out',
        'active-pulse': 'activePulse 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
      },
      keyframes: {
        deal: {
          '0%': { transform: 'translateY(-60px) scale(0.7)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        slideChip: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-20px) scale(0.7)', opacity: '0' },
        },
        activePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.6)' },
          '50%': { boxShadow: '0 0 0 12px rgba(59, 130, 246, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
