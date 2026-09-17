import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
        semaforo: {
          rojo: "#dc2626",
          rojoBg: "#fee2e2",
          ambar: "#d97706",
          ambarBg: "#fef3c7",
          verde: "#16a34a",
          verdeBg: "#dcfce7",
        },
      },
    },
  },
  plugins: [],
};

export default config;
