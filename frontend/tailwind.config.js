/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        cream: {
          50: '#FAF8F5',
          100: '#F5EFE6',
          200: '#EBDDCD',
          300: '#DFC6AF',
          400: '#CEAA8D',
          500: '#B88B69',
        },
        chocolate: {
          400: '#A47454',
          500: '#7E5338',
          600: '#643F29',
          700: '#4D2F1E',
          800: '#382114',
          900: '#26150C',
          950: '#180D07',
        },
        warmdark: {
          700: '#342B25',
          750: '#2C231E',
          800: '#241D18',
          850: '#1D1612',
          900: '#17120F',
          950: '#110D0A',
        },
        terracotta: {
          400: '#E58A6C',
          500: '#D97757', // Anthropic accent
          600: '#C25E3E',
        }
      }
    },
  },
  plugins: [],
}
