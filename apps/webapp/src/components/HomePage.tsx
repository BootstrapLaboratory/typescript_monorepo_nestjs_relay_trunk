import Chat from "./chat/Chat";
import relayLogo from "./info/assets/relay.svg";
import reactLogo from "./info/assets/react.svg";
import nestLogo from "./info/assets/nest.svg";
import githubLogo from "./info/assets/github.svg";
import trunkLogo from "./info/assets/trunk.png";
import apolloLogo from "./info/assets/apollo.svg";
import viteLogo from "/vite.svg";
import rushStackLogo from "./info/assets/rushstack.svg";

const HTTP_ENDPOINT = import.meta.env.VITE_GRAPHQL_HTTP!;
const PROJECT_REPOSITORY_URL = "https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk";

function Header() {
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

function ReadTheDocs() {
  return (
    <p className="read-the-docs">
      Click the technology links above to learn more about the stack
    </p>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <Chat />
      <ReadTheDocs />
    </>
  );
}
