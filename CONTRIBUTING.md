# Contributing to Irora Developer Hub

Thank you for helping improve the Irora developer documentation.

## How to contribute

### Option 1: Edit on GitHub

1. Navigate to the page you want to edit in the [developerhub-docs](https://github.com/Irora-dev/developerhub-docs) repo
2. Click the pencil icon to edit
3. Make your changes and submit a pull request

### Option 2: Local development

1. Fork and clone the repository
2. Install the Mintlify CLI: `npm i -g mint`
3. Create a branch: `git checkout -b docs/your-change`
4. Make your changes
5. Preview locally: `mint dev` (opens at `http://localhost:3000`)
6. Validate: `mint validate` and `mint broken-links`
7. Commit and submit a pull request

## Repository structure

```
developerhub-docs/
  docs.json              # Mintlify configuration
  index.mdx              # Hub landing page
  platform/              # Cross-product platform docs
  verifai-sec/           # VerifAI SEC product docs
  snippets/shared/       # Reusable MDX snippets
  _templates/            # Templates for new products
  logo/                  # Irora logo assets
  images/                # Shared images
```

## Writing guidelines

- **Active voice**: "Run the command" not "The command should be run"
- **Second person**: Use "you" instead of "the user"
- **Concise sentences**: One idea per sentence
- **Lead with the goal**: Start instructions with what the user wants to accomplish
- **Consistent terminology**: See `AGENTS.md` for the term glossary
- **Show curl first**: Always include a curl example before SDK examples
- **Use shared snippets**: Import from `snippets/shared/` for auth, errors, rate limits

## Adding a new product

See `PRODUCT_DOCS_GUIDE.md` for the full guide on adding a new product to the hub.

## Pull request checklist

- [ ] `mint dev` renders without errors
- [ ] `mint validate` passes
- [ ] `mint broken-links` returns no broken links
- [ ] New pages are added to `docs.json` navigation
- [ ] Shared snippets are used where applicable
