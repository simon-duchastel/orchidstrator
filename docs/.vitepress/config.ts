import { defineConfig } from 'vitepress'

// VitePress configuration for Orchid documentation
// https://vitepress.dev/reference/site-config

export default defineConfig({
  title: 'Orchid',
  description: 'Orchestrate complex background AI tasks',
  
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Documentation', link: '/architecture' },
      { text: 'GitHub', link: 'https://github.com/simon-duchastel/orchid' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Installation', link: '/#quick-start' },
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'System Architecture', link: '/architecture' },
          { text: 'CLI Philosophy', link: '/cli-philosophy' },
          { text: 'Code Principles', link: '/code-principles' },
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Testing', link: '/testing' },
          { text: 'Best Practices', link: '/best-practices' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/simon-duchastel/orchid' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Orchid Contributors'
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/simon-duchastel/orchid/edit/main/docs/:path'
    }
  },

  // Markdown configuration
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // Build configuration
  srcDir: '.',
  outDir: '../dist-docs',
  
  // Clean URLs (no .html extension)
  cleanUrls: true,
})
