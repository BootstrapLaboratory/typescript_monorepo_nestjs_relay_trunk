import { style } from "@vanilla-extract/css";
import {
  themeColorTransition,
  themeColorTransitionProperties,
} from "./motion.css";
import { vars } from "./tokens.css";

export const textField = style({
  minWidth: 0,
  minHeight: "2.5rem",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: `0 ${vars.space[3]}`,
  background: vars.color.input,
  color: vars.color.text,
  fontSize: "0.875rem",
  outline: "none",
  ...themeColorTransition,
  transitionProperty: `${themeColorTransitionProperties}, opacity`,
  selectors: {
    "&::placeholder": {
      color: vars.color.textMuted,
    },
    "&:focus": {
      borderColor: vars.color.accent,
    },
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.6,
    },
  },
});
