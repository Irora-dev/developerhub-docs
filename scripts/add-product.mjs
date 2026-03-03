#!/usr/bin/env node

/**
 * Product Docs Wizard — scaffolds a new product in the Irora Developer Hub.
 *
 * Usage:
 *   Interactive:      node scripts/add-product.mjs
 *   Non-interactive:  node scripts/add-product.mjs --config config.json
 *   Dry run:          node scripts/add-product.mjs --config config.json --dry-run
 *
 * Exit codes: 0=success, 1=input validation, 2=pre-flight, 3=file I/O, 4=post-validation, 5=mint validation
 */

import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..");
const TEMPLATE_DIR = path.join(ROOT, "_templates", "product-docs");
const DOCS_JSON_PATH = path.join(ROOT, "docs.json");
const INDEX_MDX_PATH = path.join(ROOT, "index.mdx");

const PLACEHOLDERS = [
  "PRODUCT_NAME",
  "PRODUCT_SLUG",
  "PRODUCT_TAGLINE",
  "PRODUCT_DESCRIPTION",
  "PRODUCT_DESCRIPTION_SHORT",
  "EXAMPLE_ENDPOINT",
  "GUIDE_TITLE",
  "GUIDE_DESCRIPTION",
];

const COMMON_ICONS = [
  "shield-halved",
  "file-contract",
  "magnifying-glass",
  "chart-line",
  "database",
  "bolt",
  "brain",
  "globe",
  "lock",
  "code",
  "robot",
  "scale-balanced",
];

// Validation rules
const RULES = {
  productSlug: {
    re: /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/,
    msg: "Lowercase alphanumeric + hyphens, 2-40 chars, no leading/trailing hyphen",
  },
  productName: {
    test: (v) => v.length >= 2 && v.length <= 80 && !v.includes("{{"),
    msg: "2-80 chars, must not contain {{",
  },
  productTagline: {
    test: (v) => v.length >= 5 && v.length <= 120,
    msg: "5-120 chars",
  },
  productDescription: {
    test: (v) => v.length >= 20 && v.length <= 2000,
    msg: "20-2000 chars",
  },
  productDescriptionShort: {
    test: (v) => v.length >= 5 && v.length <= 200,
    msg: "5-200 chars",
  },
  exampleEndpoint: {
    re: /^[a-z0-9][a-z0-9\-/]{0,59}$/,
    msg: 'Lowercase alphanumeric + hyphens/slashes, no leading slash, max 60 chars',
  },
  icon: {
    re: /^[a-z][a-z0-9-]{0,40}$/,
    msg: "Lowercase, starts with letter, alphanumeric + hyphens, max 41 chars",
  },
  hasOpenApi: {
    test: (v) => typeof v === "boolean",
    msg: "Must be true or false",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validate(field, value) {
  const rule = RULES[field];
  if (!rule) return null;
  if (rule.re && !rule.re.test(value)) return rule.msg;
  if (rule.test && !rule.test(value)) return rule.msg;
  return null;
}

function validateAll(config) {
  const errors = [];
  for (const [field, rule] of Object.entries(RULES)) {
    if (!(field in config)) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    const err = validate(field, config[field]);
    if (err) errors.push(`${field}: ${err} (got: ${JSON.stringify(config[field])})`);
  }
  return errors;
}

function slugFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Recursively collect all files in a directory (relative paths). */
function walkDir(dir, base = dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(full, base));
    } else {
      results.push(path.relative(base, full));
    }
  }
  return results;
}

/** Replace all {{PLACEHOLDER}} tokens in content. */
function replacePlaceholders(content, config) {
  return content
    .replace(/\{\{PRODUCT_NAME\}\}/g, config.productName)
    .replace(/\{\{PRODUCT_SLUG\}\}/g, config.productSlug)
    .replace(/\{\{PRODUCT_TAGLINE\}\}/g, config.productTagline)
    .replace(/\{\{PRODUCT_DESCRIPTION\}\}/g, config.productDescription)
    .replace(/\{\{PRODUCT_DESCRIPTION_SHORT\}\}/g, config.productDescriptionShort)
    .replace(/\{\{EXAMPLE_ENDPOINT\}\}/g, config.exampleEndpoint)
    .replace(/\{\{GUIDE_TITLE\}\}/g, config.guideTitle)
    .replace(/\{\{GUIDE_DESCRIPTION\}\}/g, config.guideDescription);
}

// ---------------------------------------------------------------------------
// Logging (adapts to mode)
// ---------------------------------------------------------------------------

let nonInteractive = false;

