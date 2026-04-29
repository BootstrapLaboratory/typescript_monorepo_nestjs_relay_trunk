import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { themeColorTransition } from "./motion.css";
import { vars } from "./tokens.css";

export const link = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    color: vars.color.link,
    fontWeight: 500,
    textDecoration: "none",
    textUnderlineOffset: "4px",
    ...themeColorTransition,
    selectors: {
      "&:hover": {
        color: vars.color.accentHover,
        textDecoration: "underline",
      },
      "&:focus-visible": {
        outline: `2px solid ${vars.color.accent}`,
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
