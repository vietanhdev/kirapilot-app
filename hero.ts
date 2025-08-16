import {heroui} from "@heroui/react";

export default heroui({
  defaultTheme: "dark",
  themes: {
    dark: {
      colors: {
        background: "#0a0a0a",
        foreground: "#ffffff",
        primary: {
          50: "#f0fdf4",
          100: "#dcfce7", 
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          DEFAULT: "#22c55e",
          foreground: "#ffffff",
        },
        default: {
          100: "#262626",
          200: "#404040",
          300: "#525252", 
          400: "#737373",
          500: "#a3a3a3",
          600: "#d4d4d4",
          DEFAULT: "#525252",
          foreground: "#ffffff",
        },
      },
    },
  }
}); 