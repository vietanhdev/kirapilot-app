# KiraPilot Documentation

This directory contains the comprehensive documentation for KiraPilot built with Docusaurus v3.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Serve production build locally
npm run serve
```

## Structure

- `docs/` - Documentation content in Markdown
  - `user-guide/` - End-user documentation
  - `developer/` - Developer documentation
  - `api/` - API reference documentation
- `src/` - Custom React components and pages
- `static/` - Static assets (images, icons, etc.)
- `docusaurus.config.ts` - Main configuration file
- `sidebars.ts` - Navigation structure

## Writing Documentation

### Adding New Pages

1. Create a new `.md` file in the appropriate directory under `docs/`
2. Add the page to the relevant sidebar in `sidebars.ts`
3. Use proper frontmatter for metadata

### Custom Components

Custom React components are located in `src/components/`. These can be used in Markdown files using MDX syntax.

### Styling

Custom styles are in `src/css/custom.css`. The documentation uses KiraPilot's brand colors and design system.

## Deployment

The documentation is configured for GitHub Pages deployment. The build process generates static files in the `build/` directory.

## Development

- The documentation uses TypeScript for type safety
- All pages are responsive and support dark/light themes
- Search functionality is built-in with Docusaurus
- The site includes proper SEO metadata and social cards

## Contributing

When adding new documentation:

1. Follow the existing structure and naming conventions
2. Include proper headings and navigation
3. Add screenshots and examples where helpful
4. Test the build locally before committing
5. Update the sidebar navigation if adding new sections
