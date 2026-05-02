import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "README",
      label: "Introduction",
    },
    {
      type: "doc",
      id: "system-overview",
      label: "System Overview",
    },
    {
      type: "doc",
      id: "rush-monorepo-foundation",
      label: "Rush Monorepo Foundation",
    },
    {
      type: "doc",
      id: "graphql-contract-boundary",
      label: "GraphQL Contract Boundary",
    },
    {
      type: "doc",
      id: "server-architecture",
      label: "Server Architecture",
    },
    {
      type: "doc",
      id: "webapp-architecture",
      label: "Webapp Architecture",
    },
    {
      type: "doc",
      id: "auth-realtime-and-browser-security",
      label: "Auth, Realtime, And Browser Security",
    },
    {
      type: "doc",
      id: "rush-delivery-release-model",
      label: "Rush Delivery Release Model",
    },
    {
      type: "doc",
      id: "deploy-targets-and-provider-boundaries",
      label: "Deploy Targets And Provider Boundaries",
    },
    {
      type: "doc",
      id: "predeploy-scenarios-and-provider-functions",
      label: "Pre-Deploy Scenarios And Provider Functions",
    },
    {
      type: "doc",
      id: "ci-validation-and-local-workflows",
      label: "CI Validation And Local Workflows",
    },
    {
      type: "doc",
      id: "how-to-evolve-the-project",
      label: "How To Evolve The Project",
    },
  ],
};

export default sidebars;
