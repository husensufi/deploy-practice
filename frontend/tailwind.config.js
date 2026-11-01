/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        plum: "#3f1b3d",
        rose: "#d6667a",
        teal: "#2f7a6b",
        ivory: "#fbf5f2",
      },
    },
  },
  plugins: [],
};
