import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { vars } from "./tokens.css";

export const surface = recipe({
  base: {
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.lg,
  },
  variants: {
    tone: {
      default: {
        background: vars.color.surface,
        boxShadow: vars.shadow.sm,
      },
      muted: {
        background: vars.color.surfaceMuted,
      },
      raised: {
        background: vars.color.surfaceRaised,
        boxShadow: vars.shadow.md,
      },
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export type SurfaceVariants = RecipeVariants<typeof surface>;
