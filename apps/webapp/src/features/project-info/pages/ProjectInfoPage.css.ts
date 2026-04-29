import { style } from "@vanilla-extract/css";
import { vars } from "../../../ui/tokens.css";

export const page = style({
  maxWidth: "56rem",
  margin: "0 auto",
  padding: vars.space[8],
  textAlign: "left",
  "@media": {
    "screen and (max-width: 720px)": {
      padding: vars.space[5],
    },
  },
});
