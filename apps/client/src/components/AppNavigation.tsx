import type { MouseEvent } from "react";

type NavigationProps = {
  currentPath: string;
  onNavigate: (nextPath: string) => void;
  onNavigateIntent?: (nextPath: string) => void;
};

function NavigationLink({
  href,
  label,
  currentPath,
  onNavigate,
  onNavigateIntent,
}: {
  href: string;
  label: string;
  currentPath: string;
  onNavigate: (nextPath: string) => void;
  onNavigateIntent?: (nextPath: string) => void;
}) {
  const isActive = currentPath === href;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onNavigate(href);
  }

  function handleIntent() {
    onNavigateIntent?.(href);
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      onMouseEnter={handleIntent}
      onFocus={handleIntent}
      className={
        isActive ? "app-nav__link app-nav__link--active" : "app-nav__link"
      }
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </a>
  );
}

export function Navigation({
  currentPath,
  onNavigate,
  onNavigateIntent,
}: NavigationProps) {
  return (
    <nav className="app-nav" aria-label="Primary">
      <div className="app-nav__brand">Anonymous Chat</div>
      <div className="app-nav__links">
        <NavigationLink
          href="/"
          label="Chat"
          currentPath={currentPath}
          onNavigate={onNavigate}
          onNavigateIntent={onNavigateIntent}
        />
        <NavigationLink
          href="/info"
          label="Info"
          currentPath={currentPath}
          onNavigate={onNavigate}
          onNavigateIntent={onNavigateIntent}
        />
      </div>
    </nav>
  );
}
