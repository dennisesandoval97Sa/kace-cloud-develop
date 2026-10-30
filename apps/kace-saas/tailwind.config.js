module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx}", "./src_v2/**/*.{js,jsx}"],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                nunito: ["Nunito", "sans-serif"],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                backgroundMenu: "hsl(var(--background-menu))",
                backgroundContainer: "hsl(var(--background-container))",
                redCustom: "hsl(var(--red-custom))",
                yellowCustom: "hsl(var(--yellow-custom))",
                greenCustom: "hsl(var(--green-custom))",
                blueCustom: "hsl(var(--blue-custom))",
                orangeCustom: "hsl(var(--orange-custom))",
                purpleCustom: "hsl(var(--purple-custom))",
                pinkCustom: "hsl(var(--pink-custom))",
                cyanCustom: "hsl(var(--cyan-custom))",
                limeCustom: "hsl(var(--lime-custom))",
                tealCustom: "hsl(var(--teal-custom))",
                indigoCustom: "hsl(var(--indigo-custom))",
                brownCustom: "hsl(var(--brown-custom))",
                colorText: "hsl(var(--text-color))",
                colorIcon: "hsl(var(--icon-color))",
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
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                    60: "hsl(var(--muted) / 0.6)",
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
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
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
                fadeIn: {
                    "0%": { opacity: 0 },
                    "100%": { opacity: 1 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                fadeIn: "fadeIn 1s ease-in-out",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
