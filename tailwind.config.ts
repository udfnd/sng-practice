import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a5c2a',
          dark: '#0f3d1a',
          light: '#2d7a3f',
        },
        chip: {
          white: '#f0f0f0',
          red: '#cc3333',
          blue: '#3366cc',
          green: '#339933',
          black: '#333333',
        },
        card: {
          red: '#cc0000',
          black: '#1a1a1a',
        },
      },
      fontFamily: {
        poker: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'deal': 'deal 0.3s ease-out',
        'flip': 'flip 0.4s ease-in-out',
        'slide-chip': 'slideChip 0.3s ease-out',
      },
      keyframes: {
        deal: {
          '0%': { transform: 'translateY(-30px) scale(0.8)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        flip: {
          '0%': { transform: 'rotateY(0deg)' },
          '50%': { transform: 'rotateY(90deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
        slideChip: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-20px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
