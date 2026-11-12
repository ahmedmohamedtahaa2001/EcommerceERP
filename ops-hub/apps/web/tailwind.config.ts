import type { Config } from "tailwindcss";

/**
 * Flora.ds tokens (see UI_PLAN.md §2 and design.md at the repo root),
 * mirrored one-to-one with the CSS variables in src/styles/globals.css.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--flora-primary)",
          light: "var(--flora-primary-light)",
          lightest: "var(--flora-primary-lightest)",
          dark: "var(--flora-primary-dark)",
          darkest: "var(--flora-primary-darkest)",
        },
        secondary: {
          DEFAULT: "var(--flora-secondary)",
          light: "var(--flora-secondary-light)",
          lightest: "var(--flora-secondary-lightest)",
          dark: "var(--flora-secondary-dark)",
          darkest: "var(--flora-secondary-darkest)",
        },
        bg: "var(--flora-bg)",
        surface: "var(--flora-surface)",
        ink: {
          100: "var(--flora-ink-100)",
          200: "var(--flora-ink-200)",
          300: "var(--flora-ink-300)",
          400: "var(--flora-ink-400)",
          500: "var(--flora-ink-500)",
          600: "var(--flora-ink-600)",
          700: "var(--flora-ink-700)",
          800: "var(--flora-ink-800)",
          900: "var(--flora-ink-900)",
        },
        success: {
          DEFAULT: "var(--flora-success)",
          light: "var(--flora-success-light)",
        },
        warning: {
          DEFAULT: "var(--flora-warning)",
          light: "var(--flora-warning-light)",
        },
        alert: {
          DEFAULT: "var(--flora-alert)",
          light: "var(--flora-alert-light)",
        },
        info: {
          DEFAULT: "var(--flora-info)",
          light: "var(--flora-info-light)",
        },
      },
      fontFamily: {
        sans: ["Nunito Sans", "Cairo", "system-ui", "sans-serif"],
        arabic: ["Cairo", "Nunito Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        caption: ["12px", { lineHeight: "1.5" }],
        body2: ["14px", { lineHeight: "1.5" }],
        body1: ["16px", { lineHeight: "1.5" }],
        subtitle2: ["18px", { lineHeight: "1.2" }],
        subtitle1: ["20px", { lineHeight: "1.2" }],
        heading6: ["22px", { lineHeight: "1.2" }],
        heading5: ["24px", { lineHeight: "1.2" }],
        heading4: ["28px", { lineHeight: "1.2" }],
        heading3: ["32px", { lineHeight: "1.2" }],
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "4px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        pill: "999px",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.06)",
        sm: "0 2px 4px 0 rgba(0,0,0,0.08)",
        md: "0 4px 8px 0 rgba(0,0,0,0.10)",
        lg: "0 8px 16px 0 rgba(0,0,0,0.12)",
      },
      maxWidth: {
        content: "80rem",
        wide: "90rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
