import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { vars } from "./tokens.css";

export const link = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    color: vars.color.link,
    fontWeight: 700,
    textDecoration: "none",
    selectors: {
      "&:hover": {
        color: vars.color.accentHover,
      },
      "&:focus-visible": {
        outline: `3px solid ${vars.color.accentSoft}`,
        outlineOffset: "2px",
      },
    },
  },
  variants: {
    tone: {
      default: {},
      subtle: {
        color: vars.color.text,
      },
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export type LinkVariants = RecipeVariants<typeof link>;
