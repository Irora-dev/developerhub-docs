# Product docs template

Use this template to create documentation for a new Irora product.

## Quick start

1. Copy this directory to the product name:
   ```bash
   cp -r _templates/product-docs/ <product-slug>/
   ```

2. Find and replace all placeholders:

   | Placeholder                     | Example value                            |
   | ------------------------------- | ---------------------------------------- |
   | `{{PRODUCT_NAME}}`              | New Product                              |
   | `{{PRODUCT_SLUG}}`              | new-product                              |
   | `{{PRODUCT_TAGLINE}}`           | Global sanctions screening API           |
   | `{{PRODUCT_DESCRIPTION}}`       | Full paragraph describing the product    |
   | `{{PRODUCT_DESCRIPTION_SHORT}}` | Short one-liner for API reference intro  |
   | `{{EXAMPLE_ENDPOINT}}`          | search                                   |
   | `{{GUIDE_TITLE}}`               | Search syntax                            |
   | `{{GUIDE_DESCRIPTION}}`         | How to write search queries              |

3. Edit each file with product-specific content.

4. Replace `openapi.yaml` with your real OpenAPI spec (or build one from your server).

5. Add navigation to `docs.json`:
   ```json
   {
     "tab": "<Product Name>",
     "groups": [
       {
         "group": "Overview",
         "pages": ["<product-slug>/index", "<product-slug>/quickstart"]
       },
       {
         "group": "Guides",
         "pages": ["<product-slug>/guides/example-guide"]
       }
     ]
   }
   ```

6. Add the product to the hub landing page (`index.mdx`) card grid.

7. Preview: `mint dev`

8. Validate: `mint validate && mint broken-links`

See `PRODUCT_DOCS_GUIDE.md` in the repo root for the full step-by-step guide.
