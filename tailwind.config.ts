import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "var(--aigs-50)",
          100: "var(--aigs-100)",
          200: "var(--aigs-200)",
          300: "var(--aigs-300)",
          400: "var(--aigs-400)",
          500: "var(--aigs-500)",
          600: "var(--aigs-600)",
          700: "var(--aigs-700)",
          800: "var(--aigs-800)",
          900: "var(--aigs-900)",
        },
      },
      fontFamily: {
        sans: ["var(--font-aigs-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-aigs-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
