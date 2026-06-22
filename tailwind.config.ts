import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        ink: "#0a0a0f",
      },
      fontFamily: {
        sans: ["var(--font-thai)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
