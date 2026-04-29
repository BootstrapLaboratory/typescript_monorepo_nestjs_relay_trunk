import { Link, Outlet } from "@tanstack/react-router";
import { Suspense } from "react";
import { setThemeName, useThemeName } from "../shared/theme/theme-store";
import { cx } from "../ui/classNames";
import { SelectField, type SelectFieldOption } from "../ui/SelectField";
import * as styles from "./AppShell.css";
import { PendingState } from "../ui/StatusState";
import { THEME_NAMES, themeLabelByName, type ThemeName } from "../ui/themes.css";

const themeOptions: ReadonlyArray<SelectFieldOption<ThemeName>> =
  THEME_NAMES.map((name) => ({
    value: name,
    label: themeLabelByName[name],
  }));

export function AppShell() {
  const themeName = useThemeName();

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
            <div className={styles.themePicker}>
              <SelectField
                ariaLabel="Theme"
                value={themeName}
                options={themeOptions}
                onValueChange={setThemeName}
              />
            </div>
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
