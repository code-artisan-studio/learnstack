import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import notesIndexPlugin from "./plugins/notes-index";

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: "Learnstack",
  tagline:
    "My learning notes & interview prep — .NET, Azure, React, DevOps and beyond",
  favicon: "img/favicon.png",

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: "https://learnstack.vercel.app", // update once custom domain is live
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: "/",

  organizationName: "kesavanpotti-dharshan", // Usually your GitHub org/user name.
  projectName: "learnstack", // Usually your repo name.

  onBrokenLinks: "throw",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&family=JetBrains+Mono:wght@400;600&display=swap",
      },
    },
  ],

  stylesheets: [
    {
      href: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css",
      type: "text/css",
      integrity:
        "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV",
      crossorigin: "anonymous",
    },
  ],

  plugins: [notesIndexPlugin],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/kesavanpotti-dharshan/learnstack/tree/main/",
          showLastUpdateTime: true,
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: "img/social-card.png",
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Learnstack",
      logo: {
        alt: "Learnstack Logo",
        src: "img/logo.svg",
      },
      items: [
        { to: "/docs/", label: "Notes", position: "left" },
        { to: "/career", label: "Career", position: "left" },
        {
          href: "https://github.com/kesavanpotti-dharshan/learnstack",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "light",
      links: [
        { label: "Notes", to: "/docs/" },
        { label: "Career", to: "/career" },
        {
          label: "Source on GitHub",
          href: "https://github.com/kesavanpotti-dharshan/learnstack",
        },
      ],
      copyright: `© ${new Date().getFullYear()} Dharshan Kesavan Potti`,
    },
    prism: {
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
