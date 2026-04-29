import { style } from "@vanilla-extract/css";
import { themeColorTransition } from "../../../ui/motion.css";
import { vars } from "../../../ui/tokens.css";

export const form = style({
  display: "grid",
  gap: vars.space[4],
});

export const field = style({
  display: "grid",
  gap: vars.space[2],
  textAlign: "left",
});

export const label = style({
  color: vars.color.text,
  fontSize: "0.875rem",
  fontWeight: 600,
});

export const optional = style({
  color: vars.color.textMuted,
  fontWeight: 500,
  ...themeColorTransition,
});

export const error = style({
  margin: 0,
  border: `1px solid ${vars.color.dangerText}`,
  borderRadius: vars.radius.md,
  padding: `${vars.space[3]} ${vars.space[4]}`,
  background: vars.color.dangerSurface,
  color: vars.color.dangerText,
  fontSize: "0.875rem",
  fontWeight: 500,
  ...themeColorTransition,
});

export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: vars.space[3],
});