function log(step, status, extra = {}) {
  if (nonInteractive) {
    console.log(JSON.stringify({ step, status, ...extra }));
  }
}

function info(msg) {
  if (!nonInteractive) console.log(msg);
}

function warn(msg) {
  if (nonInteractive) {
    console.log(JSON.stringify({ step: "warning", message: msg }));
  } else {
    console.log(`⚠  ${msg}`);
  }
}

function fatal(msg, code) {
  if (nonInteractive) {
    console.log(JSON.stringify({ step: "error", status: "fail", message: msg }));
  } else {
    console.error(`\nError: ${msg}`);
  }
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Backup / rollback helpers
// ---------------------------------------------------------------------------

const backups = {};

function backup(filePath) {
  if (fs.existsSync(filePath)) {
    backups[filePath] = fs.readFileSync(filePath, "utf8");
  }
}

function restoreBackups() {
  for (const [filePath, content] of Object.entries(backups)) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Step 1: Pre-flight
// ---------------------------------------------------------------------------

function preflight(config) {
  // Template dir exists
  if (!fs.existsSync(TEMPLATE_DIR)) {
    fatal(`Template directory not found: ${TEMPLATE_DIR}`, 2);
  }

  // docs.json is valid JSON
  try {
    JSON.parse(fs.readFileSync(DOCS_JSON_PATH, "utf8"));
  } catch {
    fatal(`docs.json is not valid JSON`, 2);
  }

  // Slug not taken
  const productDir = path.join(ROOT, config.productSlug);
  if (fs.existsSync(productDir)) {
    fatal(`Directory already exists: ${config.productSlug}/`, 2);
  }

  // Check slug doesn't collide with existing nav tabs
  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, "utf8"));
  const existingSlugs = (docsJson.navigation?.tabs || [])
    .flatMap((tab) => (tab.groups || []).flatMap((g) => g.pages || []))
    .map((p) => p.split("/")[0]);
  if (existingSlugs.includes(config.productSlug)) {
    fatal(`Slug "${config.productSlug}" already used in docs.json navigation`, 2);
  }

  log("preflight", "ok");
  info("✓ Pre-flight checks passed");
}

// ---------------------------------------------------------------------------
// Step 2: Scaffold
// ---------------------------------------------------------------------------

