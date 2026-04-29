import { useSyncExternalStore } from "react";
import {
  THEME_NAMES,
  defaultThemeName,
  themeClassByName,
  type ThemeName,
} from "../../ui/themes.css";

const STORAGE_KEY = "webapp:theme";
const listeners = new Set<() => void>();

let themeName: ThemeName | undefined;

export function isThemeName(value: unknown): value is ThemeName {
  return THEME_NAMES.some((name) => name === value);
}

function readStoredThemeName(): ThemeName {
  if (typeof window === "undefined") {
    return defaultThemeName;
  }

  try {
    const storedThemeName = window.localStorage.getItem(STORAGE_KEY);
    return isThemeName(storedThemeName) ? storedThemeName : defaultThemeName;
  } catch {
    return defaultThemeName;
  }
}

function writeStoredThemeName(nextThemeName: ThemeName): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, nextThemeName);
  } catch {
    // Ignore storage failures; the in-memory theme still updates.
  }
}

function emitThemeChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToTheme(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getThemeName(): ThemeName {
  if (!themeName) {
    themeName = readStoredThemeName();
  }

  return themeName;
}

export function applyThemeClass(nextThemeName = getThemeName()): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.remove(...Object.values(themeClassByName));
  root.classList.add(themeClassByName[nextThemeName]);
  root.dataset.theme = nextThemeName;
}

export function initializeThemeClass(): void {
  applyThemeClass(getThemeName());
}

export function setThemeName(nextThemeName: ThemeName): void {
  if (nextThemeName === getThemeName()) {
    return;
  }

  themeName = nextThemeName;
  writeStoredThemeName(nextThemeName);
  applyThemeClass(nextThemeName);
  emitThemeChange();
}

export function useThemeName(): ThemeName {
  return useSyncExternalStore(
    subscribeToTheme,
    getThemeName,
    () => defaultThemeName,
  );
}
