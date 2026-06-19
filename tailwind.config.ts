import type { Config } from "tailwindcss";

// Дизайн-система «Студия» (light). Акценты blue/emerald/green/amber совпадают с
// дефолтами Tailwind; добавляем семантические нейтральные поверхности и тени.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#f6f7f9", // серый шелл (страница/холст)
        paper: "#ffffff", // белые панели/карточки
        line: "#e4e7ec", // hairline-границы
        "line-soft": "#eef0f3",
        raised: "#eef0f3", // hover/неактивные заливки
        sunken: "#f9fafb", // инпут-веллы, zebra
        ink: "#111827", // заголовки
      },
      boxShadow: {
        sm: "0 1px 2px rgba(16,24,40,0.06)",
        md: "0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)",
        lg: "0 4px 12px rgba(16,24,40,0.10), 0 2px 4px rgba(16,24,40,0.06)",
        xl: "0 12px 32px rgba(16,24,40,0.14), 0 4px 8px rgba(16,24,40,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
