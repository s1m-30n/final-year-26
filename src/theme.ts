import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#ecfdf5" },
          100: { value: "#d1fae5" },
          200: { value: "#a7f3d0" },
          300: { value: "#6ee7b7" },
          400: { value: "#34d399" },
          500: { value: "#10b981" },
          600: { value: "#059669" },
          700: { value: "#047857" },
          800: { value: "#065f46" },
          900: { value: "#064e3b" },
          950: { value: "#022c22" },
        },
      },
      fonts: {
        heading: { value: "'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
        body: { value: "'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        "brand.solid": { value: "{colors.brand.600}" },
        "brand.muted": { value: "{colors.brand.50}" },
        "brand.fg": { value: "{colors.brand.700}" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
