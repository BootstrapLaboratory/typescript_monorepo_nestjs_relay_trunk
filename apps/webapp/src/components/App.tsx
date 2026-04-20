import {
  Suspense,
  lazy,
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigation } from "./AppNavigation";
import HomePage from "./HomePage";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import "./App.css";

const loadProjectReadmePage = () => import("./info/Info");
const ProjectReadmePage = lazy(loadProjectReadmePage);

function preloadRoute(pathname: string) {
  if (pathname === "/info") {
    void loadProjectReadmePage();
  }
}

function normalizePath(pathname: string): string {
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname || "/";
}

function usePathname() {
  const [pathname, setPathname] = useState(() =>
    normalizePath(window.location.pathname),
  );

  useEffect(() => {
    function syncPathname() {
      const nextPath = normalizePath(window.location.pathname);
      preloadRoute(nextPath);
      startTransition(() => {
        setPathname(nextPath);
      });
    }

    window.addEventListener("popstate", syncPathname);

    return () => {
      window.removeEventListener("popstate", syncPathname);
    };
  }, []);

  function navigate(nextPath: string) {
    const normalizedNextPath = normalizePath(nextPath);
    if (normalizedNextPath === pathname) {
      return;
    }

    preloadRoute(normalizedNextPath);
    window.history.pushState({}, "", normalizedNextPath);
    startTransition(() => {
      setPathname(normalizedNextPath);
    });
  }

  return { pathname, navigate };
}

function RoutePendingState({ pathname }: { pathname: string }) {
  if (pathname === "/info") {
    return (
      <section className="route-pending" role="status" aria-live="polite">
        <p className="info-page__eyebrow">Loading docs</p>
        <h1>Preparing the project guide.</h1>
        <p>
          The documentation page loads separately so the chat home page can stay
          lighter on first visit.
        </p>
      </section>
    );
  }

  return (
    <section className="route-pending" role="status" aria-live="polite">
      <p>Loading...</p>
    </section>
  );
}

export default function App() {
  const { pathname, navigate } = usePathname();

  let content: ReactNode;

  if (pathname === "/info") {
    content = (
      <RouteErrorBoundary pathname={pathname}>
        <Suspense fallback={<RoutePendingState pathname={pathname} />}>
          <ProjectReadmePage />
        </Suspense>
      </RouteErrorBoundary>
    );
  } else if (pathname === "/") {
    content = <HomePage />;
  } else {
    content = (
      <section className="not-found">
        <p className="info-page__eyebrow">Page not found</p>
        <h1>Unknown route: {pathname}</h1>
        <p>
          This example web app currently exposes only the chat page and the
          README-backed info page.
        </p>
        <p>
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate("/");
            }}
          >
            Return to the chat home page
          </a>
        </p>
      </section>
    );
  }

  return (
    <div className="app-shell">
      <Navigation
        currentPath={pathname}
        onNavigate={navigate}
        onNavigateIntent={preloadRoute}
      />
      {content}
    </div>
  );
}
