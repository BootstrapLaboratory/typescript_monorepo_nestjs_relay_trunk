import { createTheme } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

export const THEME_NAMES = ["light", "dark"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

type ThemeValuesFor<T> = {
  [K in keyof T]: T[K] extends string ? string : ThemeValuesFor<T[K]>;
};

type ThemeValues = ThemeValuesFor<typeof vars>;

const commonThemeValues = {
  font: {
    body: '"Inter", "Segoe UI", Helvetica, Arial, sans-serif',
    mono: '"SFMono-Regular", "Consolas", "Liberation Mono", monospace',
  },
  space: {
    0: "0",
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
  },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "12px",
  },
} satisfies Pick<ThemeValues, "font" | "space" | "radius">;

const themeValuesByName = {
  light: {
    ...commonThemeValues,
    colorScheme: "light",
    color: {
      canvas: "#f8fafc",
      surface: "#ffffff",
      surfaceMuted: "#eef6f8",
      surfaceRaised: "#ffffff",
      text: "#17202a",
      textMuted: "#64748b",
      border: "#dbe4ea",
      borderStrong: "#b7c7d3",
      accent: "#0f766e",
      accentHover: "#115e59",
      accentSoft: "#ccfbf1",
      accentText: "#ffffff",
      link: "#0f5f94",
      logoGlow: "drop-shadow(0 0 2rem rgb(15 118 110 / 0.35))",
      warningText: "#92400e",
      warningSurface: "#fef3c7",
      dangerText: "#991b1b",
      dangerSurface: "#fee2e2",
      codeSurface: "#e2e8f0",
      codeBlock: "#111827",
      codeBlockText: "#e5edf5",
    },
    shadow: {
      sm: "0 1px 2px rgb(15 23 42 / 0.06)",
      md: "0 12px 32px rgb(15 23 42 / 0.08)",
    },
  },
  dark: {
    ...commonThemeValues,
    colorScheme: "dark",
    color: {
      canvas: "#071014",
      surface: "#101c22",
      surfaceMuted: "#17272f",
      surfaceRaised: "#132128",
      text: "#e7f0f3",
      textMuted: "#9db0b8",
      border: "#263941",
      borderStrong: "#3b525b",
      accent: "#5eead4",
      accentHover: "#99f6e4",
      accentSoft: "#123c38",
      accentText: "#05201d",
      link: "#7dd3fc",
      logoGlow: "drop-shadow(0 0 2rem rgb(94 234 212 / 0.35))",
      warningText: "#fde68a",
      warningSurface: "#3d2f12",
      dangerText: "#fecaca",
      dangerSurface: "#421818",
      codeSurface: "#1f3139",
      codeBlock: "#020617",
      codeBlockText: "#dbeafe",
    },
    shadow: {
      sm: "0 1px 2px rgb(0 0 0 / 0.22)",
      md: "0 14px 38px rgb(0 0 0 / 0.32)",
    },
  },
} satisfies Record<ThemeName, ThemeValues>;

export const themeLabelByName = {
  light: "Light",
  dark: "Dark",
} satisfies Record<ThemeName, string>;

export const defaultThemeName = "light" satisfies ThemeName;

export const themeClassByName = {
  light: createTheme(vars, themeValuesByName.light),
  dark: createTheme(vars, themeValuesByName.dark),
} satisfies Record<ThemeName, string>;
