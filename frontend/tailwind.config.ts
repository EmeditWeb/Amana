import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Theme-aware surface / text / border tokens (CSS variables) ──
        "surface-0": "var(--color-surface-0)",
        "surface-1": "var(--color-surface-1)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",

        "bg-primary": "var(--color-bg-primary)",
        "bg-card": "var(--color-bg-card)",
        "bg-elevated": "var(--color-bg-elevated)",
        "bg-input": "var(--color-bg-input)",
        "bg-overlay": "var(--color-bg-overlay)",

        gold: "#D4A853",
        "gold-hover": "#E0BA6A",
        "gold-muted": "rgba(212,168,83,0.15)",
        emerald: "#34D399",
        "emerald-muted": "rgba(52,211,153,0.15)",
        "accent-emerald": "#34D399",
        teal: "#14B8A6",

        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-muted": "var(--color-text-muted)",
        "text-inverse": "var(--color-text-inverse)",

        "status-success": "#34D399",
        "status-warning": "#F59E0B",
        "status-danger": "#EF4444",
        "status-info": "#3B82F6",
        "status-locked": "#D4A853",
        "status-draft": "#6B7280",

        "border-subtle": "var(--color-border-subtle)",
        "border-default": "var(--color-border-default)",
        "border-raised": "var(--color-border-raised)",
        "border-hover": "var(--color-border-hover)",
        "border-focus": "var(--color-border-focus)",
      },
      backgroundColor: {
        "surface-0": "var(--color-surface-0)",
        "surface-1": "var(--color-surface-1)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",
        primary: "var(--color-bg-primary)",
        card: "var(--color-bg-card)",
        elevated: "var(--color-bg-elevated)",
        input: "var(--color-bg-input)",
        overlay: "var(--color-bg-overlay)",
      },
      textColor: {
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        muted: "var(--color-text-muted)",
        inverse: "var(--color-text-inverse)",
      },
      borderColor: {
        subtle: "var(--color-border-subtle)",
        default: "var(--color-border-default)",
        raised: "var(--color-border-raised)",
        hover: "var(--color-border-hover)",
        focus: "var(--color-border-focus)",
      },
      // ── Elevation / shadow scale ─────────────────────────────────────────
      boxShadow: {
        "elev-0": "none",
        "elev-1": "0 1px 4px rgba(0,0,0,0.25), 0 4px 24px rgba(0,0,0,0.3)",
        "elev-2": "0 4px 12px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.4)",
        "elev-3": "0 16px 48px rgba(0,0,0,0.5)",
        card: "0 1px 4px rgba(0,0,0,0.25), 0 4px 24px rgba(0,0,0,0.3)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.4)",
        "glow-gold": "0 0 20px rgba(212,168,83,0.2)",
        "glow-emerald": "0 0 20px rgba(52,211,153,0.15)",
        modal: "0 16px 48px rgba(0,0,0,0.5)",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
      },
      borderRadius: {
        none: "0",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "24px",
        full: "9999px",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "Geist",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        manrope: ["var(--font-manrope)", "Manrope", "sans-serif"],
        mono: [
          "var(--font-geist-mono)",
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["14px", { lineHeight: "1.5" }],
        base: ["16px", { lineHeight: "1.5" }],
        lg: ["18px", { lineHeight: "1.6" }],
        xl: ["20px", { lineHeight: "1.4" }],
        "2xl": ["24px", { lineHeight: "1.3" }],
        "3xl": ["30px", { lineHeight: "1.25" }],
        "4xl": ["36px", { lineHeight: "1.2" }],
        "5xl": ["48px", { lineHeight: "1.15" }],
        display: ["60px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      lineHeight: {
        tight: "1.2",
        normal: "1.5",
        relaxed: "1.75",
      },
      backgroundImage: {
        "gradient-hero":
          "linear-gradient(135deg, #0B1A14 0%, #122A1F 50%, #1A3D2C 100%)",
        "gradient-gold-cta":
          "linear-gradient(135deg, #D4A853 0%, #E0BA6A 100%)",
        "gradient-card-glow":
          "linear-gradient(135deg, rgba(52,211,153,0.05) 0%, rgba(212,168,83,0.05) 100%)",
      },
      animation: {
        "slide-up": "slide-up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
