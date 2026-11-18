/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B0B0D',
          950: '#050506',
          900: '#0B0B0D',
          800: '#121216',
          700: '#191920',
          600: '#232330',
          500: '#33333f',
        },
        brand: {
          DEFAULT: '#FF1E2D',
          50: '#FFF1F2',
          100: '#FFE0E2',
          200: '#FFB8BD',
          300: '#FF8790',
          400: '#FF4D58',
          500: '#FF1E2D',
          600: '#E01020',
          700: '#B80A18',
          800: '#8C0712',
        },
        zinc: {
          850: '#18181b',
        },
      },
      fontFamily: {
        display: ['Anton', 'Impact', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
      maxWidth: {
        '8xl': '90rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.06), 0 12px 32px -12px rgba(0,0,0,.25)',
        card: '0 20px 45px -25px rgba(0,0,0,.55)',
        red: '0 18px 40px -18px rgba(255,30,45,.6)',
      },
      backgroundImage: {
        'grid-lines':
          'linear-gradient(to right, rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.045) 1px, transparent 1px)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shine: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        shine: 'shine 3s linear infinite',
      },
    },
  },
  plugins: [],
}
