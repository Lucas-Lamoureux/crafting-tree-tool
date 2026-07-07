# Dependency Tree Explorer

A React + Vite dependency tree editor for building and organizing ID-based ingredient relationships.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Deploy

This project is ready for Netlify.

Build settings:

```text
Build command: npm run build
Publish directory: dist
```

The included `netlify.toml` already sets those values and uses Node 20.

## Save And Load Projects

Use **Save JSON** inside the app to download your current project.

Use **Load JSON** inside the app to restore a saved project on any computer.

Saved project files include:

- Tile IDs and ingredient links
- Descriptions
- Checked states
- Collapsed branches
- Tile positions
- Text blocks
