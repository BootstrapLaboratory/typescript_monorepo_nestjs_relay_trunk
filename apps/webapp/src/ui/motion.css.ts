export const themeColorTransitionProperties =
  "color, background-color, border-color, outline-color, text-decoration-color, fill, stroke";

export const themeColorTransitionDuration = "150ms";
export const themeColorTransitionTiming = "cubic-bezier(0.4, 0, 0.2, 1)";

export const themeColorTransition = {
  transitionDuration: themeColorTransitionDuration,
  transitionProperty: themeColorTransitionProperties,
  transitionTimingFunction: themeColorTransitionTiming,
  "@media": {
    "(prefers-reduced-motion: reduce)": {
      transitionDuration: "1ms",
    },
  },
} as const;
