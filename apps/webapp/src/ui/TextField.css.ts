import { style } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

export const textField = style({
  minWidth: 0,
  minHeight: "2.5rem",
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.md,
  padding: `0 ${vars.space[3]}`,
  background: vars.color.surface,
  color: vars.color.text,
  boxShadow: vars.shadow.sm,
  selectors: {
    "&::placeholder": {
      color: vars.color.textMuted,
    },
    "&:focus": {
      borderColor: vars.color.accent,
      outline: `3px solid ${vars.color.accentSoft}`,
      outlineOffset: "1px",
    },
  },
});
