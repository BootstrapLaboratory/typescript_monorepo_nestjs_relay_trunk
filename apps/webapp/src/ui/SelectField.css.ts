import { style } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

export const selectField = style({
  minWidth: "7.5rem",
  minHeight: "2.5rem",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: `0 ${vars.space[3]}`,
  background: vars.color.surface,
  color: vars.color.text,
  cursor: "pointer",
  fontSize: "0.875rem",
  fontWeight: 500,
  outline: "none",
  transition: "border-color 150ms ease",
  selectors: {
    "&:hover": {
      borderColor: vars.color.borderStrong,
    },
    "&:focus": {
      borderColor: vars.color.accent,
    },
  },
});
