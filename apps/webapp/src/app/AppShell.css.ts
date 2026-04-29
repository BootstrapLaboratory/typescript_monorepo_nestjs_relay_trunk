import { style } from "@vanilla-extract/css";
import { vars } from "../ui/tokens.css";

export const shell = style({
  minHeight: "100vh",
  background: vars.color.canvas,
  color: vars.color.text,
});

export const shellInner = style({
  width: "min(72rem, 100%)",
  margin: "0 auto",
  padding: `${vars.space[4]} ${vars.space[8]} ${vars.space[8]}`,
  display: "flex",
  flexDirection: "column",
  gap: vars.space[8],
  "@media": {
    "screen and (max-width: 720px)": {
      padding: `${vars.space[4]} ${vars.space[4]} ${vars.space[8]}`,
      gap: vars.space[5],
    },
  },
});

export const nav = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[4],
  padding: `0 0 ${vars.space[4]}`,
  borderBottom: `1px solid ${vars.color.border}`,
  background: `color-mix(in srgb, ${vars.color.surface} 85%, transparent)`,
  backdropFilter: "blur(8px)",
  "@media": {
    "screen and (max-width: 640px)": {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
});

export const brand = style({
  color: vars.color.text,
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "0.025em",
  textTransform: "uppercase",
});

export const links = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space[2],
});

export const navControls = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: vars.space[3],
});

export const navLink = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "2.5rem",
  padding: `0 ${vars.space[4]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: "999px",
  background: vars.color.surface,
  color: vars.color.textMuted,
  fontSize: "0.875rem",
  fontWeight: 500,
  transition:
    "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
  selectors: {
    "&:hover": {
      borderColor: vars.color.borderStrong,
      color: vars.color.text,
    },
    "&:focus-visible": {
      outline: `2px solid ${vars.color.accent}`,
      outlineOffset: "2px",
    },
  },
});

export const navLinkActive = style({
  background: vars.color.accentSoft,
  borderColor: vars.color.accent,
  color: vars.color.text,
});

export const themePicker = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
});

export const themePickerLabel = style({
  color: vars.color.textMuted,
  fontSize: "0.875rem",
  fontWeight: 500,
});

export const content = style({
  minWidth: 0,
});
