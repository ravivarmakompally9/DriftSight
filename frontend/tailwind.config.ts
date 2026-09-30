import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** Every colour is a CSS variable so light, dark and system themes share one scale. */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        sunken: "var(--sunken)",
        line: { DEFAULT: "var(--border)", strong: "var(--border-2)" },
        ink: { DEFAULT: "var(--text)", 2: "var(--text-2)", 3: "var(--text-3)" },
        brand: { DEFAULT: "var(--brand)", 2: "var(--brand-2)", soft: "var(--brand-soft)" },
        navy: { DEFAULT: "var(--navy)", 2: "var(--navy-2)" },
        onnavy: { DEFAULT: "var(--on-navy)", 2: "var(--on-navy-2)" },
        ok: { DEFAULT: "var(--ok)", soft: "var(--ok-soft)" },
        warn: { DEFAULT: "var(--warn)", soft: "var(--warn-soft)" },
        crit: { DEFAULT: "var(--crit)", soft: "var(--crit-soft)" },
        violet: { DEFAULT: "var(--violet)", soft: "var(--violet-soft)" },
        pellet: "var(--pellet)",
        current: "var(--current)",
      },
      fontFamily: {
        display: ["Dosis", "Trebuchet MS", "sans-serif"],
        sans: ["Figtree", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "Menlo", "monospace"],
      },
      borderRadius: { xl: "12px", lg: "10px", md: "8px", sm: "6px" },
      boxShadow: {
        card: "0 1px 2px rgb(14 26 43 / 0.06), 0 4px 16px rgb(14 26 43 / 0.05)",
        float: "0 8px 30px rgb(14 26 43 / 0.12)",
        modal: "0 20px 60px rgb(0 0 0 / 0.3)",
      },
      keyframes: {
        slide: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(260%)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        slide: "slide 1.1s ease-in-out infinite",
        "fade-in": "fade-in .2s ease-out",
        rise: "rise .24s cubic-bezier(.2,.8,.3,1)",
      },
    },
  },
  plugins: [animate],
};
export default config;
