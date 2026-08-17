/** @type {import('tailwindcss').Config} */
/** Palette alignée sur app.pizzeria.fr — tomato / cream / charcoal */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tomato: {
          DEFAULT: '#C23B22',
          dark: '#9A2E1A',
          light: '#E85A3E',
        },
        cream: {
          DEFAULT: '#F5E6D3',
          muted: '#E8D5BC',
        },
        charcoal: {
          DEFAULT: '#1A1412',
          soft: '#2A2220',
        },
        primary: {
          50: '#fdf3f1',
          100: '#fbe4de',
          200: '#f5c4b8',
          300: '#eb9a88',
          400: '#E85A3E',
          500: '#C23B22',
          600: '#9A2E1A',
          700: '#7a2415',
          800: '#5c1b10',
          900: '#3d120b',
          950: '#1A1412',
        },
        secondary: {
          50: '#fdf8f3',
          100: '#F5E6D3',
          200: '#E8D5BC',
          300: '#d4bc9a',
          400: '#b89a72',
          500: '#9a7d55',
        },
        surface: {
          50: '#F5E6D3',
          100: '#E8D5BC',
          200: '#c9b8a5',
          300: '#9a8b82',
          400: '#6b625c',
          500: '#4a4340',
          600: '#3a332f',
          700: '#2A2220',
          800: '#1A1412',
          900: '#15100e',
          950: '#100c0b',
        },
        brand: {
          gold: '#D4A853',
          cream: '#F5E6D3',
          tomato: '#C23B22',
          charcoal: '#1A1412',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.35), 0 10px 20px -2px rgba(0, 0, 0, 0.25)',
        glow: '0 0 20px rgba(194, 59, 34, 0.28)',
        'glow-lg': '0 0 40px rgba(194, 59, 34, 0.35)',
        card: '0 1px 3px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.45)',
        'card-hover': '0 10px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.35)',
        modal: '0 25px 50px -12px rgba(0, 0, 0, 0.55)',
        elevated: '0 4px 6px -2px rgba(0,0,0,0.35), 0 12px 16px -4px rgba(0,0,0,0.45)',
        'inner-glow': 'inset 0 1px 2px rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(194,59,34,0.35) 0%, transparent 60%)',
        grain:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.25s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'count-up': 'countUp 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'card-enter': 'cardEnter 0.5s ease-out both',
        'fade-up': 'fadeUp 0.8s ease-out forwards',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        bounceIn: { '0%': { opacity: '0', transform: 'scale(0.3)' }, '50%': { transform: 'scale(1.05)' }, '70%': { transform: 'scale(0.9)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        countUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        cardEnter: { '0%': { opacity: '0', transform: 'translateY(20px) scale(0.97)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
