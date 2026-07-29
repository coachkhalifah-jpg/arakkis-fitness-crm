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
        sand: "#f3eee6",
        coral: "#d66d55",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 33, 43, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
