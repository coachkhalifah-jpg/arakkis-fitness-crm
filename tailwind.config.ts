import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17212b",
        canvas: "#f7f8f5",
        brand: "#176b5b",
        "brand-dark": "#0e4c42",
      },
    },
  },
  plugins: [],
};

export default config;
