import { style } from "@vanilla-extract/css";
import { themeColorTransition } from "./motion.css";
import { vars } from "./tokens.css";

export const trigger = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space[3],
  minWidth: "10rem",
  minHeight: "2.5rem",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: `0 ${vars.space[3]}`,
  background: vars.color.surface,
  color: vars.color.text,
  cursor: "pointer",
  fontSize: "0.875rem",
  fontWeight: 500,
  outline: "none",
  ...themeColorTransition,
  selectors: {
    "&:hover": {
      borderColor: vars.color.borderStrong,
    },
    "&:focus": {
      borderColor: vars.color.accent,
    },
  },
});

export const icon = style({
  color: vars.color.textMuted,
  fontSize: "0.875rem",
  lineHeight: 1,
  ...themeColorTransition,
});

export const content = style({
  zIndex: 50,
  overflow: "hidden",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  boxShadow: vars.shadow.md,
  ...themeColorTransition,
});

export const viewport = style({
  padding: vars.space[1],
});

export const item = style({
  cursor: "default",
  borderRadius: `calc(${vars.radius.md} - 2px)`,
  padding: `${vars.space[2]} ${vars.space[3]}`,
  color: vars.color.text,
  fontSize: "0.875rem",
  outline: "none",
  ...themeColorTransition,
  selectors: {
    "&[data-highlighted]": {
      background: vars.color.surfaceMuted,
    },
    "&[data-state='checked']": {
      background: vars.color.accentSoft,
    },
  },
});
