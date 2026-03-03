# Irora Developer Hub — AI Agent instructions

## About this project

- Documentation site for all Irora developer products, built on [Mintlify](https://mintlify.com)
- Pages are MDX files with YAML frontmatter
- Configuration lives in `docs.json`
- Run `mint dev` to preview locally
- Run `mint broken-links` to check links

## Terminology

- **Irora** — the parent company/platform
- **Irora SEC** — SEC filing intelligence product (always include "SEC" after "Irora")
- **filing** — an SEC filing document (not "report" or "document")
- **form type** — e.g. 10-K, 8-K, DEF 14A (always use the official SEC form code)
- **API key** — not "token" or "secret" (except in code context)
- **endpoint** — a specific API route (not "API" when referring to a single route)

## Style preferences

- Use active voice and second person ("you")
- Keep sentences concise — one idea per sentence
- Use sentence case for headings
- Bold for UI elements: Click **Settings**
- Code formatting for file names, commands, paths, code references, and API parameters
- Always show curl examples first, then language-specific SDK examples
- Use the shared snippets in `snippets/shared/` for auth, errors, rate limits, and response format

## Content boundaries

- Document public APIs only — no internal admin endpoints
- Do not expose actual API keys, secrets, or internal infrastructure details
- Each product's docs live in their own directory (e.g., `irora-sec/`)
- Platform-level docs (auth, errors, rate limits) live in `platform/`
- Reusable content goes in `snippets/shared/`

## Adding a new product

Use the **Product Docs Wizard** to scaffold a new product automatically:

```bash
node scripts/add-product.mjs --config config.json
```

Add `--dry-run` to preview changes without writing files.

### Config JSON schema

Create a JSON file with **all 10 fields** (all required):

```json
{
  "productName": "New Product",
  "productSlug": "new-product",
  "productTagline": "One-line product description",
  "productDescription": "Full paragraph describing the product (20+ chars).",
  "productDescriptionShort": "short product description",
  "exampleEndpoint": "search",
  "guideTitle": "Getting started guide",
  "guideDescription": "How to use the product",
  "icon": "bolt",
  "hasOpenApi": true
}
```

### Field rules

| Field | Rule |
|---|---|
| `productSlug` | Lowercase alphanumeric + hyphens, 2-40 chars, no leading/trailing hyphen |
| `productName` | 2-80 chars, no `{{` |
| `productTagline` | 5-120 chars |
| `productDescription` | 20-2000 chars |
| `productDescriptionShort` | 5-200 chars |
| `exampleEndpoint` | Lowercase alphanumeric + hyphens/slashes, no leading slash, max 60 chars |
| `icon` | Lowercase FontAwesome icon name (e.g. `shield-halved`, `chart-line`, `brain`) |
| `hasOpenApi` | `true` or `false` |

### Common icon choices

`shield-halved`, `file-contract`, `magnifying-glass`, `chart-line`, `database`, `bolt`, `brain`, `globe`, `lock`, `code`, `robot`, `scale-balanced`

### Slug conventions

- Lowercase, hyphenated: `irora-sec`, `new-product`
- Match the product's API path segment
- No leading/trailing hyphens

### Non-interactive output format

The script outputs one JSON line per step:

```
{"step":"preflight","status":"ok"}
{"step":"scaffold","status":"ok","files":["slug/index.mdx",...]}
{"step":"docs_json","status":"ok","changes":["added_product_tab","added_footer_link"]}
{"step":"index_mdx","status":"ok"}
{"step":"validate","status":"ok"}
{"step":"complete","nextSteps":["Edit slug/index.mdx..."]}
```

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Input validation error |
| 2 | Pre-flight check failed |
| 3 | File I/O error |
| 4 | Post-validation error |
| 5 | Mint validation error |

### Recommended workflow for AI agents

1. Write your config JSON file
2. Run with `--dry-run` first: `node scripts/add-product.mjs --config config.json --dry-run`
3. If dry run passes, run without `--dry-run`
4. After scaffolding, edit the generated files with real content:
   - Replace placeholder capabilities in `<slug>/index.mdx`
   - Write a real quickstart in `<slug>/quickstart.mdx`
   - Replace `<slug>/openapi.yaml` with the real OpenAPI spec
   - Write guides in `<slug>/guides/`
5. Run `mint validate` to confirm Mintlify is happy

See `PRODUCT_DOCS_GUIDE.md` for the full manual reference.
