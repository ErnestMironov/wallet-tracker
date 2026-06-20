/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0052FF',
        surface: '#111214',
        card: '#18191d',
        border: '#2a2b2f',
        muted: '#6b7280',
      },
    },
  },
  plugins: [],
};
