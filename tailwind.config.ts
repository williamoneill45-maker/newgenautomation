import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        form: "0 1px 2px rgba(15, 23, 42, 0.08), 0 1px 8px rgba(15, 23, 42, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
