import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--foreground)",
        canvas: "var(--background)",
        brand: "var(--accent)",
        "brand-dark": "var(--accent-active)",
        sand: "var(--surface-elevated)",
        coral: "var(--danger)",
        admin: {
          background: "var(--admin-background)",
          surface: "var(--admin-surface)",
          border: "var(--admin-border)",
          text: "var(--admin-text)",
          "text-muted": "var(--admin-text-muted)",
          success: "var(--admin-success)",
        },
        slate: {
          50: "var(--surface-elevated)",
          100: "var(--surface-elevated)",
          200: "var(--border)",
          300: "var(--border)",
          400: "var(--foreground-subtle)",
          500: "var(--foreground-subtle)",
          600: "var(--foreground-muted)",
          700: "var(--foreground-muted)",
          800: "var(--foreground)",
          900: "var(--foreground)",
        },
        amber: {
          50: "var(--warning-soft)",
          100: "var(--warning-soft)",
          200: "var(--warning)",
          300: "var(--warning)",
          700: "var(--warning-hover)",
          800: "var(--warning-hover)",
          900: "var(--foreground)",
          950: "var(--foreground)",
        },
        red: {
          50: "var(--danger-soft)",
          100: "var(--danger-soft)",
          200: "var(--danger)",
          300: "var(--danger)",
          700: "var(--danger-hover)",
          800: "var(--danger-hover)",
        },
        green: {
          100: "var(--success-soft)",
          800: "var(--success-hover)",
        },
        emerald: {
          700: "var(--success-hover)",
          800: "var(--success-hover)",
        },
      },
      boxShadow: {
        soft: "0 18px 50px rgba(10, 12, 15, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
