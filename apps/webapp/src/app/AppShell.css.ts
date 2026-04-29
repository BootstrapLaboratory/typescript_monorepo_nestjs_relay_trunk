import { style } from "@vanilla-extract/css";
import { vars } from "../ui/tokens.css";

export const shell = style({
  minHeight: "100vh",
});

export const shellInner = style({
  width: "min(1180px, 100%)",
  margin: "0 auto",
  padding: vars.space[8],
  display: "grid",
  gap: vars.space[8],
  "@media": {
    "screen and (max-width: 720px)": {
      padding: vars.space[4],
      gap: vars.space[5],
    },
  },
});

export const nav = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[4],
  padding: `${vars.space[4]} ${vars.space[5]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  background: vars.color.surface,
  boxShadow: vars.shadow.sm,
  "@media": {
    "screen and (max-width: 640px)": {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
});

export const brand = style({
  color: vars.color.text,
  fontSize: "0.95rem",
  fontWeight: 800,
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
  minHeight: "2.25rem",
  padding: `0 ${vars.space[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  color: vars.color.text,
  fontWeight: 700,
  transition:
    "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
  selectors: {
    "&:hover": {
      background: vars.color.surfaceMuted,
      color: vars.color.text,
    },
    "&:focus-visible": {
      outline: `3px solid ${vars.color.accentSoft}`,
      outlineOffset: "2px",
    },
  },
});

export const navLinkActive = style({
  background: vars.color.accentSoft,
  borderColor: vars.color.accent,
  color: vars.color.accentHover,
});

export const themePicker = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space[2],
});

export const themePickerLabel = style({
  color: vars.color.textMuted,
  fontSize: "0.86rem",
  fontWeight: 800,
  textTransform: "uppercase",
});

export const content = style({
  minWidth: 0,
});
