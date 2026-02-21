import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

// Custom theme configuration
// Extend the default theme with custom styles or components

const theme: Theme = {
  extends: DefaultTheme,
  // Add custom components here:
  // enhanceApp({ app }) {
  //   app.component('CustomComponent', CustomComponent)
  // }
}

export default theme
