/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primaria: '#6366f1',
        'primaria-escura': '#4f46e5',
      },
    },
  },
  plugins: [],
}
