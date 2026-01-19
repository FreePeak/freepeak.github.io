# My Blog

Personal blog built with Hugo and PaperMod theme, deployed to GitHub Pages.

## Local Development

Prerequisites:
- [Hugo Extended](https://gohugo.io/installation/)
- [Make](https://www.gnu.org/software/make/) (optional, but recommended)

### Quick Start

1. Clone with submodules:
   ```bash
   git clone --recurse-submodules <repo-url>
   cd <repo-name>
   ```

2. Run the development server:
   ```bash
   make run
   # Or manually: hugo server -D
   ```

3. Visit: http://localhost:1313

### Available Commands

- `make run`: Start dev server with drafts
- `make build`: Build for production
- `make clean`: Remove build artifacts

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
