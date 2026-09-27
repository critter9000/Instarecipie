// Design tokens for All My Meals. Light theme (warm, food-centric).
// Keys mirror the "color" block of /app/design_guidelines.json.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FDFBF7",
  onSurface: "#1C1917",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1917",
  surfaceTertiary: "#F5F2EB",
  onSurfaceTertiary: "#44403C",
  surfaceInverse: "#292524",
  onSurfaceInverse: "#FAFAF9",
  muted: "#78716C",

  brand: "#D35400",
  onBrand: "#FFFFFF",
  brandPrimary: "#C84C31",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F2E2DC",
  onBrandSecondary: "#8A311D",
  brandTertiary: "#F9EBE7",
  onBrandTertiary: "#6B2313",

  success: "#E9F2EC",
  onSuccess: "#2A5A39",
  warning: "#FDF3E1",
  onWarning: "#7D5513",
  error: "#FCEBEA",
  onError: "#942721",
  info: "#EBECE8",
  onInfo: "#3B3D36",

  border: "#E8E4DF",
  borderStrong: "#D6D0C4",
  divider: "#F0ECE6",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

// Font family names must match the keys registered in app/_layout.tsx.
export const fonts = {
  display: {
    regular: "Lora-Regular",
    medium: "Lora-Medium",
    semibold: "Lora-SemiBold",
    bold: "Lora-Bold",
  },
  text: {
    regular: "PlusJakartaSans-Regular",
    medium: "PlusJakartaSans-Medium",
    semibold: "PlusJakartaSans-SemiBold",
    bold: "PlusJakartaSans-Bold",
  },
} as const;

export const fontSize = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
} as const;

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
