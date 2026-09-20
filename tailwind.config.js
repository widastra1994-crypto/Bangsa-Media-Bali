/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#030816',
          900: '#050b1f',
          800: '#0a1330',
        },
        ebtblue: '#0052D4',
        cyan: {
          royal: '#4364F7',
        },
        gold: {
          DEFAULT: '#D4AF37',
          soft: '#E8CE7B',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'nusatech-gradient':
          'radial-gradient(circle at 15% 10%, rgba(67,100,247,0.25), transparent 45%), radial-gradient(circle at 85% 0%, rgba(0,82,212,0.25), transparent 40%), linear-gradient(160deg, #030816 0%, #050b1f 45%, #0a1330 100%)',
      },
      boxShadow: {
        'gold-glow': '0 0 25px -5px rgba(212,175,55,0.45)',
        'blue-glow': '0 0 35px -8px rgba(67,100,247,0.55)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 14s linear infinite',
        glow: 'glow 2.4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
        glow: {
          '0%, 100%': { opacity: 0.6, filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.6))' },
          '50%': { opacity: 1, filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.9))' },
        },
      },
    },
  },
  plugins: [],
}
