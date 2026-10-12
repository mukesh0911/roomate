/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        parchment: "#FBFBFC",
        ink: "#1E2229",
        surface: {
          DEFAULT: '#FBFBFC',
          card: '#FFFFFF',
        },
        text: {
          main: '#1E2229',
          muted: '#64748B',
        },
        brand: {
          orange: '#FF5A36',
          orangeHover: '#E54E2B',
          lightOrange: '#FFF2EB',
          orangeLight: '#FFF4F0',
          dark: '#1E2229',
          navy: '#1E2229',
          navyDark: '#12151A',
          bg: '#FBFBFC',
          gray: '#64748B',
          grayLight: '#F1F5F9',
          teal: '#0D9488',
          tealLight: '#CCFBF1',
        },
        fire: {
          DEFAULT: "#FF5A36",
          light: "#FFF2EB",
          dark: "#E54E2B",
        },
        navy: {
          DEFAULT: "#1E2229",
          light: "#F1F5F9",
          dark: "#12151A",
        },
        teal: {
          DEFAULT: "#0D9488",
          light: "#E0F2F1",
        },
        cream: "#F8F9FA",
        gold: {
          DEFAULT: "#D4A843",
          light: "#FDF6E3",
        },
        forest: {
          DEFAULT: "#152B24",
          dark: "#0D1D18",
          light: "#1D3B31",
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', '"Playfair Display"', 'sans-serif'],
        serif: ['"Playfair Display"', 'Merriweather', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        script: ['"Caveat"', 'cursive'],
      },
      /*
       * Sprint 5A radius ladder (architectural, not bubbly):
       *   sm 6 · md 8 · lg 10 · xl 14 · 2xl 16 (cards/sheets) · 3xl 20 (hero surfaces only)
       * Full rounding is reserved for avatars/dots/pills via rounded-full.
       */
      borderRadius: {
        '3xl': '1.25rem',
        '2xl': '1rem',
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      /*
       * Sprint 5A elevation policy: most surfaces are flat or subtle;
       * strong elevation is reserved for true overlays (modals/drawers/popovers).
       */
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: "0 2px 12px rgba(0, 0, 0, 0.06)",
        lift: "0 8px 32px rgba(0, 0, 0, 0.10)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.2)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "float": "float 4s ease-in-out infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "fade-up": "fade-up 0.28s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}