import type { MouseEvent } from "react";
import projectReadme from "../../../../../README.md?raw";
import relayLogo from "./assets/relay.svg";
import reactLogo from "./assets/react.svg";
import nestLogo from "./assets/nest.svg";
import githubLogo from "./assets/github.svg";
import trunkLogo from "./assets/trunk.png";
import apolloLogo from "./assets/apollo.svg";
import viteLogo from "/vite.svg";
import rushStackLogo from "./assets/rushstack.svg";
import { MarkdownRenderer } from "./markdown";

const HTTP_ENDPOINT = import.meta.env.VITE_GRAPHQL_HTTP!;
const PROJECT_REPOSITORY_URL = "https://github.com/BeltOrg/beltapp";

type NavigationProps = {
  currentPath: string;
  onNavigate: (nextPath: string) => void;
};

function NavigationLink({
  href,
  label,
  currentPath,
  onNavigate,
}: {
  href: string;
  label: string;
  currentPath: string;
  onNavigate: (nextPath: string) => void;
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

  return (
    <a
      href={href}
      onClick={handleClick}
      className={
        isActive ? "app-nav__link app-nav__link--active" : "app-nav__link"
      }
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </a>
  );
}

export function Navigation({ currentPath, onNavigate }: NavigationProps) {
  return (
    <nav className="app-nav" aria-label="Primary">
      <div className="app-nav__brand">Anonymous Chat</div>
      <div className="app-nav__links">
        <NavigationLink
          href="/"
          label="Chat"
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
        <NavigationLink
          href="/info"
          label="Info"
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      </div>
    </nav>
  );
}

export function Header() {
  return (
    <>
      <div className="source-code-link">
        <a
          href={PROJECT_REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="View source on GitHub"
        >
          <img src={githubLogo} className="logo github" alt="GitHub Logo" />
          View source code
        </a>
        <a
          href={HTTP_ENDPOINT}
          target="_blank"
          rel="noopener noreferrer"
          title="Browse API with Apollo Sandbox"
        >
          <img src={apolloLogo} className="logo github" alt="Apollo Logo" />
          Browse API with Apollo Sandbox
        </a>
      </div>
      <div className="technologies">
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://relay.dev/" target="_blank">
          <img src={relayLogo} className="logo relay" alt="React logo" />
        </a>
        <a href="https://nestjs.com/" target="_blank">
          <img src={nestLogo} className="logo nestjs" alt="NestJS logo" />
        </a>
        <a href="https://rushstack.io/" target="_blank">
          <img src={rushStackLogo} className="logo rushstack" alt="Rush logo" />
        </a>
        <a href="https://trunk.io/" target="_blank">
          <img src={trunkLogo} className="logo trunk_io" alt="Trunk.io logo" />
        </a>
      </div>
      <div className="technology-tags">
        <a href="https://cloud.google.com/run" target="_blank" rel="noreferrer">
          Google Cloud Run
        </a>
        <a href="https://neon.com/" target="_blank" rel="noreferrer">
          Neon
        </a>
        <a href="https://www.cloudflare.com/" target="_blank" rel="noreferrer">
          Cloudflare
        </a>
        <a href="https://upstash.com/" target="_blank" rel="noreferrer">
          Upstash
        </a>
      </div>
      <h1>Vite + React + Relay + NestJS + Cloud Run + Neon + Cloudflare</h1>
    </>
  );
}

export function ReadTheDocs() {
  return (
    <p className="read-the-docs">
      Click the technology links above to learn more about the stack
    </p>
  );
}

export function ProjectReadmePage() {
  return (
    <section className="info-page">
      <MarkdownRenderer markdown={projectReadme} />
    </section>
  );
}