function scaffold(config, dryRun) {
  const productDir = path.join(ROOT, config.productSlug);
  const templateFiles = walkDir(TEMPLATE_DIR).filter((f) => f !== "README.md");

  if (dryRun) {
    log("scaffold", "ok", {
      dryRun: true,
      files: templateFiles.map((f) => `${config.productSlug}/${f}`),
    });
    info(`✓ Would scaffold ${templateFiles.length} files into ${config.productSlug}/`);
    for (const f of templateFiles) info(`  ${config.productSlug}/${f}`);
    return templateFiles;
  }

  try {
    for (const relFile of templateFiles) {
      const src = path.join(TEMPLATE_DIR, relFile);
      const dest = path.join(productDir, relFile);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    removeDir(productDir);
    fatal(`Failed to scaffold: ${err.message}`, 3);
  }

  log("scaffold", "ok", {
    files: templateFiles.map((f) => `${config.productSlug}/${f}`),
  });
  info(`✓ Scaffolded ${templateFiles.length} files into ${config.productSlug}/`);
  return templateFiles;
}

// ---------------------------------------------------------------------------
// Step 3: Replace placeholders
// ---------------------------------------------------------------------------

function replacePlaceholdersInDir(config, dryRun) {
  const productDir = path.join(ROOT, config.productSlug);

  if (dryRun) {
    log("replace", "ok", { dryRun: true, placeholders: PLACEHOLDERS });
    info(`✓ Would replace ${PLACEHOLDERS.length} placeholders`);
    return;
  }

  try {
    const files = walkDir(productDir, productDir);
    for (const relFile of files) {
      const filePath = path.join(productDir, relFile);
      const content = fs.readFileSync(filePath, "utf8");
      const replaced = replacePlaceholders(content, config);
      if (replaced !== content) {
        fs.writeFileSync(filePath, replaced, "utf8");
      }
    }
  } catch (err) {
    removeDir(productDir);
    fatal(`Failed to replace placeholders: ${err.message}`, 3);
  }

  log("replace", "ok", { placeholders: PLACEHOLDERS });
  info(`✓ Replaced all placeholders`);
}

// ---------------------------------------------------------------------------
// Step 4: Update docs.json
// ---------------------------------------------------------------------------

function updateDocsJson(config, dryRun) {
  backup(DOCS_JSON_PATH);
  const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, "utf8"));
  const changes = [];

  // --- Add product navigation tab ---
  const tabs = docsJson.navigation?.tabs || [];
  const apiRefIdx = tabs.findIndex((t) => t.tab === "API Reference");

  const newTab = {
    tab: config.productName,
    groups: [
      {
        group: "Overview",
        pages: [
          `${config.productSlug}/index`,
          `${config.productSlug}/quickstart`,
        ],
      },
      {
        group: "Guides",
        pages: [`${config.productSlug}/guides/example-guide`],
      },
    ],
  };

  if (apiRefIdx >= 0) {
    tabs.splice(apiRefIdx, 0, newTab);
  } else {
    tabs.push(newTab);
  }
  changes.push("added_product_tab");

  // --- Add OpenAPI reference ---
  if (config.hasOpenApi) {
    // Find the API Reference tab (index may have shifted after splice)
    const refTab = tabs.find((t) => t.tab === "API Reference");
    if (refTab) {
      // Add API group for this product
      refTab.groups = refTab.groups || [];
      refTab.groups.push({
        group: `${config.productName} API`,
        pages: [`${config.productSlug}/api-reference/introduction`],
      });

      // Handle openapi field — convert string to array if needed
      if (typeof refTab.openapi === "string") {
        refTab.openapi = [refTab.openapi, `${config.productSlug}/openapi.yaml`];
      } else if (Array.isArray(refTab.openapi)) {
        refTab.openapi.push(`${config.productSlug}/openapi.yaml`);
      } else {
        refTab.openapi = [`${config.productSlug}/openapi.yaml`];
      }
      changes.push("added_openapi_ref");
    }
  }

  // --- Add footer link ---
  const footerLinks = docsJson.footer?.links || [];
  const productsGroup = footerLinks.find((g) => g.header === "Products");
  if (productsGroup) {
    productsGroup.items.push({
      label: config.productName,
      href: `/${config.productSlug}`,
    });
    changes.push("added_footer_link");
  }

  if (dryRun) {
    log("docs_json", "ok", { dryRun: true, changes });
    info(`✓ Would update docs.json: ${changes.join(", ")}`);
    return;
  }

  try {
    fs.writeFileSync(DOCS_JSON_PATH, JSON.stringify(docsJson, null, 2) + "\n", "utf8");
  } catch (err) {
    restoreBackups();
    removeDir(path.join(ROOT, config.productSlug));
    fatal(`Failed to update docs.json: ${err.message}`, 3);
  }

  log("docs_json", "ok", { changes });
  info(`✓ Updated docs.json: ${changes.join(", ")}`);
}

// ---------------------------------------------------------------------------
// Step 5: Update index.mdx
// ---------------------------------------------------------------------------

function updateIndexMdx(config, dryRun) {
  backup(INDEX_MDX_PATH);
  const content = fs.readFileSync(INDEX_MDX_PATH, "utf8");

  // Build the new card
  const newCard = `  <Card title="${config.productName}" icon="${config.icon}" href="/${config.productSlug}">\n    ${config.productTagline}\n  </Card>`;

  // Find the first </CardGroup> and insert before it
  const closingTag = "</CardGroup>";
  const firstCloseIdx = content.indexOf(closingTag);
  if (firstCloseIdx < 0) {
    warn("Could not find <CardGroup> in index.mdx — skipping card insertion");
    log("index_mdx", "skipped", { reason: "no CardGroup found" });
    return;
  }

  const newContent = content.slice(0, firstCloseIdx) + newCard + "\n" + content.slice(firstCloseIdx);

  // Count cards in the first CardGroup and update cols
  const firstGroupStart = newContent.indexOf("<CardGroup");
  const firstGroupEnd = newContent.indexOf(closingTag, firstGroupStart) + closingTag.length;
  const groupBlock = newContent.slice(firstGroupStart, firstGroupEnd);
  const cardCount = (groupBlock.match(/<Card /g) || []).length;
  const newCols = Math.min(cardCount, 3);

  // Replace cols={N} in the first CardGroup
  const updatedContent = newContent.replace(
    /(<CardGroup\s+cols=\{)\d+(\}>)/,
    `$1${newCols}$2`
  );

  if (dryRun) {
    log("index_mdx", "ok", { dryRun: true, cardCount, cols: newCols });
    info(`✓ Would add card to index.mdx (${cardCount} cards, cols=${newCols})`);
    return;
  }

  try {
    fs.writeFileSync(INDEX_MDX_PATH, updatedContent, "utf8");
  } catch (err) {
    restoreBackups();
    removeDir(path.join(ROOT, config.productSlug));
    fatal(`Failed to update index.mdx: ${err.message}`, 3);
  }

  log("index_mdx", "ok", { cardCount, cols: newCols });
  info(`✓ Updated index.mdx (${cardCount} cards, cols=${newCols})`);
}

