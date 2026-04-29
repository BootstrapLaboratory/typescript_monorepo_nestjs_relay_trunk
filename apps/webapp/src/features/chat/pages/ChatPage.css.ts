import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../../ui/tokens.css";

const logoSpin = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

export const home = style({
  display: "grid",
  gap: vars.space[8],
  textAlign: "center",
});

export const headerPanel = style({
  display: "grid",
  gap: vars.space[6],
  padding: `${vars.space[10]} ${vars.space[10]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  background: vars.color.surfaceRaised,
  boxShadow: vars.shadow.md,
  textAlign: "left",
  "@media": {
    "screen and (max-width: 720px)": {
      padding: vars.space[5],
    },
  },
});

export const sourceLinks = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: vars.space[2],
  fontSize: "0.875rem",
  "@media": {
    "screen and (max-width: 720px)": {
      gap: vars.space[3],
    },
  },
});

export const sourceLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space[2],
  minHeight: "2.25rem",
  padding: `0 ${vars.space[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: "999px",
  background: vars.color.surface,
  color: vars.color.text,
  fontWeight: 500,
  transition: "border-color 150ms ease, color 150ms ease",
  selectors: {
    "&:hover": {
      borderColor: vars.color.borderStrong,
      color: vars.color.text,
      textDecoration: "none",
    },
  },
});

export const technologies = style({
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: vars.space[3],
});

export const logo = style({
  width: "5rem",
  height: "5rem",
  padding: vars.space[3],
  objectFit: "contain",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  background: vars.color.surface,
  transition: "border-color 150ms ease, filter 150ms ease",
  selectors: {
    "&:hover": {
      borderColor: vars.color.borderStrong,
      filter: vars.color.logoGlow,
    },
  },
});

export const reactLogo = style({
  "@media": {
    "(prefers-reduced-motion: no-preference)": {
      animation: `${logoSpin} infinite 20s linear`,
    },
  },
});

export const compactLogo = style({
  width: "1.25rem",
  height: "1.25rem",
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: "transparent",
});

export const technologyTags = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: vars.space[2],
});

export const technologyTag = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "2.25rem",
  padding: `0 ${vars.space[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: "999px",
  background: vars.color.surface,
  color: vars.color.text,
  fontSize: "0.875rem",
  fontWeight: 500,
  transition: "border-color 150ms ease",
  selectors: {
    "&:hover": {
      borderColor: vars.color.borderStrong,
      color: vars.color.text,
      textDecoration: "none",
    },
  },
});

export const title = style({
  margin: 0,
  maxWidth: "56rem",
  justifySelf: "center",
  textAlign: "center",
  fontSize: "1.875rem",
  fontWeight: 600,
  lineHeight: 1.1,
  "@media": {
    "screen and (min-width: 640px)": {
      fontSize: "2.25rem",
    },
  },
});

export const readTheDocs = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: "0.875rem",
});
