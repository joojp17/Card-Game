import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151313",
        ruby: "#b91c1c",
        emerald: "#047857",
        amber: "#d97706",
        pearl: "#f7f2ea"
      },
      boxShadow: {
        card: "0 18px 60px rgba(16, 24, 40, 0.12)"
      }
    }
  },
  plugins: []
} satisfies Config;
