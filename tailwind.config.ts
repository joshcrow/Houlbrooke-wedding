import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF7EC",
        ink: "#34435E",
        blue: {
          soft: "#9DB1D4",
          DEFAULT: "#6E89B7",
          deep: "#3E5C8A",
        },
        lemon: {
          soft: "#FBE9A0",
          DEFAULT: "#F2D06B",
          deep: "#E2B53C",
        },
        sage: "#A9BE92",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        script: ["var(--font-script)", "cursive"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(62, 92, 138, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
