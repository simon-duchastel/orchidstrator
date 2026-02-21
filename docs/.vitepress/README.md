# Documentation Site Setup

This directory contains configuration for building a VitePress documentation site.

## About VitePress

[VitePress](https://vitepress.dev/) is a static site generator powered by Vite and Vue. It generates fast, SEO-friendly documentation sites from Markdown files.

## Prerequisites

To build the documentation site, you'll need to install VitePress:

```bash
npm install -D vitepress
```

Or add it to the project's devDependencies:

```bash
npm install --save-dev vitepress
```

## File Structure

```
docs/
├── .vitepress/
│   ├── config.ts          # Site configuration
│   ├── theme/
│   │   ├── index.ts       # Theme customization
│   │   └── custom.css     # Custom styles
│   └── README.md          # This file
├── README.md              # Documentation homepage
├── architecture.md        # Architecture docs
├── testing.md            # Testing guide
├── code-principles.md    # Code principles
├── cli-philosophy.md     # CLI design
└── best-practices.md     # Best practices
```

## Development

### Local Development Server

```bash
# Start dev server
npx vitepress dev docs

# Or with npm script (add to package.json)
"docs:dev": "vitepress dev docs"
```

The dev server will start at `http://localhost:5173` (or similar port).

### Building for Production

```bash
# Build static site
npx vitepress build docs

# Or with npm script
"docs:build": "vitepress build docs"
```

The built site will be output to `dist-docs/` (configured in `config.ts`).

### Preview Production Build

```bash
# Preview the built site
npx vitepress preview docs
```

## Customization

### Theme Configuration

Edit `.vitepress/config.ts` to customize:
- Site title and description
- Navigation sidebar
- Footer
- Search configuration
- Social links

### Custom Styles

Edit `.vitepress/theme/custom.css` to customize:
- Brand colors
- Typography
- Component styling

### Custom Components

To add Vue components:

1. Create component in `.vitepress/theme/components/`
2. Register in `.vitepress/theme/index.ts`:

```typescript
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import CustomComponent from './components/CustomComponent.vue'

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CustomComponent', CustomComponent)
  }
}

export default theme
```

## Deployment

### GitHub Pages

1. Add GitHub Action workflow (`.github/workflows/docs.yml`):

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist-docs
      - uses: actions/deploy-pages@v4
```

2. Enable GitHub Pages in repository settings

### Netlify

1. Connect repository to Netlify
2. Set build command: `npm run docs:build`
3. Set publish directory: `dist-docs`

### Vercel

1. Connect repository to Vercel
2. Set framework preset to "Other"
3. Set build command: `npm run docs:build`
4. Set output directory: `dist-docs`

## Writing Documentation

### Markdown Features

VitePress supports standard Markdown plus:

- **Frontmatter**: YAML metadata at top of file
- **Custom containers**: `::: tip`, `::: warning`, `::: danger`
- **Line highlighting**: Code blocks with `{1,3}` syntax
- **Import code snippets**: `<<< @/path/to/file.ts`

### Example

```markdown
---
outline: deep
---

# Page Title

## Section

Content here...

::: tip
This is a helpful tip!
:::

::: warning
Be careful about this.
:::

```typescript
// Code with line highlighting
console.log('line 1')
console.log('line 2') // highlighted
console.log('line 3')
```

<<< @/src/example.ts
```

## References

- [VitePress Documentation](https://vitepress.dev/)
- [Markdown Extensions](https://vitepress.dev/guide/markdown)
- [Theme Configuration](https://vitepress.dev/reference/default-theme-config)
- [Frontmatter Config](https://vitepress.dev/reference/frontmatter-config)
