import { style } from "@vanilla-extract/css";
import { vars } from "../../../ui/tokens.css";

export const form = style({
  display: "grid",
  gridTemplateColumns: "minmax(10rem, 1fr) minmax(14rem, 2fr) auto",
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
  fontSize: "0.9rem",
});

export const errorNote = style({
  color: vars.color.dangerText,
});
