# Hugo Blog Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a Hugo-based blog with PaperMod theme, auto-deploying to GitHub Pages via GitHub Actions.

**Architecture:** Hugo static site generator with PaperMod theme as git submodule. Existing markdown content migrates to Hugo's content structure. GitHub Actions workflow builds and deploys on push to main.

**Tech Stack:** Hugo (Extended), PaperMod theme, GitHub Actions, GitHub Pages

---

## Task 1: Initialize Hugo Site Structure

**Files:**
- Create: `config.toml`
- Create: `content/posts/.gitkeep`
- Create: `static/.gitkeep`

**Step 1: Check Hugo installation**

Run: `hugo version`
Expected: Output showing Hugo version (Extended variant preferred). If not installed, skip this plan and install Hugo first.

**Step 2: Initialize basic directory structure**

```bash
mkdir -p content/posts static
touch content/posts/.gitkeep static/.gitkeep
```

Expected: Directories created successfully.

**Step 3: Create basic config.toml**

```toml
baseURL = 'https://USERNAME.github.io/REPONAME/'
languageCode = 'vi'
title = 'My Blog'
theme = 'PaperMod'

[params]
  ShowReadingTime = true
  ShowShareButtons = true
  ShowPostNavLinks = true
  ShowBreadCrumbs = true
  ShowCodeCopyButtons = true

[menu]
  [[menu.main]]
    identifier = "archives"
    name = "Archives"
    url = "/archives/"
    weight = 10
  [[menu.main]]
    identifier = "search"
    name = "Search"
    url = "/search/"
    weight = 20
```

Create file at: `config.toml`

**Step 4: Verify structure**

Run: `ls -la`
Expected: See `config.toml`, `content/`, `static/` directories.

**Step 5: Commit**

```bash
git add config.toml content/posts/.gitkeep static/.gitkeep
git commit -m "feat: initialize Hugo site structure"
```

---

## Task 2: Add PaperMod Theme as Submodule

**Files:**
- Create submodule: `themes/PaperMod/`

**Step 1: Add PaperMod as git submodule**

```bash
git submodule add --depth=1 https://github.com/adityatelange/hugo-PaperMod.git themes/PaperMod
git submodule update --init --recursive
```

Expected: Submodule added successfully, `.gitmodules` file created.

**Step 2: Verify theme files exist**

Run: `ls themes/PaperMod/`
Expected: See theme files (layouts/, assets/, etc.)

**Step 3: Test Hugo build with theme**

Run: `hugo --minify`
Expected: Site builds successfully, outputs to `public/` directory.

**Step 4: Commit**

```bash
git add .gitmodules themes/PaperMod
git commit -m "feat: add PaperMod theme as submodule"
```

---

## Task 3: Migrate Existing Content

**Files:**
- Move: `contents/hành-trình-sử-dụng-ai-agents.md` → `content/posts/hanh-trinh-su-dung-ai-agents.md`
- Remove: `contents/` directory after migration

**Step 1: Read existing content file**

Run: `cat contents/hành-trình-sử-dụng-ai-agents.md | head -n 10`
Expected: See markdown content with Vietnamese text.

**Step 2: Add front matter to content file**

Hugo requires YAML front matter. Create new file at `content/posts/hanh-trinh-su-dung-ai-agents.md`:

```markdown
---
title: "Trải nghiệm sử dụng AI Agent lập trình viên 2026"
date: 2026-01-18
draft: false
tags: ["AI", "Developer Tools", "Experience"]
---

# Trải nghiệm sử dụng AI Agent lập trình viên 2026

[rest of content from original file]
```

**Step 3: Copy content to new location**

```bash
# Copy original content (skip first line "# Title") and append to new file with front matter
tail -n +2 contents/hành-trình-sử-dụng-ai-agents.md >> content/posts/hanh-trinh-su-dung-ai-agents.md
```

**Step 4: Handle images reference**

Note: Original file references `images/ai-dev-desk.jpg` etc. These need to be in `static/images/` to work.

Create placeholder note in content:
```markdown
> Note: Image references need to be moved to static/images/ directory
```

**Step 5: Remove old contents directory**

```bash
rm -rf contents/
```

**Step 6: Verify new content location**

Run: `ls content/posts/`
Expected: See `hanh-trinh-su-dung-ai-agents.md` file.

**Step 7: Test Hugo build**

Run: `hugo server -D`
Expected: Server starts, content visible at http://localhost:1313

**Step 8: Commit**

```bash
git add content/posts/hanh-trinh-su-dung-ai-agents.md
git rm -r contents/
git commit -m "feat: migrate content to Hugo structure"
```

---

## Task 4: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/gh-pages.yml`

**Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Create GitHub Actions workflow file**

Create file at `.github/workflows/gh-pages.yml`:

```yaml
name: Deploy Hugo site to Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

defaults:
  run:
    shell: bash

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.128.0
    steps:
      - name: Install Hugo CLI
        run: |
          wget -O ${{ runner.temp }}/hugo.deb https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb \
          && sudo dpkg -i ${{ runner.temp }}/hugo.deb
      
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: recursive
          fetch-depth: 0
      
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v4
      
      - name: Build with Hugo
        env:
          HUGO_ENVIRONMENT: production
          HUGO_ENV: production
        run: |
          hugo \
            --gc \
            --minify \
            --baseURL "${{ steps.pages.outputs.base_url }}/"
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Step 3: Verify workflow file syntax**

Run: `cat .github/workflows/gh-pages.yml`
Expected: See complete YAML content.

**Step 4: Commit**

```bash
git add .github/workflows/gh-pages.yml
git commit -m "feat: add GitHub Actions workflow for deployment"
```

---

## Task 5: Update Config for GitHub Pages

**Files:**
- Modify: `config.toml`

**Step 1: Determine GitHub repository details**

Run: `git remote get-url origin`
Expected: URL like `https://github.com/USERNAME/REPONAME.git` or `git@github.com:USERNAME/REPONAME.git`

**Step 2: Update baseURL in config.toml**

Based on the origin URL, update `config.toml`:

```toml
baseURL = 'https://USERNAME.github.io/REPONAME/'
```

If repo name is `USERNAME.github.io`, use:
```toml
baseURL = 'https://USERNAME.github.io/'
```

**Step 3: Add archives and search pages config**

Add to `config.toml`:

```toml
[outputs]
  home = ["HTML", "RSS", "JSON"]
```

**Step 4: Verify config syntax**

Run: `hugo --minify`
Expected: Build succeeds without errors.

**Step 5: Commit**

```bash
git add config.toml
git commit -m "feat: configure baseURL for GitHub Pages"
```

---

## Task 6: Create Archive and Search Pages

**Files:**
- Create: `content/archives.md`
- Create: `content/search.md`

**Step 1: Create archives page**

Create file at `content/archives.md`:

```markdown
---
title: "Archives"
layout: "archives"
url: "/archives/"
summary: archives
---
```

**Step 2: Create search page**

Create file at `content/search.md`:

```markdown
---
title: "Search"
layout: "search"
url: "/search/"
---
```

**Step 3: Verify pages**

Run: `hugo server -D`
Expected: Navigate to /archives/ and /search/ - pages render correctly.

**Step 4: Commit**

```bash
git add content/archives.md content/search.md
git commit -m "feat: add archives and search pages"
```

---

## Task 7: Final Verification and Documentation

**Files:**
- Create: `README.md`

**Step 1: Test full build**

Run: `hugo --minify`
Expected: Build completes, `public/` directory contains HTML files.

**Step 2: Check generated files**

Run: `ls public/`
Expected: See `index.html`, `posts/`, `archives/`, `search/` directories.

**Step 3: Create README**

Create file at `README.md`:

```markdown
# My Blog

Personal blog built with Hugo and PaperMod theme, deployed to GitHub Pages.

## Local Development

1. Install Hugo Extended: https://gohugo.io/installation/
2. Clone with submodules: `git clone --recurse-submodules <repo-url>`
3. Run dev server: `hugo server -D`
4. Visit: http://localhost:1313

## Adding Content

Create new post:
```bash
hugo new posts/my-new-post.md
```

Edit the generated file in `content/posts/`, add your content, set `draft: false`.

## Deployment

Pushes to `main` branch automatically deploy via GitHub Actions.

## Theme

Using [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme.
```

**Step 4: Verify README**

Run: `cat README.md`
Expected: See complete README content.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```

**Step 6: Push to trigger deployment**

```bash
git push origin feature/hugo-setup
```

Expected: Branch pushed successfully. GitHub Actions workflow will trigger on merge to main.

---

## Post-Implementation Steps

1. **Merge to main**: Create PR from `feature/hugo-setup` to `main`, review and merge.
2. **Enable GitHub Pages**: Go to repository Settings → Pages → Source: GitHub Actions.
3. **Verify deployment**: Check Actions tab for workflow run, visit `https://USERNAME.github.io/REPONAME/`.
4. **Add images**: If needed, copy image files referenced in posts to `static/images/` directory.

## Notes

- Hugo Extended version required for PaperMod theme (SCSS processing).
- Submodules must be initialized when cloning (`--recurse-submodules`).
- GitHub Pages deployment requires "Pages" enabled in repository settings.
- Content files need YAML front matter to be processed by Hugo.
