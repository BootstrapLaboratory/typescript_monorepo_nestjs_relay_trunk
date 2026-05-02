import { style } from "@vanilla-extract/css";
import { themeColorTransition } from "../../../ui/motion.css";
import { vars } from "../../../ui/tokens.css";

export const page = style({
  display: "grid",
  justifyItems: "center",
});

export const panel = style({
  display: "grid",
  width: "min(32rem, 100%)",
  gap: vars.space[6],
  padding: vars.space[8],
  "@media": {
    "screen and (max-width: 640px)": {
      padding: vars.space[5],
    },
  },
});

export const header = style({
  display: "grid",
  gap: vars.space[2],
});

export const title = style({
  margin: 0,
  color: vars.color.text,
  fontSize: "1.75rem",
  fontWeight: 650,
  lineHeight: 1.1,
  ...themeColorTransition,
});

export const description = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: "0.95rem",
  lineHeight: 1.5,
  ...themeColorTransition,
});

export const modeSwitch = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space[2],
});
