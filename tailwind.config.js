/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bcs: {
          primary: '#c10e0e',
          slate: '#1f2937',
          muted: '#64748b',
        },
      },
    },
  },
  plugins: [],
}
