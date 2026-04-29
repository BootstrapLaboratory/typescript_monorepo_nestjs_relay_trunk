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

export const sourceLinks = style({
  display: "flex",
  justifyContent: "center",
  gap: vars.space[6],
  fontSize: "1rem",
  "@media": {
    "screen and (max-width: 720px)": {
      flexDirection: "column",
      gap: vars.space[3],
    },
  },
});

export const sourceLink = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: vars.space[3],
  color: vars.color.text,
  fontWeight: 700,
});

export const technologies = style({
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: vars.space[2],
});

export const logo = style({
  width: "6rem",
  height: "6rem",
  padding: vars.space[4],
  objectFit: "contain",
  transition: "filter 300ms",
  selectors: {
    "&:hover": {
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
  width: "2.5rem",
  height: "2.5rem",
  padding: 0,
});

export const technologyTags = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: vars.space[3],
});

export const technologyTag = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "2rem",
  padding: `0 ${vars.space[3]}`,
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.md,
  color: vars.color.text,
  fontSize: "0.95rem",
  fontWeight: 700,
});

export const title = style({
  margin: 0,
  fontSize: "clamp(2rem, 5vw, 3.2rem)",
  lineHeight: 1.1,
});

export const readTheDocs = style({
  margin: 0,
  color: vars.color.textMuted,
});
