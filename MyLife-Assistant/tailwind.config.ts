// tailwind.config.ts
import type { Config } from "tailwindcss"

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class", // ← ここを ["class"] ではなく "class" にする
  theme: { extend: {} },
  plugins: [],
} satisfies Config
