import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { logoutCurrentSession } from "../shared/auth/auth-api";
import { useAuthState } from "../shared/auth/session";
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

function AuthNavigationAction() {
  const authState = useAuthState();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout(): Promise<void> {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await logoutCurrentSession();
      await navigate({ to: "/" });
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (authState.status === "unknown") {
    return (
      <span
        aria-hidden="true"
        className={cx(styles.navLink, styles.authPlaceholder)}
      >
        Login/Register
      </span>
    );
  }

  if (authState.status === "authenticated") {
    return (
      <button
        className={styles.navLink}
        disabled={isLoggingOut}
        type="button"
        onClick={() => void handleLogout()}
      >
        Logout
      </button>
    );
  }

  return (
    <Link
      to="/auth"
      search={{ mode: "login" }}
      preload="intent"
      className={styles.navLink}
    >
      Login/Register
    </Link>
  );
}

export function AppShell() {
  const themeName = useThemeName();

  return (
    <div className={styles.shell}>
      <div className={styles.shellInner}>
        <nav className={styles.nav} aria-label="Primary">
          <div className={styles.brandCluster}>
            <Link
              to="/"
              preload="intent"
              className={styles.brand}
              activeOptions={{ exact: true }}
            >
              Anonymous Chat
            </Link>
            <AuthNavigationAction />
          </div>
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
