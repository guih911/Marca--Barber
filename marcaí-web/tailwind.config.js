/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        neutral: {
          950: '#0B0B0C',
          900: '#111111',
          800: '#1B1B1B',
          100: '#F5F2EE',
          0: '#FFFFFF',
        },
        primaria: {
          DEFAULT: '#B8894D',
          escura: '#8C6239',
          clara: '#F3E4D2',
          brilho: '#D7B37C',
        },
        fundo: '#F5F2EE',
        superficie: '#FFFFFF',
        sidebar: {
          DEFAULT: '#111111',
          hover: '#1B1B1B',
          ativo: '#2A2018',
          texto: '#C5B08A',
          textoAtivo: '#FFFFFF',
          borda: '#23201D',
        },
        texto: {
          DEFAULT: '#151515',
          sec: '#6F6A63',
          ter: '#9A948B',
        },
        sucesso: '#0E9F6E',
        alerta: '#F59E0B',
        perigo: '#EF4444',
        info: '#3B82F6',
        borda: '#E2D7CA',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
        'card-md': '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 10px -2px rgba(0,0,0,0.05)',
        'card-lg': '0 12px 32px -8px rgba(0,0,0,0.1), 0 4px 8px -2px rgba(0,0,0,0.04)',
        primaria: '0 8px 28px rgba(184,137,77,0.28), 0 2px 8px rgba(184,137,77,0.12)',
        glow: '0 0 32px rgba(184,137,77,0.2)',
        nav: '0 -8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        header: '0 1px 0 rgba(0,0,0,0.04), 0 8px 24px -6px rgba(0,0,0,0.06)',
        sidebarActive: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { transform: 'translateX(-8px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.15s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'float-slow': 'float-slow 5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
