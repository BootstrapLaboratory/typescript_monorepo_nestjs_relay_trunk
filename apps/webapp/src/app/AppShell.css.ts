import { style } from "@vanilla-extract/css";
import { themeColorTransition } from "../ui/motion.css";
import { vars } from "../ui/tokens.css";

export const shell = style({
  minHeight: "100vh",
  background: vars.color.canvas,
  color: vars.color.text,
  ...themeColorTransition,
});

export const shellInner = style({
  width: "100%",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 0,
});

export const nav = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[4],
  padding: `${vars.space[6]} ${vars.space[8]}`,
  borderBottom: `1px solid ${vars.color.border}`,
  background: `color-mix(in oklab, ${vars.color.surface} 85%, transparent)`,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  ...themeColorTransition,
  "@media": {
    "screen and (max-width: 640px)": {
      alignItems: "flex-start",
      flexDirection: "column",
      padding: `${vars.space[5]} ${vars.space[4]}`,
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
  alignItems: "flex-end",
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
  ...themeColorTransition,
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
  display: "grid",
  alignItems: "start",
  gap: vars.space[2],
});

export const themePickerLabel = style({
  color: vars.color.textMuted,
  fontSize: "0.875rem",
  fontWeight: 500,
});

export const content = style({
  width: "min(72rem, 100%)",
  margin: "0 auto",
  padding: `${vars.space[8]} ${vars.space[8]}`,
  minWidth: 0,
  "@media": {
    "screen and (max-width: 720px)": {
      padding: `${vars.space[5]} ${vars.space[4]} ${vars.space[8]}`,
    },
  },
});
