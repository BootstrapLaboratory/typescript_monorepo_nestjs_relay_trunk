import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../../../ui/tokens.css";

export const root = style({
  display: "grid",
  gap: vars.space[4],
});

globalStyle(`${root} h1, ${root} h2, ${root} h3, ${root} h4, ${root} h5, ${root} h6`, {
  margin: `${vars.space[4]} 0 0`,
  lineHeight: 1.2,
});

globalStyle(`${root} p, ${root} ul, ${root} ol, ${root} pre`, {
  margin: 0,
});

globalStyle(`${root} ul, ${root} ol`, {
  paddingLeft: vars.space[6],
});

globalStyle(`${root} li + li`, {
  marginTop: vars.space[2],
});

globalStyle(`${root} code`, {
  fontFamily: vars.font.mono,
  fontSize: "0.92em",
});

globalStyle(`${root} p code, ${root} li code`, {
  padding: `${vars.space[1]} ${vars.space[2]}`,
  borderRadius: vars.radius.sm,
  background: vars.color.codeSurface,
});

globalStyle(`${root} pre`, {
  padding: vars.space[4],
  borderRadius: vars.radius.lg,
  overflowX: "auto",
  background: vars.color.codeBlock,
  color: vars.color.codeBlockText,
  border: `1px solid ${vars.color.border}`,
});

export const footer = style({
  marginTop: vars.space[4],
  paddingTop: vars.space[4],
  borderTop: `1px solid ${vars.color.border}`,
  color: vars.color.textMuted,
});
