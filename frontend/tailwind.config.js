/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: '#1D9E75', light: '#E1F5EE', dark: '#085041' },
        navy:  { DEFAULT: '#0C1B2E', mid: '#1a2d45' },
        amber: { DEFAULT: '#EF9F27' },
        danger: { DEFAULT: '#E24B4A', light: '#FCEBEB' },
        warning: { DEFAULT: '#EF9F27', light: '#FFF3CD' },
        safe: { DEFAULT: '#1D9E75', light: '#E1F5EE' },
      },
      fontFamily: {
        head: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      borderRadius: { lg: '12px', xl: '20px' },
    },
  },
  plugins: [],
}
