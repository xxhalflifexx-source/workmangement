import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#2563eb",
          "blue-strong": "#1d4ed8",
          orange: "#f97316",
          gray: "#1e293b",
          "gray-soft": "#334155",
          border: "#e2e8f0",
          surface: "#ffffff",
          "surface-muted": "#f7f9fc",
          bg: "#f4f6fb",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          '"Segoe UI"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        floating: "0 20px 45px -18px rgba(15, 23, 42, 0.25)",
        subtle: "0 8px 24px -12px rgba(15, 23, 42, 0.15)",
      },
    },
  },
  plugins: [],
};
export default config;



