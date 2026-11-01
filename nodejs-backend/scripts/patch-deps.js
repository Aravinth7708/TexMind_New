#!/usr/bin/env node
/**
 * patch-deps.js
 * Fixes whatsapp-rust-bridge package.json to add CJS exports
 * so it works with tsx/Node CJS loader.
 * Run via postinstall: "postinstall": "node scripts/patch-deps.js"
 */
const fs = require("fs");
const path = require("path");

const pkgPath = path.resolve(
  __dirname,
  "../node_modules/whatsapp-rust-bridge/package.json"
);

if (!fs.existsSync(pkgPath)) {
  console.log("whatsapp-rust-bridge not found, skipping patch.");
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// Ensure exports map exists with require condition
if (!pkg.exports) pkg.exports = {};
if (!pkg.exports["."]) pkg.exports["."] = {};
pkg.exports["."].require = "./dist/index.js";
if (!pkg.exports["."].import) pkg.exports["."].import = "./dist/index.js";
if (!pkg.exports["."].types) pkg.exports["."].types = "./dist/index.d.ts";

// Ensure main field
pkg.main = "./dist/index.js";

// Remove ESM-only type to allow CJS
delete pkg.type;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4));
console.log("✅ Patched whatsapp-rust-bridge for CJS compatibility");
