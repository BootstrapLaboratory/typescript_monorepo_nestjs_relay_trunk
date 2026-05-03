import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const siteUrl = process.env.DOCS_SITE_URL ?? "https://example.com";
const appUrl = process.env.DOCS_APP_URL ?? siteUrl;

const config: Config = {
  title: "Project Docs",
  tagline: "Architecture notes for the Rush, GraphQL, and Cloudflare project.",
  url: siteUrl,
  baseUrl: "/docs/",
  trailingSlash: true,
  onBrokenLinks: "throw",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          path: "../../docs/tutorial",
          routeBasePath: "tutorial",
          sidebarPath: "./sidebars.ts",
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],
  themeConfig: {
    image: "img/social-card.svg",
    navbar: {
      title: "Project Docs",
      items: [
        {
          to: "/tutorial/",
          label: "Tutorial",
          position: "left",
        },
        {
          href: appUrl,
          label: "Application",
          position: "right",
          target: "_self",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Project Design Tutorial",
              to: "/tutorial/",
            },
          ],
        },
        {
          title: "Project",
          items: [
            {
              label: "Application",
              href: appUrl,
              target: "_self",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Bootstrap Laboratory.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
