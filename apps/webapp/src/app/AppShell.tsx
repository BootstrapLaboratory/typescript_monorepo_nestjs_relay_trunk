import { Link, Outlet } from "@tanstack/react-router";
import { Suspense, type ChangeEvent } from "react";
import {
  isThemeName,
  setThemeName,
  useThemeName,
} from "../shared/theme/theme-store";
import { cx } from "../ui/classNames";
import { SelectField } from "../ui/SelectField";
import * as styles from "./AppShell.css";
import { PendingState } from "../ui/StatusState";
import { THEME_NAMES, themeLabelByName } from "../ui/themes.css";

export function AppShell() {
  const themeName = useThemeName();

  function handleThemeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextThemeName = event.currentTarget.value;
    if (isThemeName(nextThemeName)) {
      setThemeName(nextThemeName);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.shellInner}>
        <nav className={styles.nav} aria-label="Primary">
          <Link
            to="/"
            preload="intent"
            className={styles.brand}
            activeOptions={{ exact: true }}
          >
            Anonymous Chat
          </Link>
          <div className={styles.navControls}>
            <div className={styles.links}>
              <Link
                to="/"
                preload="intent"
                activeOptions={{ exact: true }}
                activeProps={{
                  className: cx(styles.navLink, styles.navLinkActive),
                }}
                inactiveProps={{ className: styles.navLink }}
              >
                Chat
              </Link>
              <Link
                to="/info"
                preload="intent"
                activeProps={{
                  className: cx(styles.navLink, styles.navLinkActive),
                }}
                inactiveProps={{ className: styles.navLink }}
              >
                Info
              </Link>
            </div>
            <label className={styles.themePicker}>
              <span className={styles.themePickerLabel}>Style</span>
              <SelectField value={themeName} onChange={handleThemeChange}>
                {THEME_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {themeLabelByName[name]}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
        </nav>
        <main className={styles.content}>
          <Suspense fallback={<PendingState title="Loading page" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