// ---------------------------------------------------------------------------
// Step 6: Post-validate
// ---------------------------------------------------------------------------

function postValidate(config) {
  const errors = [];
  const productDir = path.join(ROOT, config.productSlug);

  // Check expected files exist
  const expectedFiles = [
    "index.mdx",
    "quickstart.mdx",
    "openapi.yaml",
    "guides/example-guide.mdx",
    "api-reference/introduction.mdx",
  ];
  for (const f of expectedFiles) {
    if (!fs.existsSync(path.join(productDir, f))) {
      errors.push(`Missing file: ${config.productSlug}/${f}`);
    }
  }

  // Check for unreplaced placeholders
  if (fs.existsSync(productDir)) {
    const files = walkDir(productDir, productDir);
    for (const relFile of files) {
      const content = fs.readFileSync(path.join(productDir, relFile), "utf8");
      const unreplaced = content.match(/\{\{[A-Z_]+\}\}/g);
      if (unreplaced) {
        errors.push(`Unreplaced placeholders in ${config.productSlug}/${relFile}: ${[...new Set(unreplaced)].join(", ")}`);
      }
    }
  }

  // Check docs.json is still valid
  try {
    const docsJson = JSON.parse(fs.readFileSync(DOCS_JSON_PATH, "utf8"));

    // Product in navigation
    const tabs = docsJson.navigation?.tabs || [];
    const hasTab = tabs.some((t) => t.tab === config.productName);
    if (!hasTab) errors.push(`Product tab "${config.productName}" not found in docs.json`);

    // Product in footer
    const productsGroup = (docsJson.footer?.links || []).find((g) => g.header === "Products");
    const hasFooter = productsGroup?.items.some((i) => i.href === `/${config.productSlug}`);
    if (!hasFooter) errors.push(`Footer link for "${config.productSlug}" not found in docs.json`);
  } catch {
    errors.push("docs.json is not valid JSON after modification");
  }

  // Check index.mdx has the product card
  const indexContent = fs.readFileSync(INDEX_MDX_PATH, "utf8");
  if (!indexContent.includes(`href="/${config.productSlug}"`)) {
    errors.push(`Product card not found in index.mdx`);
  }

  if (errors.length > 0) {
    log("validate", "fail", { errors });
    if (!nonInteractive) {
      console.error("\nPost-validation errors:");
      for (const e of errors) console.error(`  • ${e}`);
    }
    process.exit(4);
  }

  log("validate", "ok");
  info("✓ Post-validation passed");
}

// ---------------------------------------------------------------------------
// Step 7: Mint validate
// ---------------------------------------------------------------------------

function mintValidate() {
  try {
    execSync("which mint", { stdio: "ignore" });
  } catch {
    warn("mint CLI not found — skipping mint validate");
    log("mint_validate", "skipped", { reason: "mint CLI not installed" });
    return;
  }

  try {
    execSync("mint validate", { cwd: ROOT, stdio: "pipe" });
    log("mint_validate", "ok");
    info("✓ mint validate passed");
  } catch (err) {
    const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
    warn(`mint validate reported issues:\n${output}`);
    log("mint_validate", "warning", { output });
  }
}

// ---------------------------------------------------------------------------
// Interactive mode — readline prompts
// ---------------------------------------------------------------------------

