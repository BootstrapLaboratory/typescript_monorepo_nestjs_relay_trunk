import { style } from "@vanilla-extract/css";
import { vars } from "../../../ui/tokens.css";

export const chatSurface = style({
  width: "100%",
  maxWidth: "48rem",
  margin: "0 auto",
  padding: vars.space[5],
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

export const chatHeader = style({
  display: "grid",
  gap: vars.space[1],
});

export const title = style({
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 600,
  lineHeight: "2rem",
});

export const subtitle = style({
  margin: 0,
  color: vars.color.textMuted,
  fontSize: "0.875rem",
});

export const chatStatus = style({
  margin: 0,
  padding: `${vars.space[2]} ${vars.space[3]}`,
  border: `1px solid color-mix(in srgb, ${vars.color.accent} 20%, transparent)`,
  borderRadius: vars.radius.md,
  background: vars.color.accentSoft,
  color: vars.color.text,
  fontSize: "0.875rem",
});

export const chatStatusRetrying = style({
  borderColor: "rgb(217 119 6 / 0.3)",
  background: vars.color.warningSurface,
  color: vars.color.warningText,
});

export const chatStatusDisconnected = style({
  borderColor: "rgb(220 38 38 / 0.3)",
  background: vars.color.dangerSurface,
  color: vars.color.dangerText,
});

export const messages = style({
  display: "grid",
  gap: vars.space[2],
  maxHeight: "28rem",
  minHeight: "8rem",
  margin: 0,
  padding: vars.space[3],
  overflow: "auto",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surfaceMuted,
});

export const message = style({
  listStyle: "none",
  display: "grid",
  gap: vars.space[1],
  padding: `${vars.space[2]} ${vars.space[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  background: vars.color.surface,
  color: vars.color.textMuted,
  fontSize: "0.875rem",
});

export const messageAuthor = style({
  display: "block",
  color: vars.color.text,
  fontWeight: 600,
});
