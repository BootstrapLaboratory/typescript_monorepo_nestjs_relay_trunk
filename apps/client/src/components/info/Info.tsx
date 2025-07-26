import relayLogo from "./assets/relay.svg";
import reactLogo from "./assets/react.svg";
import nestLogo from "./assets/nest.svg";
import gitlabLogo from "./assets/gitlab.svg";
import trunkLogo from "./assets/trunk.png";
import apolloLogo from "./assets/apollo.svg";
import viteLogo from "/vite.svg";

const HTTP_ENDPOINT = import.meta.env.VITE_GRAPHQL_HTTP!;

export function Header() {
  return (
    <>
      <div className="source-code-link">
        <a
          href="https://github.com/BootstrapLaboratory/typescript_nestjs_relay_lerna_trunk"
          target="_blank"
          rel="noopener noreferrer"
          title="View source on GitLab"
        >
          <img src={gitlabLogo} className="logo gitlab" alt="GitLab Logo" />
          View source code
        </a>
        <a
          href={HTTP_ENDPOINT}
          target="_blank"
          rel="noopener noreferrer"
          title="Browse API with Apollo Sandbox"
        >
          <img src={apolloLogo} className="logo gitlab" alt="Apollo Logo" />
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
        <a href="https://trunk.io/" target="_blank">
          <img src={trunkLogo} className="logo trunk_io" alt="Trunk.io logo" />
        </a>
      </div>
      <h1>Vite + React + Relay + NestJS + Trunk.io</h1>
    </>
  );
}

export function ReadTheDocs() {
  return (
    <p className="read-the-docs">
      Click on the Vite, React, Relay, Nest.js and Trunk.io logos to learn more
    </p>
  );
}
