/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fredoka One', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
      colors: {
        cream: '#FAF7F0',
        paper: '#F5EFE0',
        ink: '#2D2416',
        warm: {
          50: '#FFF8EE',
          100: '#FFEFD4',
          200: '#FFD99A',
          300: '#FFBD60',
          400: '#FF9B2E',
          500: '#F97316',
          600: '#DC5A0A',
          700: '#B54207',
          800: '#8F340A',
          900: '#742C0C',
        },
        sage: {
          100: '#E8F0E9',
          200: '#C8DEC9',
          300: '#A3C8A5',
          400: '#74AF77',
          500: '#4A9550',
        },
        blush: {
          100: '#FDE8E8',
          200: '#F9C0C0',
          300: '#F49090',
          400: '#EC5F5F',
          500: '#E03232',
        },
        sky: {
          100: '#E0F0FF',
          200: '#B8D8FF',
          300: '#82BCFF',
          400: '#4A9EFF',
          500: '#1A7EE8',
        }
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'paper': '0 2px 8px rgba(45, 36, 22, 0.12), 0 0 0 1px rgba(45, 36, 22, 0.04)',
        'lifted': '0 8px 24px rgba(45, 36, 22, 0.16), 0 2px 8px rgba(45, 36, 22, 0.08)',
        'deep': '0 16px 48px rgba(45, 36, 22, 0.2), 0 4px 12px rgba(45, 36, 22, 0.12)',
      }
    },
  },
  plugins: [],
}
