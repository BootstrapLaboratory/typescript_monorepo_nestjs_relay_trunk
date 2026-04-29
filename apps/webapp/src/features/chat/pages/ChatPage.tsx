import type { ReactNode } from "react";
import relayLogo from "../assets/relay.svg";
import reactLogo from "../assets/react.svg";
import nestLogo from "../assets/nest.svg";
import githubLogo from "../assets/github.svg";
import trunkLogo from "../assets/trunk.png";
import apolloLogo from "../assets/apollo.svg";
import viteLogo from "/vite.svg";
import rushStackLogo from "../assets/rushstack.svg";
import { HTTP_ENDPOINT } from "../../../shared/graphql/endpoints";
import { cx } from "../../../ui/classNames";
import { Link } from "../../../ui/Link";
import * as styles from "./ChatPage.css";

const PROJECT_REPOSITORY_URL =
  "https://github.com/BootstrapLaboratory/typescript_monorepo_nestjs_relay_trunk";

function Header() {
  return (
    <div className={styles.headerPanel}>
      <div className={styles.sourceLinks}>
        <Link
          href={PROJECT_REPOSITORY_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="View source on GitHub"
          tone="subtle"
          className={styles.sourceLink}
        >
          <img
            src={githubLogo}
            className={cx(styles.logo, styles.compactLogo)}
            alt="GitHub Logo"
          />
          Source code
        </Link>
        <Link
          href={HTTP_ENDPOINT}
          target="_blank"
          rel="noopener noreferrer"
          title="Browse API with Apollo Sandbox"
          tone="subtle"
          className={styles.sourceLink}
        >
          <img
            src={apolloLogo}
            className={cx(styles.logo, styles.compactLogo)}
            alt="Apollo Logo"
          />
          Apollo Sandbox
        </Link>
      </div>
      <h1 className={styles.title}>
        Vite + React + Relay + NestJS + Cloud Run + Neon + Cloudflare
      </h1>
      <div className={styles.technologies}>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className={styles.logo} alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img
            src={reactLogo}
            className={cx(styles.logo, styles.reactLogo)}
            alt="React logo"
          />
        </a>
        <a href="https://relay.dev/" target="_blank">
          <img src={relayLogo} className={styles.logo} alt="Relay logo" />
        </a>
        <a href="https://nestjs.com/" target="_blank">
          <img src={nestLogo} className={styles.logo} alt="NestJS logo" />
        </a>
        <a href="https://rushstack.io/" target="_blank">
          <img
            src={rushStackLogo}
            className={styles.logo}
            alt="Rush logo"
          />
        </a>
        <a href="https://trunk.io/" target="_blank">
          <img src={trunkLogo} className={styles.logo} alt="Trunk.io logo" />
        </a>
      </div>
      <div className={styles.technologyTags}>
        <Link
          href="https://cloud.google.com/run"
          target="_blank"
          rel="noreferrer"
          tone="subtle"
          className={styles.technologyTag}
        >
          Google Cloud Run
        </Link>
        <Link
          href="https://neon.com/"
          target="_blank"
          rel="noreferrer"
          tone="subtle"
          className={styles.technologyTag}
        >
          Neon
        </Link>
        <Link
          href="https://www.cloudflare.com/"
          target="_blank"
          rel="noreferrer"
          tone="subtle"
          className={styles.technologyTag}
        >
          Cloudflare
        </Link>
        <Link
          href="https://upstash.com/"
          target="_blank"
          rel="noreferrer"
          tone="subtle"
          className={styles.technologyTag}
        >
          Upstash
        </Link>
      </div>
    </div>
  );
}

function ReadTheDocs() {
  return (
    <p className={styles.readTheDocs}>
      Click the technology links above to learn more about the stack
    </p>
  );
}

type ChatPageProps = {
  chat: ReactNode;
};

export default function ChatPage({ chat }: ChatPageProps) {
  return (
    <section className={styles.home}>
      <Header />
      {chat}
      <ReadTheDocs />
    </section>
  );
}
