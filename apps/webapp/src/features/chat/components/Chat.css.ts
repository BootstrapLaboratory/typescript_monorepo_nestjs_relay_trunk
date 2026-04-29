import { style } from "@vanilla-extract/css";
import { vars } from "../../../ui/tokens.css";

export const chatSurface = style({
  padding: vars.space[6],
  textAlign: "left",
  "@media": {
    "screen and (max-width: 720px)": {
      padding: vars.space[5],
    },
  },
});

export const chat = style({
  display: "grid",
  gap: vars.space[5],
});

export const title = style({
  margin: 0,
  fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
  lineHeight: 1.1,
});

export const chatStatus = style({
  margin: 0,
  padding: `${vars.space[3]} ${vars.space[4]}`,
  borderRadius: vars.radius.md,
  fontSize: "0.95rem",
});

export const chatStatusRetrying = style({
  background: vars.color.warningSurface,
  color: vars.color.warningText,
});

export const chatStatusDisconnected = style({
  background: vars.color.dangerSurface,
  color: vars.color.dangerText,
});

export const messages = style({
  display: "grid",
  gap: vars.space[2],
  margin: 0,
  padding: 0,
});

export const message = style({
  listStyle: "none",
  padding: `${vars.space[2]} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const messageAuthor = style({
  color: vars.color.text,
});
