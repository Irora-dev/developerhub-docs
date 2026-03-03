# Adding a new product to Irora Developer Hub

## Recommended: Use the wizard

The fastest way to add a new product is the **Product Docs Wizard**:

```bash
# Interactive mode — step-by-step prompts
node scripts/add-product.mjs

# Non-interactive mode — for CI and AI agents
node scripts/add-product.mjs --config config.json

# Preview changes without writing files
node scripts/add-product.mjs --config config.json --dry-run
```

The wizard handles all scaffolding, placeholder replacement, `docs.json` and `index.mdx` updates, and validation in one command. See `AGENTS.md` for the config JSON schema and field rules.

After running the wizard, edit the generated files with your real content (capabilities, quickstart, OpenAPI spec, guides).

---

## Manual steps (reference)

The sections below document the manual process. Use these as a reference if the wizard doesn't cover your use case.

This guide walks through adding documentation for a new Irora product. Estimated time: 1-2 hours for basic docs (intro + quickstart + API reference).

## Prerequisites

- Mintlify CLI installed: `npm i -g mint`
- Access to the product's API server (for building the OpenAPI spec)

## Step 1: Copy the template

```bash
cd /path/to/developerhub-docs
cp -r _templates/product-docs/ <product-slug>/
```

Use a lowercase, hyphenated slug that matches the product's API path (e.g., `sanctionseeker`, `verifai-sec`).

## Step 2: Fill in the templates

Each template file contains `{{PLACEHOLDER}}` values. Replace them all:

| Placeholder | Description | Example |
|---|---|---|
| `{{PRODUCT_NAME}}` | Display name | SanctionsSeeker |
| `{{PRODUCT_SLUG}}` | URL-safe slug | sanctionseeker |
| `{{PRODUCT_TAGLINE}}` | One-line description | Global sanctions screening API |
| `{{PRODUCT_DESCRIPTION}}` | Full intro paragraph | SanctionsSeeker provides... |
| `{{PRODUCT_DESCRIPTION_SHORT}}` | Short one-liner | sanctions screening data |
| `{{EXAMPLE_ENDPOINT}}` | First endpoint to demo | search |
| `{{GUIDE_TITLE}}` | First guide title | Search syntax |
| `{{GUIDE_DESCRIPTION}}` | First guide description | How to write search queries |

## Step 3: Add your OpenAPI spec

Replace `<product-slug>/openapi.yaml` with your real OpenAPI spec. You can build one by:

1. **From an Express server**: Read each route handler, document the request/response schemas
2. **From an existing spec**: Copy and adapt
3. **From scratch**: Use the template as a starting point

The spec should include:
- All public endpoints with request/response schemas
- Authentication (Bearer token security scheme)
- Server URLs (production + local dev)

## Step 4: Add navigation to docs.json

Add a new tab to the `navigation.tabs` array in `docs.json`:

```json
{
  "tab": "<Product Name>",
  "groups": [
    {
      "group": "Overview",
      "pages": [
        "<product-slug>/index",
        "<product-slug>/quickstart"
      ]
    },
    {
      "group": "Guides",
      "pages": [
        "<product-slug>/guides/example-guide"
      ]
    }
  ]
}
```

If the product has an OpenAPI spec, add it to the API Reference tab:

```json
{
  "tab": "API Reference",
  "groups": [
    {
      "group": "<Product Name> API",
      "pages": [
        "<product-slug>/api-reference/introduction"
      ]
    }
  ],
  "openapi": "<product-slug>/openapi.yaml"
}
```

## Step 5: Update the hub landing page

Add a card for the new product in `index.mdx`:

```mdx
<Card title="<Product Name>" icon="<icon>" href="/<product-slug>">
  Brief product description for the hub landing page.
</Card>
```

## Step 6: Import shared snippets

Where applicable, import shared content instead of duplicating:

```mdx
<Snippet file="shared/auth-setup.mdx" />
<Snippet file="shared/error-codes.mdx" />
<Snippet file="shared/rate-limits.mdx" />
<Snippet file="shared/response-format.mdx" />
```

## Step 7: Add to footer

Add the product to the footer links in `docs.json`:

```json
{
  "header": "Products",
  "items": [
    { "label": "VerifAI SEC", "href": "/verifai-sec" },
    { "label": "<Product Name>", "href": "/<product-slug>" }
  ]
}
```

## Step 8: Preview and validate

```bash
# Preview locally
mint dev

# Validate configuration
mint validate

# Check for broken links
mint broken-links
```

## Step 9: Submit PR

```bash
git checkout -b docs/<product-slug>
git add <product-slug>/ docs.json index.mdx
git commit -m "Add <Product Name> documentation"
git push -u origin docs/<product-slug>
```

CI will run `mint validate` and `mint broken-links` automatically.

## Step 10: Add to .mintignore (if needed)

If the template directory causes build warnings, ensure `_templates/` is in `.mintignore`:

```
_templates/
```

## Directory structure reference

After adding a product, the repo should look like:

```
developerhub-docs/
  docs.json
  index.mdx                          # Hub landing page (updated)
  platform/                           # Cross-product docs
  verifai-sec/                        # Existing product
  <product-slug>/                     # Your new product
    index.mdx                         # Product intro
    quickstart.mdx                    # Getting started
    openapi.yaml                      # OpenAPI spec
    guides/
      example-guide.mdx               # First guide
    api-reference/
      introduction.mdx                # API reference intro
  snippets/shared/                    # Reusable snippets
  _templates/product-docs/            # Template (don't modify)
```
