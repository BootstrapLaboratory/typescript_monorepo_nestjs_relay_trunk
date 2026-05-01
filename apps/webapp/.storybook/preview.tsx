import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/ui/theme.css.ts";
import "../src/index.css";
import {
  THEME_NAMES,
  defaultThemeName,
  type ThemeName,
  themeClassByName,
  themeLabelByName,
} from "../src/ui/themes.css";
import { vars } from "../src/ui/tokens.css";

function isThemeName(value: unknown): value is ThemeName {
  return THEME_NAMES.some((name) => name === value);
}

const withTheme: Decorator = (Story, context) => {
  const themeName = isThemeName(context.globals.theme)
    ? context.globals.theme
    : defaultThemeName;

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove(...Object.values(themeClassByName));
    root.classList.add(themeClassByName[themeName]);
    root.dataset.theme = themeName;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        background: vars.color.canvas,
        color: vars.color.text,
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Theme",
      defaultValue: defaultThemeName,
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: THEME_NAMES.map((name) => ({
          value: name,
          title: themeLabelByName[name],
        })),
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
  },
};

export default preview;
