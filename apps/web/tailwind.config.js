/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090909',
        surface: {
          DEFAULT: '#111111',
          elevated: '#181818',
          hover: '#1F1F1F',
          active: '#242424',
        },
        border: {
          DEFAULT: '#272727',
          subtle: '#1E1E1E',
          focus: '#3F3F46',
        },
        primary: {
          DEFAULT: 'var(--color-primary, #06B6D4)',
          hover: 'var(--color-primary-hover, #0891B2)',
          foreground: '#FFFFFF',
        },
        text: {
          primary: '#F4F4F5',
          secondary: '#A1A1AA',
          muted: '#71717A',
        },
        status: {
          running: '#10B981',
          starting: '#06B6D4',
          stopping: '#F59E0B',
          offline: '#71717A',
          error: '#EF4444',
          installing: '#8B5CF6',
        },
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
