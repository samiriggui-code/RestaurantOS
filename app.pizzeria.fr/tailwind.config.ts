import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,90,62,0.4) 0%, transparent 65%), linear-gradient(180deg, #0c0704 0%, #1A1412 100%)',
        'flame-gradient':
          'linear-gradient(135deg, #9A2E1A 0%, #E85A3E 55%, #f59e0b 100%)',
        'grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(232,90,62,0.25), 0 20px 60px -20px rgba(194,59,34,0.45)',
        card: '0 30px 80px -40px rgba(0,0,0,0.8)',
      },
      animation: {
        'fade-up': 'fadeUp 0.8s ease-out forwards',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'panel-in': 'panelIn 0.35s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        panelIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
