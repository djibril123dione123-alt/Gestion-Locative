/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      containers: {
        'tiny': '150px',
        'small': '220px',
      },
      colors: {
        brand: {
          paper: '#F2EDE3',
          surface: '#F8F4EC',
          ink: '#0D1B16',
          50: '#F2EDE3',
          100: '#E8E0D2',
          200: '#C7D7C4',
          300: '#9FC5A1',
          400: '#6FA77C',
          500: '#3F7A56',
          600: '#28523F',
          700: '#1F3B2E',
          800: '#14251E',
          900: '#0D1B16',
          950: '#08110E',
        },
        action: {
          50: '#FFF7ED',
          100: '#FFE8C7',
          200: '#FFD399',
          500: '#FF8A00',
          600: '#E67900',
          700: '#B85D00',
        },
        'confort-orange': {
          DEFAULT: '#F58220',
          light: '#FFA64D',
          dark: '#E06610',
        },
        // Or/champagne — même dégradé que l'emblème de marque (mark.svg, skGold),
        // pour que l'accent premium reste identique entre la vitrine et l'app.
        champagne: {
          50: '#FBF6EC',
          100: '#F1D9A6',
          300: '#E4C482',
          DEFAULT: '#D9AA5E',
          600: '#C99A4E',
          700: '#B8863E',
          900: '#8A6529',
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
      boxShadow: {
        premium: '0 24px 80px rgba(13, 27, 22, 0.14)',
        'premium-lg': '0 35px 120px rgba(13, 27, 22, 0.24)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
};
