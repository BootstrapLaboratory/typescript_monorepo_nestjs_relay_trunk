import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { themeColorTransition } from "./motion.css";
import { vars } from "./tokens.css";

export const button = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: vars.space[2],
    border: "1px solid transparent",
    borderRadius: vars.radius.md,
    flexShrink: 0,
    cursor: "pointer",
    fontWeight: 500,
    lineHeight: 1,
    textDecoration: "none",
    ...themeColorTransition,
    selectors: {
      "&:focus-visible": {
        outline: `2px solid ${vars.color.accent}`,
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
        borderColor: vars.color.accent,
        selectors: {
          "&:hover:not(:disabled)": {
            background: vars.color.accentHover,
            color: vars.color.accentText,
          },
        },
      },
      secondary: {
        background: vars.color.surfaceRaised,
        borderColor: vars.color.border,
        color: vars.color.text,
        selectors: {
          "&:hover:not(:disabled)": {
            borderColor: vars.color.borderStrong,
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
        minHeight: "2.25rem",
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
