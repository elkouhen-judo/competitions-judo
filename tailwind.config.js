/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./Index.html", "./assets/**/*.html", "./assets/**/*.ts", "./api/**/*.js"],
  safelist: [
    "rank-gold",
    "rank-silver",
    "rank-bronze",
    "rank-top5",
    "rank-unclassified",
    "result-v",
    "result-d",
    "result-e",
    "badge-technique",
    "badge-pending"
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        text: "var(--text)",
        muted: "var(--muted)",
        line: "var(--line)",
        primary: "var(--primary)",
        accent: "var(--accent)",
        hajime: "var(--hajime)",
        tatami: "var(--tatami)",
        surface: "var(--surface)",
        danger: "var(--danger)",
        success: "var(--success)",
        warning: "var(--warning)"
      },
      borderRadius: {
        kiroku: "var(--radius)",
        card: "var(--radius-card)"
      },
      boxShadow: {
        kiroku: "var(--shadow)"
      },
      fontFamily: {
        body: [
          "Atkinson Hyperlegible",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Arial",
          "Helvetica",
          "sans-serif"
        ],
        display: ["Avenir Next", "Atkinson Hyperlegible", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
