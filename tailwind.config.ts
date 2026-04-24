import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // NoFish Brand Colors
        'maritime-teal': {
          600: '#00796b',
          700: '#00695c',
          800: '#004d40',
        },
        'coastal-red': {
          600: '#e53935',
          700: '#d32f2f',
          800: '#c62828',
        },
      },
    },
  },
  plugins: [],
}

export default config
