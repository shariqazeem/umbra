import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Umbra design system — Premium Financial.
 *
 * Light-first. Background #FAFAFA · Surface #FFFFFF · Ink #111111 ·
 * Secondary #6B7280 · Hairline #E5E7EB · Signal #FF3B00 (cryptographic moments only).
 * Soft radii (12–20px), layered low-opacity shadows, Inter UI / JetBrains Mono data.
 * Tokens are HSL CSS variables defined in styles/globals.css.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Umbra brand tokens. `signal` is reserved for cryptographic moments ONLY.
        umbra: {
          paper: "#FAFAFA",
          surface: "#FFFFFF",
          ink: "#111111",
          muted: "#6B7280",
          hairline: "#E5E7EB",
          signal: "#FF3B00",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "var(--radius)", // 12px
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        signal: "var(--shadow-signal)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["clamp(2.75rem, 6vw, 4.5rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-sm": ["clamp(2rem, 4vw, 2.75rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      maxWidth: {
        shell: "1080px",
        prose: "560px",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
