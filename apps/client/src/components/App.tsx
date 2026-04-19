import { useEffect, useState, type ReactNode } from "react";
import Chat from "./chat/Chat";
import {
  Header,
  Navigation,
  ProjectReadmePage,
  ReadTheDocs,
} from "./info/Info";
import "./App.css";

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
      setPathname(normalizePath(window.location.pathname));
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

    window.history.pushState({}, "", normalizedNextPath);
    setPathname(normalizedNextPath);
  }

  return { pathname, navigate };
}

export default function App() {
  const { pathname, navigate } = usePathname();

  let content: ReactNode;

  if (pathname === "/info") {
    content = <ProjectReadmePage />;
  } else if (pathname === "/") {
    content = (
      <>
        <Header />
        <Chat />
        <ReadTheDocs />
      </>
    );
  } else {
    content = (
      <section className="not-found">
        <p className="info-page__eyebrow">Page not found</p>
        <h1>Unknown route: {pathname}</h1>
        <p>
          This example client currently exposes only the chat page and the
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
      <Navigation currentPath={pathname} onNavigate={navigate} />
      {content}
    </div>
  );
}
