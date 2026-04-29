import { style } from "@vanilla-extract/css";
import { themeColorTransition } from "../../../ui/motion.css";
import { vars } from "../../../ui/tokens.css";

export const form = style({
  display: "grid",
  gridTemplateColumns: "minmax(0, 14rem) minmax(0, 1fr) auto",
  gap: vars.space[3],
  alignItems: "start",
  "@media": {
    "screen and (max-width: 760px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const note = style({
  gridColumn: "1 / -1",
  margin: 0,
  color: vars.color.warningText,
  fontSize: "0.875rem",
  ...themeColorTransition,
});

export const errorNote = style({
  color: vars.color.dangerText,
});
