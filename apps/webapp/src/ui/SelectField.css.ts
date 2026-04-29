import { style } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

export const selectField = style({
  minWidth: "7.5rem",
  minHeight: "2.25rem",
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.md,
  padding: `0 ${vars.space[3]}`,
  background: vars.color.surface,
  color: vars.color.text,
  boxShadow: vars.shadow.sm,
  cursor: "pointer",
  selectors: {
    "&:focus": {
      borderColor: vars.color.accent,
      outline: `3px solid ${vars.color.accentSoft}`,
      outlineOffset: "1px",
    },
  },
});
