import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Thème rose foncé / blanc
        rose: {
          50: "#fdf2f6",
          100: "#fce7ef",
          200: "#fbd0e0",
          300: "#f8a9c6",
          400: "#f272a3",
          500: "#e84785",
          600: "#d62568",
          700: "#b51753",
          800: "#961446",
          900: "#7d143d",
          950: "#4d0421",
        },
        brand: {
          DEFAULT: "#961446", // rose foncé principal
          dark: "#7d143d",
          light: "#fce7ef",
        },
        critique: "#dc2626",
        attention: "#f59e0b",
        ok: "#16a34a",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
