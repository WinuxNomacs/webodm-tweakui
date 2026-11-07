// The TweakUI documentation site (VitePress): `npm run docs:dev`, `npm run docs:build` (into docs/.vitepress/dist).
// Published to GitHub Pages by .github/workflows/docs.yml on a release tag or by hand. The images are the settings
// page's previews, tweakui/public/previews/, linked from the pages by a relative path (one copy for both).
import { defineConfig } from "vitepress";

const repo = "https://github.com/WinuxNomacs/webodm-tweakui";

export default defineConfig({
  title: "TweakUI",
  description: "Small enhancements to WebODM's interface, as a WebODM plugin.",
  base: "/webodm-tweakui/",
  cleanUrls: true,
  lastUpdated: false,
  themeConfig: {
    nav: [
      { text: "Features", link: "/general" },
      { text: "Install", link: "/install" },
      { text: "Developing", link: "/developing" },
    ],
    sidebar: [
      {
        text: "Features",
        items: [
          { text: "General", link: "/general" },
          { text: "Themes", link: "/themes" },
          { text: "2D Map", link: "/map-2d" },
          { text: "3D Map", link: "/map-3d" },
          { text: "Storage", link: "/storage" },
        ],
      },
      {
        text: "Using TweakUI",
        items: [
          { text: "Install", link: "/install" },
          { text: "Developing", link: "/developing" },
          { text: "Adding a Tweak", link: "/adding-a-tweak" },
          { text: "Thanks", link: "/thanks" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: repo }],
    search: { provider: "local" },
    footer: { message: "AGPL-3.0. Not part of WebODM." },
  },
});
