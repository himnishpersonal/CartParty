import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)"]
      },
      colors: {
        ink: "var(--ink)",
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        line: "var(--line)",
        accent: "var(--accent)",
        vote: "var(--vote)",
        pass: "var(--pass)",
        drop: "var(--drop)"
      }
    }
  },
  plugins: []
} satisfies Config;
