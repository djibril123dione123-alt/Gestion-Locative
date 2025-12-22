/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 🎨 Palette personnalisée Confort Immo Archi
        'confort-orange': {
          DEFAULT: '#F58220',
          light: '#FFA64D',
          dark: '#E06610',
        },
        'confort-red': {
          DEFAULT: '#C0392B',
          light: '#E74C3C',
          dark: '#A93226',
        },
        'confort-gray': {
          DEFAULT: '#555555',
          light: '#707070',
          dark: '#3A3A3A',
        },
      },
    },
  },
  plugins: [],
};
