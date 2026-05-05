import { useSyncExternalStore } from "react";
import { createWebappThemeController } from "@omgjs/labkit-webapp-ui";
import {
  defaultThemeName,
  themeClassByName,
  themeNames,
  type ThemeName,
} from "../../ui/themes.css";

const STORAGE_KEY = "webapp:theme";

const themeController = createWebappThemeController<ThemeName>({
  defaultThemeName,
  storageKey: STORAGE_KEY,
  themeClassByName,
  themeNames,
});

export const getThemeName = themeController.getThemeName;
export const applyThemeClass = themeController.applyThemeClass;
export const initializeThemeClass = themeController.initializeThemeClass;
export const setThemeName = themeController.setThemeName;

export function useThemeName(): ThemeName {
  return useSyncExternalStore(
    themeController.subscribeThemeName,
    getThemeName,
    () => defaultThemeName,
  );
}
