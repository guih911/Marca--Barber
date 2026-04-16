/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0c0c0d',
        bronze: '#b98345',
        sand: '#f4eadf',
        ash: '#b8b2a8',
        smoke: '#1b1a19',
        pine: '#15342e',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 20px 80px rgba(185, 131, 69, 0.18)',
      },
      backgroundImage: {
        mesh: 'radial-gradient(circle at top left, rgba(185,131,69,0.22), transparent 32%), radial-gradient(circle at 80% 20%, rgba(71,126,110,0.18), transparent 26%), linear-gradient(180deg, #0c0c0d 0%, #141311 100%)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        appear: 'appear 700ms ease-out both',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        appear: {
          from: { opacity: 0, transform: 'translateY(18px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
