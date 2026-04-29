import { style } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

export const statusPanel = style({
  display: "grid",
  gap: vars.space[3],
  padding: vars.space[8],
  textAlign: "left",
});

export const eyebrow = style({
  margin: `0 0 ${vars.space[2]}`,
  color: vars.color.textMuted,
  fontSize: "0.78rem",
  fontWeight: 800,
  textTransform: "uppercase",
});

export const statusTitle = style({
  margin: 0,
  fontSize: "clamp(1.5rem, 4vw, 2.35rem)",
  lineHeight: 1.1,
});

export const statusText = style({
  margin: 0,
  maxWidth: "65ch",
  color: vars.color.textMuted,
});
