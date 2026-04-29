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
    lg: "8px",
  },
} satisfies Pick<ThemeValues, "font" | "space" | "radius">;

const themeValuesByName = {
  light: {
    ...commonThemeValues,
    colorScheme: "light",
    color: {
      canvas: "#f7f8fc",
      surface: "#ffffff",
      surfaceMuted: "#eef2f7",
      surfaceRaised: "#fbfcff",
      text: "#142033",
      textMuted: "#5d6b82",
      border: "#dbe2ec",
      borderStrong: "#b8c4d4",
      accent: "#3458d4",
      accentHover: "#2745ae",
      accentSoft: "#e7ecff",
      accentText: "#ffffff",
      input: "#ffffff",
      link: "#2745ae",
      logoGlow: "drop-shadow(0 0 1.5rem rgb(52 88 212 / 0.34))",
      warningText: "#7c3e00",
      warningSurface: "rgb(217 119 6 / 0.15)",
      dangerText: "#8f1d1d",
      dangerSurface: "rgb(220 38 38 / 0.15)",
      codeSurface: "#e8edf6",
      codeBlock: "#111827",
      codeBlockText: "#f8fafc",
    },
    shadow: {
      sm: "0 1px 2px rgb(15 23 42 / 0.08)",
      md: "0 18px 45px rgb(28 38 67 / 0.12)",
    },
  },
  dark: {
    ...commonThemeValues,
    colorScheme: "dark",
    color: {
      canvas: "#111827",
      surface: "#172033",
      surfaceMuted: "#202b41",
      surfaceRaised: "#1c263a",
      text: "#edf2f8",
      textMuted: "#a9b6ca",
      border: "#334156",
      borderStrong: "#52627a",
      accent: "#8fb0ff",
      accentHover: "#b2c7ff",
      accentSoft: "#24335c",
      accentText: "#111827",
      input: "#111827",
      link: "#b2c7ff",
      logoGlow: "drop-shadow(0 0 1.5rem rgb(143 176 255 / 0.42))",
      warningText: "#fde68a",
      warningSurface: "rgb(251 191 36 / 0.15)",
      dangerText: "#fecaca",
      dangerSurface: "rgb(248 113 113 / 0.15)",
      codeSurface: "#273348",
      codeBlock: "#0b1120",
      codeBlockText: "#f8fafc",
    },
    shadow: {
      sm: "0 1px 2px rgb(0 0 0 / 0.2)",
      md: "0 18px 45px rgb(0 0 0 / 0.28)",
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