async function interactiveMode(dryRun) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║    Irora Product Docs Wizard         ║");
  console.log("╚══════════════════════════════════════╝\n");

  const config = {};

  // Product name
  while (true) {
    config.productName = (await ask("Product name (e.g. SanctionsSeeker): ")).trim();
    const err = validate("productName", config.productName);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Slug
  const suggested = slugFromName(config.productName);
  while (true) {
    const input = (await ask(`Product slug [${suggested}]: `)).trim();
    config.productSlug = input || suggested;
    const err = validate("productSlug", config.productSlug);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Tagline
  while (true) {
    config.productTagline = (await ask("Tagline (one-line description): ")).trim();
    const err = validate("productTagline", config.productTagline);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Description
  while (true) {
    config.productDescription = (await ask("Full description (20+ chars): ")).trim();
    const err = validate("productDescription", config.productDescription);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Short description
  while (true) {
    config.productDescriptionShort = (await ask("Short description (for API reference): ")).trim();
    const err = validate("productDescriptionShort", config.productDescriptionShort);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Example endpoint
  while (true) {
    config.exampleEndpoint = (await ask("Example endpoint path (e.g. search): ")).trim();
    const err = validate("exampleEndpoint", config.exampleEndpoint);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Guide title
  while (true) {
    config.guideTitle = (await ask("First guide title (e.g. Search syntax): ")).trim();
    if (config.guideTitle.length >= 2) break;
    console.log("  Too short");
  }

  // Guide description
  while (true) {
    config.guideDescription = (await ask("First guide description: ")).trim();
    if (config.guideDescription.length >= 5) break;
    console.log("  Too short");
  }

  // Icon
  console.log(`\nCommon icons: ${COMMON_ICONS.join(", ")}`);
  while (true) {
    config.icon = (await ask("Icon name (FontAwesome): ")).trim();
    const err = validate("icon", config.icon);
    if (!err) break;
    console.log(`  Invalid: ${err}`);
  }

  // Has OpenAPI
  const openApiInput = (await ask("Has OpenAPI spec? (Y/n): ")).trim().toLowerCase();
  config.hasOpenApi = openApiInput !== "n" && openApiInput !== "no";

  // Confirmation
  console.log("\n─── Review ───────────────────────────");
  console.log(`  Name:         ${config.productName}`);
  console.log(`  Slug:         ${config.productSlug}`);
  console.log(`  Tagline:      ${config.productTagline}`);
  console.log(`  Description:  ${config.productDescription.slice(0, 60)}...`);
  console.log(`  Short desc:   ${config.productDescriptionShort}`);
  console.log(`  Endpoint:     ${config.exampleEndpoint}`);
  console.log(`  Guide:        ${config.guideTitle}`);
  console.log(`  Icon:         ${config.icon}`);
  console.log(`  OpenAPI:      ${config.hasOpenApi}`);
  if (dryRun) console.log(`  Mode:         DRY RUN`);
  console.log("──────────────────────────────────────\n");

  const confirm = (await ask("Proceed? (Y/n): ")).trim().toLowerCase();
  rl.close();

  if (confirm === "n" || confirm === "no") {
    console.log("Aborted.");
    process.exit(0);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Non-interactive mode — read config from JSON file
// ---------------------------------------------------------------------------

function nonInteractiveMode(configPath) {
  if (!fs.existsSync(configPath)) {
    fatal(`Config file not found: ${configPath}`, 1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    fatal(`Invalid JSON in config file: ${err.message}`, 1);
  }

  const errors = validateAll(config);
  if (errors.length > 0) {
    fatal(`Config validation failed:\n  ${errors.join("\n  ")}`, 1);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const configIdx = args.indexOf("--config");
  const configPath = configIdx >= 0 ? args[configIdx + 1] : null;

  nonInteractive = configPath != null;

  let config;
  if (nonInteractive) {
    config = nonInteractiveMode(path.resolve(configPath));
  } else {
    config = await interactiveMode(dryRun);
  }

  const productDir = path.join(ROOT, config.productSlug);

  // Step 1: Pre-flight
  preflight(config);

  // Step 2: Scaffold
  scaffold(config, dryRun);

  // Step 3: Replace placeholders
  replacePlaceholdersInDir(config, dryRun);

  // Step 4: Update docs.json
  updateDocsJson(config, dryRun);

  // Step 5: Update index.mdx
  updateIndexMdx(config, dryRun);

  if (dryRun) {
    log("complete", "ok", { dryRun: true });
    info("\n✓ Dry run complete — no files were modified.");
    process.exit(0);
  }

  // Step 6: Post-validate
  postValidate(config);

  // Step 7: Mint validate
  mintValidate();

  // Done!
  const nextSteps = [
    `Edit ${config.productSlug}/index.mdx — replace placeholder capabilities with real content`,
    `Edit ${config.productSlug}/quickstart.mdx — customize the getting started flow`,
    `Replace ${config.productSlug}/openapi.yaml with your real OpenAPI spec`,
    `Edit ${config.productSlug}/guides/example-guide.mdx — write your first guide`,
    `Run \`mint dev\` to preview locally`,
    `Run \`mint validate\` to check for issues`,
  ];

  log("complete", "ok", { nextSteps });

  if (!nonInteractive) {
    console.log("\n✓ Product docs scaffolded successfully!\n");
    console.log("Next steps:");
    for (const step of nextSteps) console.log(`  → ${step}`);
    console.log("");
  }
}

main().catch((err) => {
  fatal(err.message, 3);
});
