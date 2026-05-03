import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import type { ReactElement } from "react";

import styles from "./index.module.css";

export default function Home(): ReactElement {
  return (
    <Layout
      title="Project Docs"
      description="Documentation for the project architecture and delivery model"
    >
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>Project Architecture</p>
          <Heading as="h1" className={styles.title}>
            Design notes for the full stack
          </Heading>
          <p className={styles.lede}>
            A focused guide to the Rush monorepo, GraphQL contract, server,
            webapp, deployment boundaries, and release workflow.
          </p>
          <Link className="button button--primary button--lg" to="/tutorial/">
            Open tutorial
          </Link>
        </section>
      </main>
    </Layout>
  );
}
