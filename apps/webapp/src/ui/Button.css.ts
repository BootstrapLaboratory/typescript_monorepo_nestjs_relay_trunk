import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { vars } from "./tokens.css";

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: vars.space[2],
    border: "1px solid transparent",
    borderRadius: vars.radius.md,
    cursor: "pointer",
    fontWeight: 700,
    lineHeight: 1,
    textDecoration: "none",
    transition:
      "background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
    selectors: {
      "&:focus-visible": {
        outline: `3px solid ${vars.color.accentSoft}`,
        outlineOffset: "2px",
      },
      "&:disabled": {
        cursor: "not-allowed",
        opacity: 0.58,
      },
    },
  },
  variants: {
    variant: {
      primary: {
        background: vars.color.accent,
        color: vars.color.accentText,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.accentHover,
            color: vars.color.accentText,
          },
        },
      },
      secondary: {
        background: vars.color.surface,
        borderColor: vars.color.borderStrong,
        color: vars.color.text,
        boxShadow: vars.shadow.sm,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.surfaceMuted,
            color: vars.color.text,
          },
        },
      },
      ghost: {
        background: "transparent",
        color: vars.color.text,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.surfaceMuted,
            color: vars.color.text,
          },
        },
      },
    },
    size: {
      sm: {
        minHeight: "2rem",
        padding: `0 ${vars.space[3]}`,
        fontSize: "0.875rem",
      },
      md: {
        minHeight: "2.5rem",
        padding: `0 ${vars.space[4]}`,
        fontSize: "0.95rem",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export type ButtonVariants = RecipeVariants<typeof button>;
