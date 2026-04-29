import { style } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

export const statusPanel = style({
  display: "grid",
  gap: vars.space[3],
  padding: vars.space[6],
  textAlign: "left",
});

export const eyebrow = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.025em",
  textTransform: "uppercase",
});

export const statusTitle = style({
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 600,
  lineHeight: 1.1,
});

export const statusText = style({
  margin: 0,
  maxWidth: "42rem",
  color: vars.color.textMuted,
  fontSize: "0.875rem",
});
