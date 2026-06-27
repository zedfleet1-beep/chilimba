/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,js,tsx,jsx}'],
  theme: {
    extend: {
      colors: {
        // Existing emerald palette (kept for AuthLayout / brand references).
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        // "Light mood" extension — warm, sunny, friendly. Used by AppLayout
        // and the new admin / customer / group pages.
        warm: {
          50: '#fffaf2',
          100: '#fef3e2',
          200: '#fde6c2',
          500: '#f59e0b',
          600: '#d97706',
        },
        cream: {
          50: '#fffdf7',
          100: '#fdf6e3',
        },
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
        },
        coral: {
          500: '#fb7185',
          600: '#f43f5e',
        },
      },
      boxShadow: {
        // A softer, warmer card shadow for the "light mood" surfaces.
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.04)',
      },
      fontFamily: {
        // A slightly rounded, friendly display face for headings.
        display: ['"Quicksand"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
