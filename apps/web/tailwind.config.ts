import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* Atmospheric lab — blue-black glass, warm paper ink */
        base: "#07080C",
        panel: "#101218",
        "panel-2": "#181B24",
        rule: "#2A2F3C",
        ink: "#F0EBE3",
        muted: "#9AA3B5",
        breaker: "#5AD4FF",
        fixer: "#8EF0A8",
        verdict: "#FFB347",
        accent: "#5AD4FF",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        body: ["var(--font-ui)", "ui-serif", "Georgia", "serif"],
      },
      transitionTimingFunction: {
        "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
