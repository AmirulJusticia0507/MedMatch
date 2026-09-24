/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: "#173b3a",
        canvas: "#f4f7f3",
        brand: "#1e8b72",
        mint: "#dff3e9"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 59, 58, 0.10)"
      }
    }
  },
  plugins: []
};
