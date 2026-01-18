# Hugo Blog Setup Design
**Date:** 2026-01-18
**Status:** Approved

## Overview
Setup a personal blog hosted on GitHub Pages using Hugo and the PaperMod theme. The system will auto-deploy via GitHub Actions when markdown content is pushed.

## Architecture & Structure

### Directory Structure
Adhere to standard Hugo conventions:
```text
.
├── config.toml         # Main configuration (site title, theme settings)
├── content/
│   └── posts/          # Migrated from existing 'contents/'
├── themes/
│   └── PaperMod/       # Git submodule
├── static/             # Images, CSS overrides
└── .github/
    └── workflows/      # CI/CD configuration
```

### Components
1.  **Engine**: Hugo (Extended version required for PaperMod).
2.  **Theme**: [PaperMod](https://github.com/adityatelange/hugo-PaperMod) added as a submodule.
3.  **Content**: Existing markdown files moved to `content/posts/`.

## Deployment (CI/CD)
**Tool**: GitHub Actions
**Workflow**:
1.  Trigger on push to `main`.
2.  Checkout code (with submodules).
3.  Setup Hugo via `peaceiris/actions-hugo`.
4.  Build site (`hugo --minify`).
5.  Deploy using `actions/deploy-pages`.

## Implementation Steps
1.  Initialize Hugo structure.
2.  Migrate `contents/` -> `content/posts/`.
3.  Add PaperMod submodule.
4.  Create `config.toml` with basic defaults.
5.  Create GitHub Actions workflow file.
