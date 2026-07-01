import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: '#0b6fb8',
        turquoise: '#1bc0c9',
        gold: '#d4af37',
      },
    },
  },
  plugins: [],
};
export default config;
