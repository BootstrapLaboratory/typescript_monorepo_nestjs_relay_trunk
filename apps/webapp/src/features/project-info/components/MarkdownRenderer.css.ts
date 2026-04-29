import { globalStyle, style } from "@vanilla-extract/css";
import { themeColorTransition } from "../../../ui/motion.css";
import { vars } from "../../../ui/tokens.css";

export const root = style({
  display: "grid",
  gap: vars.space[4],
  textAlign: "left",
});

globalStyle(`${root} h1, ${root} h2, ${root} h3, ${root} h4, ${root} h5, ${root} h6`, {
  margin: `${vars.space[4]} 0 0`,
  lineHeight: 1.2,
  fontWeight: 600,
});

globalStyle(`${root} h1`, {
  margin: 0,
  fontSize: "1.875rem",
});

globalStyle(`${root} h2`, {
  marginTop: vars.space[5],
  fontSize: "1.5rem",
});

globalStyle(`${root} h3`, {
  fontSize: "1.25rem",
});

globalStyle(`${root} p, ${root} ul, ${root} ol, ${root} pre`, {
  margin: 0,
  color: vars.color.textMuted,
  ...themeColorTransition,
});

globalStyle(`${root} ul, ${root} ol`, {
  display: "grid",
  gap: vars.space[2],
  paddingLeft: vars.space[5],
});

globalStyle(`${root} li`, {
  paddingLeft: vars.space[1],
});

globalStyle(`${root} code`, {
  fontFamily: vars.font.mono,
  fontSize: "0.92em",
});

globalStyle(`${root} p code, ${root} li code`, {
  padding: `${vars.space[1]} ${vars.space[2]}`,
  borderRadius: vars.radius.sm,
  background: "color-mix(in srgb, currentColor 12%, transparent)",
  color: "inherit",
});

globalStyle(`${root} pre`, {
  margin: 0,
  padding: vars.space[4],
  borderRadius: vars.radius.md,
  overflowX: "auto",
  background: vars.color.codeBlock,
  color: vars.color.codeBlockText,
  border: `1px solid ${vars.color.border}`,
  ...themeColorTransition,
});

export const footer = style({
  marginTop: vars.space[2],
  paddingTop: vars.space[4],
  borderTop: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
  fontSize: "0.875rem",
  ...themeColorTransition,
});
