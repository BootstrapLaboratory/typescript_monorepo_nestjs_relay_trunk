import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./tokens.css";

globalStyle("*", {
  boxSizing: "border-box",
});

globalStyle(":root", {
  fontFamily: vars.font.body,
  lineHeight: 1.5,
  fontWeight: 400,
  colorScheme: vars.colorScheme,
  color: vars.color.text,
  backgroundColor: vars.color.canvas,
  fontSynthesis: "none",
  textRendering: "optimizeLegibility",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
});

globalStyle("body", {
  margin: 0,
  minWidth: "320px",
  minHeight: "100vh",
});

globalStyle("#root", {
  minHeight: "100vh",
});

globalStyle("a", {
  color: vars.color.link,
  textDecoration: "none",
});

globalStyle("a:hover", {
  color: vars.color.accentHover,
});

globalStyle("button, input, textarea, select", {
  font: "inherit",
});

globalStyle("img", {
  maxWidth: "100%",
});
