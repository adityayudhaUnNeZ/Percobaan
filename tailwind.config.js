/** @type {import('tailwindcss').Config} */
const path = require("path");

module.exports = {
  content: [
    path.join(__dirname, "public/**/*.html"),
    path.join(__dirname, "public/**/*.js"),
    path.join(__dirname, "src/**/*.{js,css}"),
    path.join(__dirname, "frontend/index.html"),
    path.join(__dirname, "frontend/src/**/*.{html,js,css}")
  ],
  theme: {
    extend: {
      colors: {
        pinkSoft: "#ec4899",
        turquoise: "#14b8a6",
        blush: {
          50: "#fff5f7",
          100: "#ffe6ee",
          200: "#ffc8d9"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.12)"
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
        barPulse: {
          "0%, 100%": { transform: "scaleY(0.35)", opacity: "0.6" },
          "50%": { transform: "scaleY(1)", opacity: "1" }
        }
      },
      animation: {
        marquee: "marquee 18s linear infinite",
        bar: "barPulse 1.2s ease-in-out infinite"
      }
    }
  },
  plugins: [],
  corePlugins: {
    preflight: false
  }
};
